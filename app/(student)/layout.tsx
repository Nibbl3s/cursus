import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { ThemeProvider } from '@/components/student/ThemeProvider';

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

  return <ThemeProvider themeId={themeId}>{children}</ThemeProvider>;
}
