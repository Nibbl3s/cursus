'use client';

import { useTheme } from '@/components/student/ThemeProvider';

export function DailyQuote() {
  const theme = useTheme();
  const quotes = theme.vocabulary.dailyQuote;
  // Stable random pick per render — good enough for a motivational quote
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl" role="img" aria-label="mentor">
          {theme.vocabulary.mentorAvatar}
        </span>
        <div>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-1">
            {theme.vocabulary.mentor}
          </p>
          <p className="text-sm italic text-white/80">&ldquo;{quote}&rdquo;</p>
        </div>
      </div>
    </div>
  );
}
