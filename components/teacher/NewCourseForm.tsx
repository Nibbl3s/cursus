'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ColorPicker } from './ColorPicker';

const DEFAULT_COLOR = '#6366f1';

export function NewCourseForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName]               = useState('');
  const [code, setCode]               = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor]             = useState(DEFAULT_COLOR);
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, description: description || undefined, color }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.formErrors?.[0] ?? 'Something went wrong.');
      setSaving(false);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Course name <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Introduction to Biology"
            className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Course code <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="BIO101"
            className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional course description"
          className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors"
        >
          {saving ? 'Creating…' : 'Create course'}
        </button>
      </div>
    </form>
  );
}
