'use client';

import { useEffect, useRef, useState } from 'react';
import { parseAssignmentImport } from '@/lib/ai/parseImport';
import type { AssignmentImport } from '@/lib/ai/assignmentSchema';
import type { TaskDraft } from './TaskBuilder';

// ---- Types ----------------------------------------------------------------

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ImportedAssignment {
  title:      string;
  brief:      string;
  dueDate:    string;
  weight:     number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'BOSS';
  pointValue: number;
  tasks:      TaskDraft[];
}

interface Props {
  jobType?: 'ASSIGNMENT_GENERATION' | 'KNOWLEDGE_BASE_GENERATION';
  onComplete: (data: ImportedAssignment) => void;
}

// ---- Normalized SSE event (matches lib/ai/providers.ts) -------------------

type NormalizedEvent =
  | { t: 'text';  v: string }
  | { t: 'tool';  n: string; i: unknown }
  | { t: 'done' }
  | { t: 'error'; v: string };

function parseSseLine(line: string): NormalizedEvent | null {
  if (!line.startsWith('data: ')) return null;
  try { return JSON.parse(line.slice(6).trim()) as NormalizedEvent; } catch { return null; }
}

// ---- Component ------------------------------------------------------------

export function AIInterviewChat({ jobType = 'ASSIGNMENT_GENERATION', onComplete }: Props) {
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [streaming, setStreaming] = useState(false);
  const [jobId,     setJobId]     = useState<string | null>(null);
  const [done,      setDone]      = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Trigger the AI's opening question on mount
  useEffect(() => {
    void sendMessage(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(userText: string | null) {
    if (streaming) return;

    const nextMessages: Message[] = userText
      ? [...messages, { role: 'user' as const, content: userText }]
      : messages;

    if (userText) {
      setMessages(nextMessages);
      setInput('');
    }

    setStreaming(true);

    const apiMessages = nextMessages.length === 0
      ? [{ role: 'user', content: 'Hello' }]
      : nextMessages.map((m) => ({ role: m.role, content: m.content }));

    // Persist job
    let currentJobId = jobId;
    if (!currentJobId) {
      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobType, messages: apiMessages }),
        });
        if (res.ok) {
          const job = await res.json();
          currentJobId = job.id;
          setJobId(job.id);
        }
      } catch { /* non-fatal */ }
    } else {
      fetch('/api/ai/generate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: currentJobId, messages: apiMessages }),
      }).catch(() => { /* non-fatal */ });
    }

    const abort = new AbortController();
    abortRef.current = abort;

    let assistantText = '';

    try {
      const res = await fetch('/api/ai/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, jobType }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        // Surface the server error message if available
        let detail = `HTTP ${res.status}`;
        try { const j = await res.json(); detail = j.error ?? detail; } catch { /* ignore */ }
        throw new Error(detail);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      // Append a placeholder assistant bubble
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const event = parseSseLine(line);
          if (!event) continue;

          if (event.t === 'text') {
            assistantText += event.v;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: assistantText };
              return next;
            });
          }

          if (event.t === 'tool' && event.n === 'finalize_assignment') {
            const result = parseAssignmentImport(JSON.stringify((event.i as { assignment: unknown })?.assignment ?? event.i));
            if (result.success) {
              const data: AssignmentImport = result.data;

              if (currentJobId) {
                fetch('/api/ai/generate', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ jobId: currentJobId, outputData: data, status: 'COMPLETE' }),
                }).catch(() => { /* non-fatal */ });
              }

              setDone(true);
              onComplete({
                title:      data.title,
                brief:      data.brief,
                dueDate:    data.dueDate,
                weight:     data.weight,
                difficulty: data.difficulty,
                pointValue: data.pointValue,
                tasks:      data.tasks.map((t) => ({
                  title:             t.title,
                  taskType:          t.taskType,
                  estimatedMins:     t.estimatedMins,
                  pointValue:        t.pointValue,
                  unlocksAfterIndex: t.unlocksAfterIndex,
                  prompt:            '',
                  isOptional:        false,
                  learningObjective: '',
                  guidedQuestions:   [],
                  starterFileUrl:    '',
                })),
              });
            }
          }

          if (event.t === 'error') {
            throw new Error(event.v);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: `⚠️ ${msg} Please try again.` };
          return next;
        });
      }
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) void sendMessage(input.trim());
    }
  }

  if (done) return null;

  return (
    <div className="flex flex-col h-[520px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <p className="text-xs text-gray-400 text-center pt-8">Starting interview…</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.content || (streaming && msg.role === 'assistant' ? (
                <span className="inline-flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : null)}
            </div>
          </div>
        ))}

        {streaming && messages.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-sm">
              <span className="inline-flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="border-t border-gray-100 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          placeholder="Type your answer… (Enter to send)"
          rows={2}
          className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
        />
        <button
          type="button"
          disabled={streaming || !input.trim()}
          onClick={() => { if (input.trim()) void sendMessage(input.trim()); }}
          className="self-end px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
