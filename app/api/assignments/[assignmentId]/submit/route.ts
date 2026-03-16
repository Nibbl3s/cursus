import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { ensureSubmission } from '@/lib/ensureSubmission';

const submitSchema = z.object({
  content: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'STUDENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { assignmentId } = await params;
  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const submission = await ensureSubmission(session.user.id, assignmentId);

  const { prisma } = await import('@/lib/prisma');
  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      content: parsed.data.content,
      submittedAt: new Date(),
      status: 'SUBMITTED',
    },
  });

  return NextResponse.json(updated);
}
