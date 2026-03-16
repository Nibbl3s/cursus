import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildExportPrompt } from '@/lib/ai/prompts';

export const maxDuration = 60;

const client = new Anthropic();

const FINALIZE_TOOL: Anthropic.Tool = {
  name: 'finalize_assignment',
  description:
    'Call this when you have gathered all necessary information to generate the assignment. Pass the complete structured assignment as the argument.',
  input_schema: {
    type: 'object' as const,
    properties: {
      assignment: {
        type: 'object',
        properties: {
          title:      { type: 'string' },
          brief:      { type: 'string', description: 'markdown' },
          dueDate:    { type: 'string', description: 'ISO 8601' },
          weight:     { type: 'number', minimum: 0, maximum: 100 },
          difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD', 'BOSS'] },
          pointValue: { type: 'integer', minimum: 1 },
          tasks: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                title:             { type: 'string' },
                taskType:          { type: 'string', enum: ['STUDY', 'RESEARCH', 'WRITING', 'REVIEW', 'QUIZ', 'PRACTICE', 'REFLECTION', 'PEER_REVIEW', 'SOCRATIC'] },
                estimatedMins:     { type: 'integer', minimum: 1 },
                pointValue:        { type: 'integer', minimum: 1 },
                unlocksAfterIndex: { type: ['integer', 'null'], description: '0-based index of prerequisite task; null = always unlocked' },
              },
              required: ['title', 'taskType', 'estimatedMins', 'pointValue', 'unlocksAfterIndex'],
            },
          },
        },
        required: ['title', 'brief', 'dueDate', 'weight', 'difficulty', 'pointValue', 'tasks'],
      },
    },
    required: ['assignment'],
  },
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messages, jobType } = await req.json();

  const systemPrompt = jobType === 'KNOWLEDGE_BASE_GENERATION'
    ? buildExportPrompt('knowledgeBase')
    : buildExportPrompt('assignment');

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      tools: [FINALIZE_TOOL],
      messages,
    });

    return new Response(stream.toReadableStream());
  } catch (err) {
    console.error('[ai/interview]', err);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
