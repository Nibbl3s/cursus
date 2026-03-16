import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/platformSettings';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const bodySchema = z.object({
  submissionId: z.string().min(1),
});

const AIFeedbackSchema = z.object({
  criterionScores: z.record(z.string(), z.number()),
  overallScore: z.number().min(0).max(100),
  feedbackMarkdown: z.string(),
  quickWins: z.array(z.string()),
  strengths: z.array(z.string()),
  confidenceLevel: z.number().min(0).max(1),
});

type AIFeedbackData = z.infer<typeof AIFeedbackSchema>;

const EMPTY_FEEDBACK: AIFeedbackData = {
  criterionScores: {},
  overallScore: 0,
  feedbackMarkdown: '',
  quickWins: [],
  strengths: [],
  confidenceLevel: 0,
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'STUDENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { submissionId } = parsed.data;

  // Fetch submission with assignment brief and rubric
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        select: {
          brief: true,
          rubric: {
            include: { criteria: { orderBy: { order: 'asc' } } },
          },
        },
      },
    },
  });

  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (submission.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!submission.content) return NextResponse.json({ error: 'No submission content' }, { status: 422 });

  const brief = submission.assignment.brief ?? '';
  const criteria = submission.assignment.rubric?.criteria ?? [];

  const settings = await getSettings();
  if (!settings.aiApiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  const systemPrompt = `You are an expert educational assessor. Your job is to evaluate student work \
fairly and produce feedback that helps the student improve. Always lead with strengths. \
Quick wins must be specific and immediately actionable — never vague. \
Output ONLY valid JSON matching the AIFeedback schema. No preamble.`;

  const userPrompt = `Assignment brief: ${brief}

Rubric criteria:
${criteria.map((c) => `- ${c.label} (id: ${c.id}, max ${c.maxScore}): ${c.description}`).join('\n')}

Student submission:
${submission.content}

Produce a JSON object with:
- criterionScores: { criterionId: score } (score must not exceed maxScore)
- overallScore: weighted average 0-100
- feedbackMarkdown: 200-400 word feedback, strengths-first
- quickWins: array of 2-3 specific actionable strings
- strengths: array of 2-3 strings
- confidenceLevel: your confidence in this assessment 0-1 \
(lower if submission is ambiguous, very short, or rubric criteria are subjective)`;

  let feedbackData: AIFeedbackData = EMPTY_FEEDBACK;

  try {
    const client = new Anthropic({ apiKey: settings.aiApiKey });
    const response = await client.messages.create({
      model: settings.aiModel || 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    let jsonStr = raw;
    // Regex fallback: extract JSON object from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) jsonStr = match[0];

    try {
      feedbackData = AIFeedbackSchema.parse(JSON.parse(jsonStr));
    } catch {
      // JSON parse or validation failed — fall through to empty feedback
    }
  } catch {
    // Anthropic call failed — fall through to empty feedback with confidenceLevel 0
  }

  // Upsert so retries don't double-create
  await prisma.aIFeedback.upsert({
    where: { submissionId },
    create: { submissionId, ...feedbackData },
    update: { ...feedbackData, generatedAt: new Date() },
  });

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'AI_GRADED' },
  });

  return NextResponse.json({ success: true });
}
