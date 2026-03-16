import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureSubmission } from '@/lib/ensureSubmission';
import { getLevelFromXP } from '@/lib/points';
import { checkAchievements, AchievementStats } from '@/lib/achievements';
import { isSameDay, isYesterday } from 'date-fns';

const schema = z.object({ taskId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { taskId } = parsed.data;

  // Load the task and its parent assignment
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, assignmentId: true, pointValue: true, taskType: true },
  });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // 1. Ensure a Submission row exists before referencing it
  await ensureSubmission(userId, task.assignmentId);

  // 2. Create TaskCompletion (idempotent — ignore if already exists)
  const alreadyDone = await prisma.taskCompletion.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (alreadyDone) {
    // Already completed — return current profile state without side effects
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { userId },
      select: { totalPoints: true, level: true },
    });
    return NextResponse.json({ xp: profile.totalPoints, level: profile.level, newAchievements: [] });
  }

  await prisma.taskCompletion.create({
    data: { taskId, userId, pointsAwarded: task.pointValue },
  });

  // 3. Update Profile: totalPoints, level, streak
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { userId },
    select: { totalPoints: true, currentStreak: true, bestStreak: true, lastActiveAt: true },
  });

  const newTotalPoints = profile.totalPoints + task.pointValue;
  const newLevel = getLevelFromXP(newTotalPoints);

  // Streak logic: +1 if last active was yesterday, reset to 1 otherwise, keep if already today
  const now = new Date();
  let newStreak = profile.currentStreak;
  if (profile.lastActiveAt) {
    if (isSameDay(profile.lastActiveAt, now)) {
      // Already active today — streak unchanged
    } else if (isYesterday(profile.lastActiveAt)) {
      newStreak = profile.currentStreak + 1;
    } else {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }
  const newBestStreak = Math.max(newStreak, profile.bestStreak);

  await prisma.profile.update({
    where: { userId },
    data: {
      totalPoints: newTotalPoints,
      level: newLevel,
      currentStreak: newStreak,
      bestStreak: newBestStreak,
      lastActiveAt: now,
    },
  });

  // 4. Recalculate Submission.progressPct
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

  // 5. Check achievements
  const quizzesCompleted = await prisma.taskCompletion.count({
    where: { userId, task: { taskType: 'QUIZ' } },
  });
  const questsDone = await prisma.submission.count({
    where: { userId, status: 'SUBMITTED' },
  });
  const bossesDefeated = await prisma.submission.count({
    where: {
      userId,
      status: 'SUBMITTED',
      assignment: { dueDate: { gte: new Date() } },
    },
  });

  const stats: AchievementStats = {
    questsDone,
    bossesDefeated,
    bestStreak: newBestStreak,
    quizzesCompleted,
    level: newLevel,
  };
  const newAchievements = await checkAchievements(userId, stats);

  return NextResponse.json({ xp: newTotalPoints, level: newLevel, newAchievements });
}
