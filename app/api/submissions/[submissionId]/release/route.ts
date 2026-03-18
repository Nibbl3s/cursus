import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const bodySchema = z.object({
  finalScore: z.number().min(0).max(100),
  feedbackMarkdown: z.string(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { submissionId } = await params;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { finalScore, feedbackMarkdown } = parsed.data;

  // Verify teacher owns the course that contains this submission
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: { select: { course: { select: { teacherId: true } } } },
      aiFeedback: { select: { id: true, overallScore: true } },
    },
  });
  if (!submission || submission.assignment.course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const teacherOverride =
    submission.aiFeedback !== null && finalScore !== submission.aiFeedback.overallScore;

  const masteryLevel =
    finalScore >= 90 ? 'ADVANCED'
    : finalScore >= 70 ? 'PROFICIENT'
    : finalScore >= 50 ? 'DEVELOPING'
    : 'BEGINNING';

  await prisma.$transaction([
    prisma.submission.update({
      where: { id: submissionId },
      data: {
        finalScore,
        status: 'RELEASED',
        releasedAt: new Date(),
        teacherOverride,
        masteryLevel,
      },
    }),
    ...(submission.aiFeedback
      ? [
          prisma.aIFeedback.update({
            where: { id: submission.aiFeedback.id },
            data: { feedbackMarkdown },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ success: true });
}
