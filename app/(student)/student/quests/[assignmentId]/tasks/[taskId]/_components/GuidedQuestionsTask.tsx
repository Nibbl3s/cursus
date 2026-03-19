'use client';

import { useState } from 'react';

interface Question {
  question: string;
  hint: string;
}

interface TaskData {
  id: string;
  title: string;
  prompt: string | null;
  guidedQuestions: Question[] | null;
}

interface Props {
  task: TaskData;
  onComplete: (data?: Record<string, unknown>) => Promise<void>;
  alreadyCompleted: boolean;
}

export function GuidedQuestionsTask({ task, onComplete, alreadyCompleted }: Props) {
  const questions = task.guidedQuestions ?? [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(questions.length).fill(''));
  const [showHint, setShowHint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState<number[]>([]); // indices of submitted answers

  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  async function handleNext() {
    if (!answers[currentIndex].trim()) return;
    const newSubmitted = [...submitted, currentIndex];
    setSubmitted(newSubmitted);
    setShowHint(false);

    if (isLast) {
      setSaving(true);
      await onComplete({ answers: answers.map((a, i) => ({ question: questions[i].question, answer: a })) });
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ All questions answered</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-white/60">No questions configured for this task.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>
        {task.prompt && <p className="text-white/70">{task.prompt}</p>}
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              submitted.includes(i) ? 'bg-emerald-500' : i === currentIndex ? 'bg-indigo-500' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Current question */}
      {current && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <p className="text-white font-medium text-lg">{current.question}</p>

          {current.hint && (
            <button
              onClick={() => setShowHint(!showHint)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {showHint ? 'Hide hint' : 'Show hint'}
            </button>
          )}
          {showHint && current.hint && (
            <p className="text-sm text-white/60 border-l-2 border-indigo-500 pl-3">{current.hint}</p>
          )}

          <textarea
            value={answers[currentIndex]}
            onChange={(e) => {
              const next = [...answers];
              next[currentIndex] = e.target.value;
              setAnswers(next);
            }}
            placeholder="Your answer..."
            rows={4}
            className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />

          <button
            onClick={handleNext}
            disabled={saving || !answers[currentIndex].trim()}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            {saving ? 'Saving…' : isLast ? 'Finish' : 'Next Question →'}
          </button>
        </div>
      )}

      {/* Already-answered questions (collapsed) */}
      {submitted.map((idx) => (
        <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 opacity-60">
          <p className="text-xs text-white/40 mb-1">Q{idx + 1}: {questions[idx].question}</p>
          <p className="text-sm text-white/70">{answers[idx]}</p>
        </div>
      ))}
    </div>
  );
}
