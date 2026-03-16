'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { z } from 'zod';

// MDEditor is ESM-only — load client-side only
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

// ---- Zod schema ----
const kbSchema = z.object({
  title:   z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

type KBFormValues = z.infer<typeof kbSchema>;

// ---- Props ----
interface Props {
  courseId: string;
  /** When provided the form PATCHes instead of POSTing */
  kbId?: string;
  defaultValues?: Partial<KBFormValues>;
  /** sourceType to set on creation — defaults to MANUAL */
  sourceType?: 'MANUAL' | 'AI_ASSISTED' | 'IMPORT';
}

// ---- Component ----
export function KnowledgeBaseForm({ courseId, kbId, defaultValues, sourceType = 'MANUAL' }: Props) {
  const router = useRouter();

  const [title,   setTitle]   = useState(defaultValues?.title   ?? '');
  const [content, setContent] = useState(defaultValues?.content ?? '');

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof KBFormValues, string>>>({});
  const [serverError, setServerError] = useState('');
  const [saving,      setSaving]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setServerError('');

    const parsed = kbSchema.safeParse({ title, content });

    if (!parsed.success) {
      const errs: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof KBFormValues;
        errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setSaving(true);

    const url    = kbId ? `/api/knowledge-bases/${kbId}` : '/api/knowledge-bases';
    const method = kbId ? 'PATCH' : 'POST';
    const body   = kbId
      ? parsed.data
      : { ...parsed.data, courseId, sourceType };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(data.error?.formErrors?.[0] ?? 'Something went wrong.');
      setSaving(false);
      return;
    }

    router.push(`/teacher/courses/${courseId}/knowledge`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Introduction to React Hooks"
          className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
      </div>

      {/* Content — markdown editor */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Content <span className="text-red-500">*</span>
        </label>
        <div data-color-mode="light">
          <MDEditor value={content} onChange={(v) => setContent(v ?? '')} height={360} />
        </div>
        {fieldErrors.content && <p className="mt-1 text-xs text-red-600">{fieldErrors.content}</p>}
      </div>

      {serverError && <p className="text-xs text-red-600">{serverError}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : kbId ? 'Save changes' : 'Create article'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
