'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PostToBoardButtonProps {
  submissionId: string;
  alreadyPosted: boolean;
}

export function PostToBoardButton({ submissionId, alreadyPosted }: PostToBoardButtonProps) {
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(alreadyPosted);

  if (posted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-green-400 font-medium">
        ✓ Posted to Board
      </span>
    );
  }

  async function handlePost() {
    setPosting(true);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/post`, { method: 'POST' });
      if (res.ok) {
        setPosted(true);
        router.refresh();
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <button
      onClick={handlePost}
      disabled={posting}
      className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
    >
      {posting ? 'Posting…' : 'Post to Board'}
    </button>
  );
}
