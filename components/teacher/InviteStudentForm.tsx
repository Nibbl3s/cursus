'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  courseId: string;
}

export function InviteStudentForm({ courseId }: Props) {
  const router = useRouter();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    const res = await fetch(`/api/courses/${courseId}/enroll`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });

    const data = await res.json() as { error?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      return;
    }

    setSuccess(`${email} has been enrolled and sent a sign-in link.`);
    setEmail('');
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Student email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
            required
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Inviting…' : 'Invite'}
        </button>
      </form>

      {success && (
        <p className="mt-2.5 text-xs text-green-600">{success}</p>
      )}
      {error && (
        <p className="mt-2.5 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
