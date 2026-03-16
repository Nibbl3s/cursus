import { differenceInDays } from 'date-fns';
import { TaskType } from '@prisma/client';
import prisma from '@/lib/prisma';

export interface DailyTask {
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  estimatedMins: number;
  pointValue: number;
  assignmentId: string;
  assignmentTitle: string;
  assignmentDueDate: Date;
  assignmentWeight: number;
  courseId: string;
  courseCode: string;
  courseColor: string;
  isUnlocked: boolean;
  priorityScore: number;
}

export async function getDailyTasks(userId: string): Promise<DailyTask[]> {
  // 1. Fetch all incomplete tasks across enrolled courses
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);

  if (courseIds.length === 0) return [];

  // Fetch completed task IDs for this user (to exclude and for unlock checks)
  const completions = await prisma.taskCompletion.findMany({
    where: { userId },
    select: { taskId: true },
  });
  const completedTaskIds = new Set(completions.map((c) => c.taskId));

  // Fetch all incomplete tasks with related assignment and course data
  const tasks = await prisma.task.findMany({
    where: {
      courseId: { in: courseIds },
      completions: { none: { userId } },
    },
    include: {
      assignment: {
        include: {
          submissions: {
            where: { userId },
            select: { progressPct: true, status: true },
          },
        },
      },
      course: {
        select: { id: true, code: true, color: true },
      },
    },
  });

  // 2. Determine unlock state
  // A task is unlocked if unlocksAfter is null, or if the referenced task is completed
  const scored: (DailyTask & { _courseId: string })[] = tasks.map((task) => {
    const isUnlocked =
      task.unlocksAfter === null || completedTaskIds.has(task.unlocksAfter);

    const submission = task.assignment.submissions[0];
    const progressPct = submission?.progressPct ?? 0;

    // 3. Score each task
    const daysUntilDue = differenceInDays(task.assignment.dueDate, new Date());
    // urgencyNorm: 0–1, higher = more urgent. Caps at 30 days out.
    const urgencyNorm = Math.min(1, Math.max(0, (30 - daysUntilDue) / 30));
    // weightNorm: assignment.weight is 0–100, normalize to 0–1
    const weightNorm = task.assignment.weight / 100;
    // notStartedBonus: 1.0 if student has not started this assignment, else 0.0
    const notStartedBonus = progressPct < 0.1 ? 1.0 : 0.0;

    const priorityScore =
      0.5 * urgencyNorm + 0.4 * weightNorm + 0.1 * notStartedBonus;

    return {
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.taskType,
      estimatedMins: task.estimatedMins,
      pointValue: task.pointValue,
      assignmentId: task.assignmentId,
      assignmentTitle: task.assignment.title,
      assignmentDueDate: task.assignment.dueDate,
      assignmentWeight: task.assignment.weight,
      courseId: task.course.id,
      courseCode: task.course.code,
      courseColor: task.course.color,
      isUnlocked,
      priorityScore,
      _courseId: task.course.id,
    };
  });

  // 4. Sort by score descending, cap at 2 tasks per course, return top 8
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  const courseTaskCount: Record<string, number> = {};
  const result: DailyTask[] = [];

  for (const task of scored) {
    const count = courseTaskCount[task._courseId] ?? 0;
    if (count < 2) {
      courseTaskCount[task._courseId] = count + 1;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _courseId, ...dailyTask } = task;
      result.push(dailyTask);
    }
    if (result.length === 8) break;
  }

  return result;
}
