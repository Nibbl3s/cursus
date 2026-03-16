import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { ThemeProvider } from '@/components/student/ThemeProvider';
import { StudentNav } from '@/components/student/StudentNav';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole('STUDENT');

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { themeId: true },
  });

  const themeId = profile?.themeId ?? 'medieval';

  return (
    <ThemeProvider themeId={themeId}>
      <div className="flex min-h-screen">
        <StudentNav />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </ThemeProvider>
  );
}
