import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { ThemeSelector } from './_components/ThemeSelector';

export default async function SettingsPage() {
  const session = await requireRole('STUDENT');

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { themeId: true },
  });

  const currentThemeId = profile?.themeId ?? 'medieval';

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>
      <section>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">
          World Theme
        </h2>
        <ThemeSelector currentThemeId={currentThemeId} />
      </section>
    </main>
  );
}
