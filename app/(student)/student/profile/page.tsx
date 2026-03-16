import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { getLevelFromXP, getXPToNextLevel } from '@/lib/points';
import { ACHIEVEMENTS } from '@/lib/achievements';

export default async function ProfilePage() {
  const session = await requireRole('STUDENT');
  const userId = session.user.id;

  const [profile, unlockedAchievements, questsDone] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: {
        displayName: true,
        totalPoints: true,
        level: true,
        bestStreak: true,
      },
    }),

    prisma.achievement.findMany({
      where: { userId },
      select: { achievementKey: true },
    }),

    prisma.submission.count({
      where: { userId, status: 'SUBMITTED' },
    }),
  ]);

  const totalXP = profile?.totalPoints ?? 0;
  const level = getLevelFromXP(totalXP);
  const xpProgress = getXPToNextLevel(totalXP);
  const progressPct = Math.round((xpProgress.current / xpProgress.needed) * 100);
  const unlockedKeys = new Set(unlockedAchievements.map((a) => a.achievementKey));

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {profile?.displayName ?? 'Profile'}
        </h1>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-yellow-400/10 px-3 py-1">
          <span className="text-xs font-semibold text-yellow-400">Level {level}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Total XP" value={totalXP.toLocaleString()} accent />
        <StatCard label="Best Streak" value={`${profile?.bestStreak ?? 0}d`} />
        <StatCard label="Quests Done" value={questsDone} />
      </div>

      {/* XP progress bar */}
      <section className="rounded-xl bg-white/5 border border-white/10 p-5 mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-white/70">XP to Level {level + 1}</p>
          <p className="text-sm font-semibold text-yellow-400">
            {xpProgress.current.toLocaleString()} / {xpProgress.needed.toLocaleString()} XP
          </p>
        </div>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-yellow-400"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </section>

      {/* Achievement grid */}
      <section>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">
          Achievements
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.values(ACHIEVEMENTS).map((achievement) => {
            const unlocked = unlockedKeys.has(achievement.key);
            return (
              <div
                key={achievement.key}
                className={`rounded-xl border p-4 flex flex-col items-center gap-2 text-center ${
                  unlocked
                    ? 'bg-yellow-400/10 border-yellow-400/30'
                    : 'bg-white/5 border-white/10 opacity-50'
                }`}
              >
                <span className="text-2xl">{unlocked ? '🏆' : '🔒'}</span>
                <p
                  className={`text-sm font-semibold ${
                    unlocked ? 'text-yellow-400' : 'text-white/40'
                  }`}
                >
                  {achievement.label}
                </p>
              </div>
            );
          })}
        </div>
      </section>
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
