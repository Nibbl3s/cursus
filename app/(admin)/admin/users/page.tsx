import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { UserTable, type UserRow } from '@/components/admin/UserTable';

export default async function AdminUsersPage() {
  await requireRole('ADMIN');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      profile: {
        select: { displayName: true, lastActiveAt: true },
      },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    displayName: u.profile?.displayName ?? u.email,
    email: u.email,
    role: u.role,
    enrollmentCount: u._count.enrollments,
    lastActiveAt: u.profile?.lastActiveAt?.toISOString() ?? null,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Users</h1>
      <UserTable users={rows} />
    </div>
  );
}
