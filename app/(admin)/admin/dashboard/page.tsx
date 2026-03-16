import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';

export default async function AdminDashboard() {
  await requireRole('ADMIN');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [usersByRole, activeCourses, completionsToday, newSignupsThisWeek] =
    await Promise.all([
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),

      prisma.course.count({
        where: { enrollments: { some: {} } },
      }),

      prisma.taskCompletion.count({
        where: { completedAt: { gte: todayStart } },
      }),

      prisma.user.count({
        where: { createdAt: { gte: weekStart } },
      }),
    ]);

  const roleCount = Object.fromEntries(
    usersByRole.map((r) => [r.role, r._count.id]),
  );
  const totalUsers = usersByRole.reduce((sum, r) => sum + r._count.id, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Dashboard</h1>

      {/* Platform Stats Bar */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Platform Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={totalUsers}>
            <RoleBreakdown
              students={roleCount['STUDENT'] ?? 0}
              teachers={roleCount['TEACHER'] ?? 0}
              admins={roleCount['ADMIN'] ?? 0}
            />
          </StatCard>
          <StatCard label="Active Courses" value={activeCourses} />
          <StatCard label="Task Completions Today" value={completionsToday} />
          <StatCard label="New Signups (7 days)" value={newSignupsThisWeek} />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  children,
}: {
  label: string;
  value: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 px-5 py-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {children}
    </div>
  );
}

function RoleBreakdown({
  students,
  teachers,
  admins,
}: {
  students: number;
  teachers: number;
  admins: number;
}) {
  return (
    <div className="mt-2 flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{students} students</span>
      <span className="text-xs text-gray-400">{teachers} teachers</span>
      <span className="text-xs text-gray-400">{admins} admins</span>
    </div>
  );
}
