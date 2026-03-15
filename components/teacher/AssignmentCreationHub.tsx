'use client';

import { useState } from 'react';
import { AssignmentForm } from './AssignmentForm';

type Tab = 'manual' | 'import' | 'ai';

const TABS: { id: Tab; label: string; available: boolean }[] = [
  { id: 'manual', label: 'Manual',          available: true  },
  { id: 'import', label: 'Import from AI',  available: false },
  { id: 'ai',     label: 'AI Interview',    available: false },
];

interface Props {
  courseId: string;
}

export function AssignmentCreationHub({ courseId }: Props) {
  const [tab, setTab] = useState<Tab>('manual');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ id, label, available }) => (
          <button
            key={id}
            type="button"
            disabled={!available}
            onClick={() => available && setTab(id)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500',
              available
                ? 'hover:text-gray-700 hover:border-gray-300'
                : 'opacity-40 cursor-not-allowed',
            ].join(' ')}
          >
            {label}
            {!available && (
              <span className="ml-1.5 text-xs font-normal text-gray-400">soon</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'manual' && <AssignmentForm courseId={courseId} />}
    </div>
  );
}
