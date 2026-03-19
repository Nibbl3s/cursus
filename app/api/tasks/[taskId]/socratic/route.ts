import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/platformSettings';
import { createInterviewStream } from '@/lib/ai/providers';

export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { taskId } = await params;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { learningObjective: true, title: true, assignmentId: true },
  });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Enrollment check
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      course: { assignments: { some: { id: task.assignmentId } } },
    },
  });
  if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const settings = await getSettings();
  if (!settings.aiApiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const systemPrompt = `You are a Socratic tutor helping a student understand: "${task.learningObjective ?? task.title}".

Your role:
- Ask probing questions rather than giving answers
- Challenge assumptions and ask "why" and "how do you know"
- Correct misconceptions gently with questions
- When the student demonstrates clear understanding, emit the tool call "mark_complete" with a brief summary

Do NOT give the answer directly. Guide the student to discover it themselves.`;

  const stream = await createInterviewStream({
    provider: settings.aiProvider ?? 'anthropic',
    model: settings.aiModel ?? 'claude-sonnet-4-6',
    apiKey: settings.aiApiKey,
    baseUrl: settings.aiBaseUrl ?? undefined,
    systemPrompt,
    messages: parsed.data.messages,
    tools: [{
      name: 'mark_complete',
      description: 'Call this when the student has demonstrated sufficient understanding of the learning objective.',
      input_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Brief summary of what the student demonstrated' },
        },
        required: ['summary'],
      },
    }],
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
