import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { ensureSubmission } from '@/lib/ensureSubmission';
import { TaskShell } from './_components/TaskShell';

interface Props {
  params: Promise<{ assignmentId: string; taskId: string }>;
}

export default async function TaskPage({ params }: Props) {
  const session = await requireRole('STUDENT');
  const userId = session.user.id;
  const { assignmentId, taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          scenarioText: true,
          course: { select: { id: true, code: true, color: true } },
          tasks: { orderBy: { order: 'asc' }, select: { id: true, isOptional: true } },
        },
      },
    },
  });

  if (!task || task.assignmentId !== assignmentId) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: task.assignment.course.id } },
  });
  if (!enrollment) notFound();

  await ensureSubmission(userId, assignmentId);

  // Check if this task is unlocked
  const prerequisiteDone = task.unlocksAfter
    ? await prisma.taskCompletion.findUnique({
        where: { taskId_userId: { taskId: task.unlocksAfter, userId } },
      })
    : true; // no prerequisite = always unlocked

  if (!prerequisiteDone) {
    // Task is locked — redirect to lobby
    redirect(`/student/quests/${assignmentId}`);
  }

  // Check if already completed
  const myCompletion = await prisma.taskCompletion.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });

  // Find the next required task after this one
  const requiredTasks = task.assignment.tasks.filter((t) => !t.isOptional);
  const currentIdx = requiredTasks.findIndex((t) => t.id === taskId);
  const nextTaskId =
    currentIdx >= 0 && currentIdx < requiredTasks.length - 1
      ? requiredTasks[currentIdx + 1].id
      : null;

  return (
    <TaskShell
      task={{
        id: task.id,
        title: task.title,
        taskType: task.taskType,
        prompt: task.prompt,
        starterFileUrl: task.starterFileUrl,
        resourceLinks: task.resourceLinks,
        isOptional: task.isOptional,
        guidedQuestions: task.guidedQuestions as { question: string; hint: string }[] | null,
        learningObjective: task.learningObjective,
        pointValue: task.pointValue,
      }}
      assignment={{
        id: assignmentId,
        title: task.assignment.title,
        scenarioText: task.assignment.scenarioText,
        courseCode: task.assignment.course.code,
        courseColor: task.assignment.course.color,
      }}
      alreadyCompleted={!!myCompletion}
      nextTaskId={nextTaskId}
    />
  );
}
