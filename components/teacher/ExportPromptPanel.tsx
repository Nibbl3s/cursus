'use client';

import { useState } from 'react';
import { buildExportPrompt } from '@/lib/ai/prompts';

interface Props {
  type: 'assignment' | 'knowledgeBase';
}

export function ExportPromptPanel({ type }: Props) {
  const [copied, setCopied] = useState(false);
  const prompt = buildExportPrompt(type);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Copy this prompt into ChatGPT, Claude.ai, or any other LLM. Once the interview is complete, paste the JSON output back here.
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 ml-4 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
      </div>
      <pre className="w-full p-3 text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap">
        {prompt}
      </pre>
    </div>
  );
}
