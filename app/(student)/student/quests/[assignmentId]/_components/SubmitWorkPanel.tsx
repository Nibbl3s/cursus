'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface Props {
  assignmentId: string;
  initialContent: string | null;
  alreadySubmitted: boolean;
}

export function SubmitWorkPanel({ assignmentId, initialContent, alreadySubmitted }: Props) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(alreadySubmitted);

  async function handleSubmit() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong.');
        return;
      }
      const data = await res.json();
      setSubmitted(true);
      router.refresh();
      // Trigger AI grading in the background — do not await
      fetch('/api/ai/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: data.id }),
      }).catch(() => {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
        Submit Work
      </h2>
      <div className="rounded-xl bg-white/5 border border-white/10 p-5 flex flex-col gap-4">
        {submitted ? (
          <p className="text-sm text-emerald-400 font-semibold">Work submitted successfully.</p>
        ) : null}
        <div data-color-mode="dark">
          <MDEditor
            value={content}
            onChange={(v) => setContent(v ?? '')}
            preview="edit"
            height={240}
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          onClick={handleSubmit}
          disabled={saving || !content.trim()}
          className="self-end px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors"
        >
          {saving ? 'Submitting…' : submitted ? 'Resubmit' : 'Submit Work'}
        </button>
      </div>
    </section>
  );
}
