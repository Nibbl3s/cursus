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

// ---- SSE helpers ----------------------------------------------------------

function parseSseLine(line: string): unknown | null {
  if (!line.startsWith('data: ')) return null;
  const payload = line.slice(6).trim();
  if (payload === '[DONE]') return null;
  try { return JSON.parse(payload); } catch { return null; }
}

// ---- Component ------------------------------------------------------------

export function AIInterviewChat({ jobType = 'ASSIGNMENT_GENERATION', onComplete }: Props) {
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [streaming,  setStreaming]  = useState(false);
  const [jobId,      setJobId]      = useState<string | null>(null);
  const [done,       setDone]       = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  // Auto-scroll to bottom on new messages
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

    // Build the Anthropic-shaped messages array (initial trigger is a bare "Hello")
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

    // Start streaming
    const abort = new AbortController();
    abortRef.current = abort;

    let assistantText = '';
    // tool_use accumulation
    let inToolUse   = false;
    let toolJson    = '';

    try {
      const res = await fetch('/api/ai/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, jobType }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      // Append a placeholder assistant message
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const event = parseSseLine(line) as Record<string, unknown> | null;
          if (!event) continue;

          const type = event.type as string | undefined;

          if (type === 'content_block_start') {
            const block = event.content_block as Record<string, unknown>;
            if (block?.type === 'tool_use' && block?.name === 'finalize_assignment') {
              inToolUse = true;
              toolJson  = '';
            }
          }

          if (type === 'content_block_delta') {
            const delta = event.delta as Record<string, unknown>;

            if (delta?.type === 'text_delta') {
              assistantText += (delta.text as string) ?? '';
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: assistantText };
                return next;
              });
            }

            if (inToolUse && delta?.type === 'input_json_delta') {
              toolJson += (delta.partial_json as string) ?? '';
            }
          }

          if (type === 'content_block_stop' && inToolUse) {
            inToolUse = false;
            // Parse the completed tool input
            try {
              const toolInput = JSON.parse(toolJson) as { assignment: unknown };
              const result = parseAssignmentImport(JSON.stringify(toolInput.assignment));
              if (result.success) {
                const data: AssignmentImport = result.data;

                // Persist completion
                if (currentJobId) {
                  fetch('/api/ai/generate', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jobId:      currentJobId,
                      outputData: data,
                      status:     'COMPLETE',
                    }),
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
                  })),
                });
              }
            } catch { /* malformed tool JSON — continue */ }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' };
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
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
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

        {/* Streaming indicator when no assistant bubble yet */}
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
