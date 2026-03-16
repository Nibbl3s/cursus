'use client';

import { useState } from 'react';
import type { PlatformSettings } from '@/lib/platformSettings';

const THEMES = [
  { id: 'medieval', label: 'Medieval RPG' },
  { id: 'space',    label: 'Space Explorer' },
  { id: 'cyber',    label: 'Cyber City' },
] as const;

export function SettingsForm({ initial }: { initial: PlatformSettings }) {
  const [settings, setSettings] = useState<PlatformSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError('Failed to save settings.');
    }
  }

  function toggle(key: keyof PlatformSettings) {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-xl">
      {/* Default theme */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Default Student Theme
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Applied to new student profiles on first sign-in.
        </p>
        <div className="flex flex-col gap-2">
          {THEMES.map((theme) => (
            <label key={theme.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="defaultThemeId"
                value={theme.id}
                checked={settings.defaultThemeId === theme.id}
                onChange={() => setSettings((s) => ({ ...s, defaultThemeId: theme.id }))}
                className="accent-indigo-600"
              />
              <span className="text-sm text-gray-700">{theme.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Feature flags */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Feature Flags
        </h2>
        <div className="flex flex-col gap-4">
          <Toggle
            label="AI Mentor"
            description="Show the daily mentor quote and AI-powered features to students."
            enabled={settings.aiMentorEnabled}
            onChange={() => toggle('aiMentorEnabled')}
          />
          <Toggle
            label="Peer Review"
            description="Allow assignments to use the peer review assessment mode."
            enabled={settings.peerReviewEnabled}
            onChange={() => toggle('peerReviewEnabled')}
          />
          <Toggle
            label="Self Assessment"
            description="Allow assignments to use the self-assessment mode."
            enabled={settings.selfAssessmentEnabled}
            onChange={() => toggle('selfAssessmentEnabled')}
          />
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

function Toggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          enabled ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
