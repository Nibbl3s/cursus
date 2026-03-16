import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { getDailyTasks } from '@/lib/getDailyTasks';
import { TaskRow } from '@/components/student/TaskRow';
import { CourseColorDot } from '@/components/shared/CourseColorDot';
import { DailyQuote } from './_components/DailyQuote';
import { formatDistanceToNow } from 'date-fns';

export default async function StudentDashboard() {
  const session = await requireRole('STUDENT');
  const userId = session.user.id;

  const [dailyTasks, profile, upcomingAssignments, habits, weeklyXP, questsDone] =
    await Promise.all([
      getDailyTasks(userId),

      prisma.profile.findUnique({
        where: { userId },
        select: { totalPoints: true, level: true, currentStreak: true, displayName: true },
      }),

      // Deadlines within 14 days, across all enrolled courses
      prisma.assignment.findMany({
        where: {
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
          course: { enrollments: { some: { userId } } },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          courseId: true,
          course: { select: { code: true, color: true, name: true } },
          submissions: {
            where: { userId },
            select: { progressPct: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),

      // Today's habits (daily habits not yet completed today)
      prisma.habit.findMany({
        where: { userId, frequency: 'DAILY' },
        include: {
          completions: {
            where: {
              completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          },
        },
        orderBy: { title: 'asc' },
      }),

      // Weekly XP: sum of points from task completions in the last 7 days
      prisma.taskCompletion.aggregate({
        where: {
          userId,
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _sum: { pointsAwarded: true },
      }),

      // Quests done: submitted assignments
      prisma.submission.count({
        where: { userId, status: 'SUBMITTED' },
      }),
    ]);

  // Group upcoming assignments by courseId
  const deadlinesByCourse = upcomingAssignments.reduce<
    Record<string, { course: { code: string; color: string; name: string }; assignments: typeof upcomingAssignments }>
  >((acc, a) => {
    if (!acc[a.courseId]) acc[a.courseId] = { course: a.course, assignments: [] };
    acc[a.courseId].assignments.push(a);
    return acc;
  }, {});

  const weeklyXPTotal = weeklyXP._sum.pointsAwarded ?? 0;

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back{profile?.displayName ? `, ${profile.displayName}` : ''}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: tasks + habits + quote */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Weekly XP" value={weeklyXPTotal.toLocaleString()} accent />
            <StatCard label="Streak" value={`${profile?.currentStreak ?? 0}d`} />
            <StatCard label="Quests Done" value={questsDone} />
          </div>

          {/* Daily tasks */}
          <section>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
              Today&apos;s Tasks
            </h2>
            {dailyTasks.length === 0 ? (
              <p className="text-sm text-white/40 py-4 text-center">
                No tasks — enjoy the peace!
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {dailyTasks.map((task) => (
                  <TaskRow
                    key={task.taskId}
                    taskId={task.taskId}
                    taskTitle={task.taskTitle}
                    taskType={task.taskType}
                    estimatedMins={task.estimatedMins}
                    pointValue={task.pointValue}
                    courseCode={task.courseCode}
                    courseColor={task.courseColor}
                    isUnlocked={task.isUnlocked}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Daily habits */}
          {habits.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
                Daily Habits
              </h2>
              <div className="flex flex-col gap-1">
                {habits.map((habit) => {
                  const doneToday = habit.completions.length > 0;
                  return (
                    <div
                      key={habit.id}
                      className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                        doneToday ? 'bg-white/5 opacity-50' : 'bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{doneToday ? '✅' : '⬜'}</span>
                        <span className={`text-sm ${doneToday ? 'line-through text-white/40' : 'text-white/80'}`}>
                          {habit.title}
                        </span>
                      </div>
                      <span className="text-xs text-yellow-400">+{habit.pointValue} XP</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Mentor daily quote */}
          <DailyQuote />
        </div>

        {/* Right column: deadlines sidebar */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide">
            Approaching Deadlines
          </h2>
          {Object.keys(deadlinesByCourse).length === 0 ? (
            <p className="text-sm text-white/40">Nothing due in the next 14 days.</p>
          ) : (
            Object.values(deadlinesByCourse).map(({ course, assignments }) => (
              <div key={course.code} className="flex flex-col gap-1">
                {/* Course header */}
                <div className="flex items-center gap-2 mb-1">
                  <CourseColorDot color={course.color} size={8} />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: course.color }}
                  >
                    {course.code}
                  </span>
                </div>
                {assignments.map((a) => {
                  const daysLeft = Math.ceil(
                    (new Date(a.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );
                  const urgencyColor =
                    daysLeft < 3
                      ? 'text-red-400'
                      : daysLeft <= 7
                        ? 'text-amber-400'
                        : 'text-green-400';
                  const progress = a.submissions[0]?.progressPct ?? 0;
                  return (
                    <div
                      key={a.id}
                      className="rounded-lg bg-white/5 px-3 py-2 border-l-2"
                      style={{ borderColor: course.color }}
                    >
                      <p className="text-xs font-medium text-white/90 truncate">{a.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs font-semibold ${urgencyColor}`}>
                          {formatDistanceToNow(new Date(a.dueDate), { addSuffix: true })}
                        </span>
                        {progress > 0 && (
                          <span className="text-xs text-white/40">{Math.round(progress)}%</span>
                        )}
                      </div>
                      {progress > 0 && (
                        <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-white/40"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
      <p className="text-xs text-white/50 mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? 'text-yellow-400' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
