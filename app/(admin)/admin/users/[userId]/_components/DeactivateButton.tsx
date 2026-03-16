'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeactivateButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDeactivate() {
    setLoading(true);
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    router.push('/admin/users');
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Are you sure?</span>
        <button
          onClick={handleDeactivate}
          disabled={loading}
          className="rounded px-3 py-1.5 text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Deleting…' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded px-3 py-1.5 text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50"
    >
      Deactivate Account
    </button>
  );
}
