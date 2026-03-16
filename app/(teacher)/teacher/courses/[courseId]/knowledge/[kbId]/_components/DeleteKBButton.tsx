'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  kbId: string;
  courseId: string;
}

export function DeleteKBButton({ kbId, courseId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');

    const res = await fetch(`/api/knowledge-bases/${kbId}`, { method: 'DELETE' });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Failed to delete article.');
      setDeleting(false);
      setConfirming(false);
      return;
    }

    router.push(`/teacher/courses/${courseId}/knowledge`);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Delete this article?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors"
        >
          {deleting ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
    >
      Delete
    </button>
  );
}
