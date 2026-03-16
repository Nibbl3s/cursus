'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

const MDPreview = dynamic(
  () => import('@uiw/react-md-editor').then((m) => m.default.Markdown),
  { ssr: false },
);

type MasteryLevel = 'BEGINNING' | 'DEVELOPING' | 'PROFICIENT' | 'ADVANCED';

const MASTERY_STYLES: Record<MasteryLevel, { label: string; className: string }> = {
  BEGINNING:  { label: 'Beginning',  className: 'bg-red-500/20 text-red-300 border-red-500/30' },
  DEVELOPING: { label: 'Developing', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  PROFICIENT: { label: 'Proficient', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  ADVANCED:   { label: 'Advanced',   className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
};

interface Props {
  masteryLevel: MasteryLevel | null;
  quickWins: string[];
  strengths: string[];
  feedbackMarkdown: string;
  finalScore: number | null;
}

export function FeedbackPanel({
  masteryLevel,
  quickWins,
  strengths,
  feedbackMarkdown,
  finalScore,
}: Props) {
  const [scoreVisible, setScoreVisible] = useState(false);
  const mastery = masteryLevel ? MASTERY_STYLES[masteryLevel] : null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">
        Feedback
      </h2>

      <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-5">
        {/* Mastery badge */}
        {mastery && (
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold border ${mastery.className}`}
            >
              {mastery.label}
            </span>
            {finalScore !== null && (
              <span className="text-xs text-white/40">
                {scoreVisible ? (
                  <button
                    onClick={() => setScoreVisible(false)}
                    className="underline underline-offset-2 hover:text-white/70 transition-colors"
                  >
                    Hide score
                  </button>
                ) : (
                  <button
                    onClick={() => setScoreVisible(true)}
                    className="underline underline-offset-2 hover:text-white/70 transition-colors"
                  >
                    See score
                  </button>
                )}
                {scoreVisible && (
                  <span className="ml-2 font-semibold text-white/70 tabular-nums">
                    {Math.round(finalScore)}/100
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* No mastery level — show score toggle on its own */}
        {!mastery && finalScore !== null && (
          <div className="text-xs text-white/40">
            {scoreVisible ? (
              <>
                <span className="font-semibold text-white/70 tabular-nums mr-2">
                  {Math.round(finalScore)}/100
                </span>
                <button
                  onClick={() => setScoreVisible(false)}
                  className="underline underline-offset-2 hover:text-white/70 transition-colors"
                >
                  Hide score
                </button>
              </>
            ) : (
              <button
                onClick={() => setScoreVisible(true)}
                className="underline underline-offset-2 hover:text-white/70 transition-colors"
              >
                See score
              </button>
            )}
          </div>
        )}

        {/* Quick wins */}
        {quickWins.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
              Quick Wins
            </p>
            <ul className="space-y-1.5">
              {quickWins.map((win, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {win}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
              Strengths
            </p>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Full feedback markdown */}
        {feedbackMarkdown && (
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
              Detailed Feedback
            </p>
            <div data-color-mode="dark" className="prose prose-sm prose-invert max-w-none">
              <MDPreview source={feedbackMarkdown} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
