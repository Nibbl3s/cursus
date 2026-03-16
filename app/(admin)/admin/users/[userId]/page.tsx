import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { getLevelFromXP } from '@/lib/points';
import { RoleSelector } from '@/components/admin/RoleSelector';
import { CourseColorDot } from '@/components/shared/CourseColorDot';
import { DeactivateButton } from './_components/DeactivateButton';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireRole('ADMIN');

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          totalPoints: true,
          currentStreak: true,
          bestStreak: true,
          lastActiveAt: true,
        },
      },
      enrollments: {
        select: {
          course: { select: { id: true, name: true, code: true, color: true } },
        },
      },
    },
  });

  if (!user) notFound();

  const totalXP = user.profile?.totalPoints ?? 0;
  const level = getLevelFromXP(totalXP);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/admin/users"
        className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block"
      >
        ← Back to Users
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {user.profile?.displayName ?? user.email}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{user.email}</p>
        </div>
        <DeactivateButton userId={user.id} />
      </div>

      <div className="flex flex-col gap-6">
        {/* Role */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Role
          </h2>
          <RoleSelector userId={user.id} initialRole={user.role} />
          <p className="mt-2 text-xs text-gray-400">Changes take effect on next login.</p>
        </section>

        {/* Profile stats */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Profile Stats
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Total XP" value={totalXP.toLocaleString()} />
            <Stat label="Level" value={level} />
            <Stat label="Current Streak" value={`${user.profile?.currentStreak ?? 0}d`} />
            <Stat label="Best Streak" value={`${user.profile?.bestStreak ?? 0}d`} />
            <Stat
              label="Last Active"
              value={
                user.profile?.lastActiveAt
                  ? new Date(user.profile.lastActiveAt).toLocaleDateString()
                  : 'Never'
              }
            />
            <Stat
              label="Member Since"
              value={new Date(user.createdAt).toLocaleDateString()}
            />
          </div>
        </section>

        {/* Enrolled courses */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Enrolled Courses ({user.enrollments.length})
          </h2>
          {user.enrollments.length === 0 ? (
            <p className="text-sm text-gray-400">Not enrolled in any courses.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {user.enrollments.map(({ course }) => (
                <div key={course.id} className="flex items-center gap-3">
                  <CourseColorDot color={course.color} size={8} />
                  <span className="text-sm font-medium text-gray-700">{course.name}</span>
                  <span className="text-xs text-gray-400">{course.code}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
