'use client';

import { useState } from 'react';

interface TaskData {
  id: string;
  title: string;
  prompt: string | null;
  resourceLinks: string[];
}

interface Props {
  task: TaskData;
  onComplete: (data?: Record<string, unknown>) => Promise<void>;
  alreadyCompleted: boolean;
}

export function ReflectionTask({ task, onComplete, alreadyCompleted }: Props) {
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!response.trim()) return;
    setSaving(true);
    await onComplete({ response });
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ Reflection submitted</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>
        {task.prompt && (
          <p className="text-white/70 leading-relaxed">{task.prompt}</p>
        )}
      </div>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Take your time — there's no wrong answer here..."
        rows={6}
        className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />
      <button
        onClick={handleSubmit}
        disabled={saving || !response.trim()}
        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {saving ? 'Saving…' : 'Submit Reflection'}
      </button>
    </div>
  );
}
