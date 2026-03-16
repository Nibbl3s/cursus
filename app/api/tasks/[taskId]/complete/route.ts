import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureSubmission } from '@/lib/ensureSubmission';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { taskId } = await params;
  const userId = session.user.id;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, assignmentId: true, pointValue: true },
  });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Guarantee a Submission row exists before we reference it
  await ensureSubmission(userId, task.assignmentId);

  const completion = await prisma.taskCompletion.upsert({
    where: { taskId_userId: { taskId, userId } },
    create: { taskId, userId, pointsAwarded: task.pointValue },
    update: {},
  });

  // Recompute progress for the submission
  const [totalTasks, completedTasks] = await Promise.all([
    prisma.task.count({ where: { assignmentId: task.assignmentId } }),
    prisma.taskCompletion.count({
      where: { userId, task: { assignmentId: task.assignmentId } },
    }),
  ]);

  const progressPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  await prisma.submission.update({
    where: { assignmentId_userId: { assignmentId: task.assignmentId, userId } },
    data: {
      progressPct,
      status: progressPct >= 100 ? 'SUBMITTED' : 'IN_PROGRESS',
    },
  });

  return NextResponse.json(completion, { status: 200 });
}
