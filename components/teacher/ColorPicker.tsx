'use client';

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#a78bfa', // purple
] as const;

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={color}
            aria-pressed={selected}
            className="w-7 h-7 rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
            style={{
              backgroundColor: color,
              boxShadow: selected ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
              transform: selected ? 'scale(1.15)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export { PRESET_COLORS };
