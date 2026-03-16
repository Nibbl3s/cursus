import { prisma } from '@/lib/prisma';

export interface PlatformSettings {
  defaultThemeId: 'medieval' | 'space' | 'cyber';
  aiMentorEnabled: boolean;
  peerReviewEnabled: boolean;
  selfAssessmentEnabled: boolean;
}

export const SETTINGS_DEFAULTS: PlatformSettings = {
  defaultThemeId: 'medieval',
  aiMentorEnabled: true,
  peerReviewEnabled: true,
  selfAssessmentEnabled: true,
};

export async function getSettings(): Promise<PlatformSettings> {
  const row = await prisma.platformSettings.findUnique({
    where: { id: 'singleton' },
  });
  if (!row) return { ...SETTINGS_DEFAULTS };
  return {
    defaultThemeId: row.defaultThemeId as PlatformSettings['defaultThemeId'],
    aiMentorEnabled: row.aiMentorEnabled,
    peerReviewEnabled: row.peerReviewEnabled,
    selfAssessmentEnabled: row.selfAssessmentEnabled,
  };
}

export async function saveSettings(settings: PlatformSettings): Promise<void> {
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...settings },
    update: settings,
  });
}
