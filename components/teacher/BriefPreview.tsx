'use client';

import dynamic from 'next/dynamic';

// MDEditor is ESM-only — load client-side only
const MDPreview = dynamic(
  () => import('@uiw/react-md-editor').then((m) => m.default.Markdown),
  { ssr: false },
);

export function BriefPreview({ source }: { source: string }) {
  return (
    <div data-color-mode="light" className="prose prose-sm max-w-none">
      <MDPreview source={source} />
    </div>
  );
}
