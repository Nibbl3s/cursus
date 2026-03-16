'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { themes } from '@/lib/themes';

const SWATCH_KEYS = ['primary', 'accent', 'surface', 'success', 'danger'] as const;

export function ThemeSelector({ currentThemeId }: { currentThemeId: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentThemeId);
  const [saving, setSaving] = useState(false);

  async function handleSelect(themeId: string) {
    if (themeId === selected || saving) return;
    setSelected(themeId);
    setSaving(true);

    await fetch('/api/profile/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId }),
    });

    setSaving(false);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Object.values(themes).map((theme) => {
        const isActive = selected === theme.id;
        return (
          <button
            key={theme.id}
            onClick={() => handleSelect(theme.id)}
            disabled={saving}
            className={`rounded-xl border p-5 text-left transition-colors disabled:cursor-wait ${
              isActive
                ? 'border-white/40 bg-white/10'
                : 'border-white/10 bg-white/5 hover:bg-white/[0.08]'
            }`}
          >
            <p className="text-sm font-semibold text-white mb-3">{theme.name}</p>

            {/* Palette swatches */}
            <div className="flex gap-1.5 mb-4">
              {SWATCH_KEYS.map((key) => (
                <span
                  key={key}
                  className="h-4 w-4 rounded-full ring-1 ring-white/10"
                  style={{ backgroundColor: theme.palette[key] }}
                />
              ))}
            </div>

            {/* Sample vocabulary */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/40">{theme.vocabulary.assignment}</span>
              <span className="text-xs text-white/40">{theme.vocabulary.deadline}</span>
              <span className="text-xs text-white/40">{theme.vocabulary.points}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
