/**
 * Platform-wide settings store.
 *
 * Currently backed by a JSON file at /data/platform-settings.json so it can
 * be exercised locally without a DB migration. The file is gitignored and
 * created on first save. On Vercel the filesystem is ephemeral, so settings
 * reset on each cold start — swap getSettings/saveSettings for DB reads/writes
 * when a PlatformSettings table is added.
 */

import fs from 'fs';
import path from 'path';

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

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'platform-settings.json');

export function getSettings(): PlatformSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    return { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

export function saveSettings(settings: PlatformSettings): void {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}
