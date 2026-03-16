'use client';

import { useState } from 'react';
import { KnowledgeBaseForm } from './KnowledgeBaseForm';
import { ExportPromptPanel } from './ExportPromptPanel';
import { KBInterviewChat }   from './KBInterviewChat';
import { parseKnowledgeBaseImport } from '@/lib/ai/parseImport';

// ---- Types ----------------------------------------------------------------

interface KBData {
  title:   string;
  content: string;
}

type Tab = 'manual' | 'import' | 'ai';

interface Props {
  courseId: string;
}

// ---- Tab bar --------------------------------------------------------------

const TABS: { id: Tab; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'import', label: 'Import from AI' },
  { id: 'ai',     label: 'AI Interview' },
];

// ---- Component ------------------------------------------------------------

export function KnowledgeBaseCreationHub({ courseId }: Props) {
  const [tab, setTab] = useState<Tab>('manual');

  const [importData, setImportData] = useState<KBData | null>(null);
  const [aiData,     setAiData]     = useState<KBData | null>(null);

  // ---- Paste import state ----
  const [json,       setJson]       = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  function handlePasteImport() {
    setParseErrors([]);
    const result = parseKnowledgeBaseImport(json);
    if (!result.success) {
      setParseErrors(result.errors.issues.map((i) => {
        const path = i.path.length > 0 ? `${i.path.join('.')}: ` : '';
        return `${path}${i.message}`;
      }));
      return;
    }
    setImportData({ title: result.data.title, content: result.data.content });
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
        <KnowledgeBaseForm courseId={courseId} sourceType="MANUAL" />
      )}

      {/* ---- Import from AI ---- */}
      {tab === 'import' && (
        importData ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-sm text-green-700 font-medium">Article imported — review and save below.</span>
              <button
                type="button"
                onClick={() => { setImportData(null); setJson(''); setParseErrors([]); }}
                className="ml-auto text-xs text-green-600 underline hover:text-green-800"
              >
                Re-import
              </button>
            </div>
            <KnowledgeBaseForm
              courseId={courseId}
              sourceType="IMPORT"
              defaultValues={{ title: importData.title, content: importData.content }}
            />
          </div>
        ) : (
          <div className="space-y-8 max-w-2xl">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Step 1 — Copy the interview prompt</h2>
              <ExportPromptPanel type="knowledgeBase" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Step 2 — Paste the JSON output</h2>
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Paste the JSON output from your external LLM below, then click &ldquo;Validate &amp; Import&rdquo; to pre-fill the form.
                </p>
                <textarea
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  placeholder='{ "title": "...", "content": "..." }'
                  rows={8}
                  className="w-full px-3 py-2 text-xs font-mono text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                />
                {parseErrors.length > 0 && (
                  <ul className="space-y-0.5">
                    {parseErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600">{err}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={handlePasteImport}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  Validate &amp; Import
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* ---- AI Interview ---- */}
      {tab === 'ai' && (
        aiData ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-sm text-green-700 font-medium">Your article is ready to review.</span>
              <button
                type="button"
                onClick={() => setAiData(null)}
                className="ml-auto text-xs text-green-600 underline hover:text-green-800"
              >
                Start over
              </button>
            </div>
            <KnowledgeBaseForm
              courseId={courseId}
              sourceType="AI_ASSISTED"
              defaultValues={{ title: aiData.title, content: aiData.content }}
            />
          </div>
        ) : (
          <div className="max-w-2xl">
            <p className="text-xs text-gray-500 mb-4">
              Chat with the AI to describe your knowledge base article. When it has enough information it will generate the form for you automatically.
            </p>
            <KBInterviewChat onComplete={(data) => setAiData(data)} />
          </div>
        )
      )}
    </div>
  );
}
