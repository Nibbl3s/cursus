import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getSettings, saveSettings } from '@/lib/platformSettings';

const schema = z.object({
  defaultThemeId: z.enum(['medieval', 'space', 'cyber']),
  aiMentorEnabled: z.boolean(),
  peerReviewEnabled: z.boolean(),
  selfAssessmentEnabled: z.boolean(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(getSettings());
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  saveSettings(parsed.data);

  return NextResponse.json(parsed.data);
}
