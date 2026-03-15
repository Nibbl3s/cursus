'use client';

export interface Criterion {
  label:       string;
  description: string;
  maxScore:    number;
}

interface Props {
  criteria: Criterion[];
  onChange: (criteria: Criterion[]) => void;
}

const EMPTY_CRITERION: Criterion = { label: '', description: '', maxScore: 10 };

export function RubricBuilder({ criteria, onChange }: Props) {
  function add() {
    onChange([...criteria, { ...EMPTY_CRITERION }]);
  }

  function remove(index: number) {
    onChange(criteria.filter((_, i) => i !== index));
  }

  function update(index: number, field: keyof Criterion, value: string | number) {
    onChange(criteria.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...criteria];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function moveDown(index: number) {
    if (index === criteria.length - 1) return;
    const next = [...criteria];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Rubric</h3>
        <button
          type="button"
          onClick={add}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          + Add criterion
        </button>
      </div>

      {criteria.length === 0 && (
        <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
          No criteria yet. Add one above.
        </p>
      )}

      <div className="space-y-3">
        {criteria.map((c, i) => (
          <div key={i} className="flex gap-2 items-start bg-gray-50 border border-gray-200 rounded-lg p-3">
            {/* Reorder buttons */}
            <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-20 leading-none"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={i === criteria.length - 1}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-20 leading-none"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>

            {/* Fields */}
            <div className="flex-1 grid grid-cols-1 gap-2">
              <input
                value={c.label}
                onChange={(e) => update(i, 'label', e.target.value)}
                placeholder="Label (e.g. Critical Thinking)"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                value={c.description}
                onChange={(e) => update(i, 'description', e.target.value)}
                placeholder="Description (e.g. Demonstrates clear reasoning…)"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Max score */}
            <div className="shrink-0 w-20">
              <label className="block text-xs text-gray-500 mb-1 text-center">Max score</label>
              <input
                type="number"
                min={1}
                value={c.maxScore}
                onChange={(e) => update(i, 'maxScore', parseInt(e.target.value, 10) || 1)}
                className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-lg leading-none pt-0.5"
              aria-label="Remove criterion"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
