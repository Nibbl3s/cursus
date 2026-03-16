'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/components/student/ThemeProvider';

export function DailyQuote() {
  const theme = useTheme();
  const quotes = theme.vocabulary.dailyQuote;
  // null during SSR — set after mount to avoid hydration mismatch
  const [quote, setQuote] = useState<string | null>(null);

  useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, [quotes]);

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
          {quote && (
            <p className="text-sm italic text-white/80">&ldquo;{quote}&rdquo;</p>
          )}
        </div>
      </div>
    </div>
  );
}
