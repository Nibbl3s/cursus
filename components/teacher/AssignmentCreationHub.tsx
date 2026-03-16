'use client';

import { useState } from 'react';
import { AssignmentForm }    from './AssignmentForm';
import { ExportPromptPanel } from './ExportPromptPanel';
import { ImportPastePanel }  from './ImportPastePanel';
import { AIInterviewChat }   from './AIInterviewChat';
import type { TaskDraft }    from './TaskBuilder';

// ---- Types ----------------------------------------------------------------

interface PrefilledData {
  title:      string;
  brief:      string;
  dueDate:    string;
  weight:     number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'BOSS';
  pointValue: number;
  tasks:      TaskDraft[];
}

type Tab = 'manual' | 'import' | 'ai';

interface Props {
  courseId: string;
}

// ISO 8601 → datetime-local (strips timezone, keeps YYYY-MM-DDTHH:MM)
function toDatetimeLocal(iso: string): string {
  const clean = iso.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '');
  // If just a date (no T), append midnight
  return clean.includes('T') ? clean.slice(0, 16) : `${clean}T00:00`;
}

// ---- Tab bar --------------------------------------------------------------

const TABS: { id: Tab; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'import', label: 'Import from AI' },
  { id: 'ai',     label: 'AI Interview' },
];

// ---- Component ------------------------------------------------------------

export function AssignmentCreationHub({ courseId }: Props) {
  const [tab, setTab] = useState<Tab>('manual');

  // Per-tab review data — set when import/AI provides a result
  const [importData, setImportData] = useState<PrefilledData | null>(null);
  const [aiData,     setAiData]     = useState<PrefilledData | null>(null);

  function handleImport(data: PrefilledData) {
    setImportData({ ...data, dueDate: toDatetimeLocal(data.dueDate) });
  }

  function handleAiComplete(data: PrefilledData) {
    setAiData({ ...data, dueDate: toDatetimeLocal(data.dueDate) });
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---- Manual ---- */}
      {tab === 'manual' && (
        <AssignmentForm courseId={courseId} />
      )}

      {/* ---- Import from AI ---- */}
      {tab === 'import' && (
        importData ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-sm text-green-700 font-medium">Assignment imported — review and save below.</span>
              <button
                type="button"
                onClick={() => setImportData(null)}
                className="ml-auto text-xs text-green-600 underline hover:text-green-800"
              >
                Re-import
              </button>
            </div>
            <AssignmentForm
              courseId={courseId}
              defaultValues={{
                title:      importData.title,
                brief:      importData.brief,
                dueDate:    importData.dueDate,
                weight:     importData.weight,
                difficulty: importData.difficulty,
                pointValue: importData.pointValue,
              }}
              defaultTasks={importData.tasks}
            />
          </div>
        ) : (
          <div className="space-y-8 max-w-2xl">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Step 1 — Copy the interview prompt</h2>
              <ExportPromptPanel type="assignment" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Step 2 — Paste the JSON output</h2>
              <ImportPastePanel onImport={handleImport} />
            </div>
          </div>
        )
      )}

      {/* ---- AI Interview ---- */}
      {tab === 'ai' && (
        aiData ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-sm text-green-700 font-medium">Your assignment is ready to review.</span>
              <button
                type="button"
                onClick={() => setAiData(null)}
                className="ml-auto text-xs text-green-600 underline hover:text-green-800"
              >
                Start over
              </button>
            </div>
            <AssignmentForm
              courseId={courseId}
              defaultValues={{
                title:      aiData.title,
                brief:      aiData.brief,
                dueDate:    aiData.dueDate,
                weight:     aiData.weight,
                difficulty: aiData.difficulty,
                pointValue: aiData.pointValue,
              }}
              defaultTasks={aiData.tasks}
            />
          </div>
        ) : (
          <div className="max-w-2xl">
            <p className="text-xs text-gray-500 mb-4">
              Chat with the AI to describe your assignment. When it has enough information it will generate the form for you automatically.
            </p>
            <AIInterviewChat
              jobType="ASSIGNMENT_GENERATION"
              onComplete={handleAiComplete}
            />
          </div>
        )
      )}
    </div>
  );
}
