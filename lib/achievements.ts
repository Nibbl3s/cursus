import { prisma } from '@/lib/prisma';

export interface AchievementStats {
  questsDone: number;       // submitted assignments
  bossesDefeated: number;   // assignments submitted before or on deadline
  bestStreak: number;       // profile.bestStreak
  quizzesCompleted: number; // tasks of type QUIZ completed
  level: number;            // current level from getLevelFromXP
}

interface AchievementDef {
  key: string;
  label: string;
  condition: (stats: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  FIRST_QUEST: {
    key: 'first_quest',
    label: 'First Quest',
    condition: (stats) => stats.questsDone >= 1,
  },
  BOSS_SLAYER: {
    key: 'boss_slayer',
    label: 'Boss Slayer',
    condition: (stats) => stats.bossesDefeated >= 5,
  },
  WEEK_WARRIOR: {
    key: 'week_warrior',
    label: 'Week Warrior',
    condition: (stats) => stats.bestStreak >= 7,
  },
  KNOWLEDGE_SEEKER: {
    key: 'knowledge_seeker',
    label: 'Knowledge Seeker',
    condition: (stats) => stats.quizzesCompleted >= 10,
  },
  SCHOLAR_ELITE: {
    key: 'scholar_elite',
    label: 'Scholar Elite',
    condition: (stats) => stats.level >= 10,
  },
  CHRONOMANCER: {
    key: 'chronomancer',
    label: 'Chronomancer',
    condition: (stats) => stats.bestStreak >= 30,
  },
};

/**
 * Checks every achievement condition against the provided stats.
 * For each achievement the user hasn't unlocked yet, creates an Achievement
 * record if the condition is now met.
 * Returns the keys of any newly unlocked achievements.
 */
export async function checkAchievements(
  userId: string,
  stats: AchievementStats,
): Promise<string[]> {
  const existing = await prisma.achievement.findMany({
    where: { userId },
    select: { achievementKey: true },
  });
  const unlockedKeys = new Set(existing.map((a) => a.achievementKey));

  const newlyUnlocked: string[] = [];

  for (const def of Object.values(ACHIEVEMENTS)) {
    if (unlockedKeys.has(def.key)) continue;
    if (def.condition(stats)) {
      await prisma.achievement.create({
        data: { userId, achievementKey: def.key },
      });
      newlyUnlocked.push(def.key);
    }
  }

  return newlyUnlocked;
}
