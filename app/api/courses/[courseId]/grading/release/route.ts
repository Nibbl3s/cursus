import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const AUTO_RELEASE_MIN_CONFIDENCE = 0.8;
const AUTO_RELEASE_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;

  // Verify teacher owns this course
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { teacherId: true },
  });
  if (!course || course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cutoff = new Date(Date.now() - AUTO_RELEASE_MIN_AGE_MS);

  // Find all auto-releasable submissions for this course
  const releasable = await prisma.submission.findMany({
    where: {
      status: 'AI_GRADED',
      assignment: { courseId },
      aiFeedback: {
        confidenceLevel: { gte: AUTO_RELEASE_MIN_CONFIDENCE },
        generatedAt: { lte: cutoff },
      },
    },
    select: { id: true, aiFeedback: { select: { overallScore: true } } },
  });

  if (releasable.length === 0) {
    return NextResponse.json({ released: 0 });
  }

  const now = new Date();

  await prisma.$transaction(
    releasable.map((s) => {
      const finalScore = s.aiFeedback?.overallScore ?? 0;
      const masteryLevel =
        finalScore >= 90 ? 'ADVANCED'
        : finalScore >= 70 ? 'PROFICIENT'
        : finalScore >= 50 ? 'DEVELOPING'
        : 'BEGINNING';
      return prisma.submission.update({
        where: { id: s.id },
        data: { status: 'RELEASED', releasedAt: now, finalScore, masteryLevel },
      });
    }),
  );

  return NextResponse.json({ released: releasable.length });
}
