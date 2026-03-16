import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSettings } from '@/lib/platformSettings';
import { createInterviewStream } from '@/lib/ai/providers';
import { buildExportPrompt } from '@/lib/ai/prompts';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messages, jobType } = await req.json();

  const settings = await getSettings();

  if (!settings.aiApiKey) {
    return NextResponse.json(
      { error: 'No AI API key configured. Ask an admin to set one in Platform Settings.' },
      { status: 503 },
    );
  }

  const systemPrompt = jobType === 'KNOWLEDGE_BASE_GENERATION'
    ? buildExportPrompt('knowledgeBase')
    : buildExportPrompt('assignment');

  const stream = createInterviewStream({
    provider:     settings.aiProvider,
    model:        settings.aiModel,
    apiKey:       settings.aiApiKey,
    baseUrl:      settings.aiBaseUrl || undefined,
    messages,
    systemPrompt,
    jobType,
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
