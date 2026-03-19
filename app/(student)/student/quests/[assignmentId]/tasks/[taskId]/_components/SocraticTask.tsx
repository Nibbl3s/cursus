'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TaskData {
  id: string;
  title: string;
  prompt: string | null;
  learningObjective: string | null;
}

interface Props {
  task: TaskData;
  onComplete: (data?: Record<string, unknown>) => Promise<void>;
  alreadyCompleted: boolean;
  submissionId: string;
  userId: string;
}

export function SocraticTask({ task, onComplete, alreadyCompleted }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(userMessage?: string) {
    const content = userMessage ?? input.trim();
    if (!content || streaming) return;
    setInput('');
    setStreaming(true);
    setError('');

    const newMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(newMessages);

    try {
      const res = await fetch(`/api/tasks/${task.id}/socratic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) {
        setError('AI unavailable. Try again.');
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let completeSummary: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6);
          if (json === '[DONE]') continue;
          try {
            const event = JSON.parse(json);
            if (event.t === 'text') {
              assistantText += event.v;
              setMessages([...newMessages, { role: 'assistant', content: assistantText }]);
            } else if (event.t === 'tool' && event.n === 'mark_complete') {
              completeSummary = event.i?.summary ?? 'Understanding demonstrated';
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      if (assistantText) {
        setMessages([...newMessages, { role: 'assistant', content: assistantText }]);
      }

      if (completeSummary !== null) {
        await onComplete({
          transcript: [...newMessages, { role: 'assistant', content: assistantText }],
          summary: completeSummary,
        });
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setStreaming(false);
    }
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ Socratic dialogue complete</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white mb-1">{task.title}</h1>
        {task.prompt && <p className="text-white/60 text-sm">{task.prompt}</p>}
      </div>

      {!started ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-white/60 text-sm max-w-sm">
              The AI will guide you through this topic with questions. Answer honestly — the goal is understanding, not a perfect response.
            </p>
            <button
              onClick={() => { setStarted(true); sendMessage('Hello, I\'m ready to start.'); }}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
            >
              Start Dialogue
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 border border-white/10 text-white/90'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <span className="text-white/40 text-xs animate-pulse">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="text-sm text-red-400 mb-2">{error}</p>}

          <div className="flex gap-2 mt-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Your response..."
              disabled={streaming}
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={streaming || !input.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
