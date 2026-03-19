'use client';

import { useState, useRef } from 'react';

interface TaskData {
  id: string;
  title: string;
  prompt: string | null;
  starterFileUrl: string | null;
  resourceLinks: string[];
}

interface Props {
  task: TaskData;
  onComplete: (data?: Record<string, unknown>) => Promise<void>;
  alreadyCompleted: boolean;
}

export function FileUploadTask({ task, onComplete, alreadyCompleted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Upload failed');
      setUploading(false);
      return;
    }
    const { url } = await res.json();
    await onComplete({ fileUrl: url, fileName: file.name });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ File submitted</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>
        {task.prompt && <p className="text-white/70 leading-relaxed">{task.prompt}</p>}
      </div>

      {task.starterFileUrl && (
        <a
          href={task.starterFileUrl}
          download
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white hover:bg-white/10 transition-colors"
        >
          ⬇ Download starter file
        </a>
      )}

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/20 hover:border-white/30 bg-white/[0.03]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <p className="text-sm text-white">
            {file.name} <span className="text-white/40">({(file.size / 1024).toFixed(0)} KB)</span>
          </p>
        ) : (
          <>
            <p className="text-white/60 text-sm mb-1">Drop your file here, or click to browse</p>
            <p className="text-white/30 text-xs">Max 20 MB</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {uploading ? 'Uploading…' : 'Submit File'}
      </button>
    </div>
  );
}
