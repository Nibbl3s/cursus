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
  assignmentId: string;
}

export function PeerBoardTask({ task, onComplete, alreadyCompleted }: Props) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handlePost() {
    if (!content.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onComplete({ boardPost: content });
    } catch {
      setError('Failed to post. Please try again.');
      setSaving(false);
    }
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ Posted to board</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>
        {task.prompt && <p className="text-white/70 leading-relaxed">{task.prompt}</p>}
      </div>

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
        <p className="text-xs text-indigo-300/70">
          Share your genuine thinking — there&apos;s more value in an honest attempt than a polished answer.
        </p>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your solution, approach, or findings..."
        rows={8}
        className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handlePost}
        disabled={saving || !content.trim()}
        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {saving ? 'Posting…' : 'Post to Board'}
      </button>
    </div>
  );
}
