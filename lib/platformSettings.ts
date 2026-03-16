import { prisma } from '@/lib/prisma';

export interface PlatformSettings {
  defaultThemeId: 'medieval' | 'space' | 'cyber';
  aiMentorEnabled: boolean;
  peerReviewEnabled: boolean;
  selfAssessmentEnabled: boolean;
  // AI provider configuration
  aiProvider: string;
  aiModel: string;
  aiApiKey: string;
  aiBaseUrl: string;
}

export const SETTINGS_DEFAULTS: PlatformSettings = {
  defaultThemeId: 'medieval',
  aiMentorEnabled: true,
  peerReviewEnabled: true,
  selfAssessmentEnabled: true,
  aiProvider: 'anthropic',
  aiModel: 'claude-sonnet-4-6',
  aiApiKey: '',
  aiBaseUrl: '',
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
    aiProvider: row.aiProvider,
    aiModel: row.aiModel,
    aiApiKey: row.aiApiKey,
    aiBaseUrl: row.aiBaseUrl,
  };
}

export async function saveSettings(settings: PlatformSettings): Promise<void> {
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...settings },
    update: settings,
  });
}
