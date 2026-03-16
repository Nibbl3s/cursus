-- Add AI provider configuration fields to PlatformSettings
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'anthropic';
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "aiModel"    TEXT NOT NULL DEFAULT 'claude-sonnet-4-6';
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "aiApiKey"   TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "aiBaseUrl"  TEXT NOT NULL DEFAULT '';
