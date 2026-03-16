'use client';

import Link from 'next/link';
import { Difficulty } from '@prisma/client';
import { useTheme } from '@/components/student/ThemeProvider';

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  EASY: 'text-green-400 bg-green-400/10',
  MEDIUM: 'text-sky-400 bg-sky-400/10',
  HARD: 'text-violet-400 bg-violet-400/10',
  BOSS: 'text-red-400 bg-red-400/10',
};

interface AssignmentCardProps {
  assignmentId: string;
  title: string;
  difficulty: Difficulty;
  dueDate: Date;
  pointValue: number;
  progressPct: number;
  courseColor: string;
  courseCode: string;
}

export function AssignmentCard({
  assignmentId,
  title,
  difficulty,
  dueDate,
  pointValue,
  progressPct,
  courseColor,
  courseCode,
}: AssignmentCardProps) {
  const theme = useTheme();

  const daysLeft = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const urgencyColor =
    daysLeft < 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-white/50';

  const difficultyLabel: Record<Difficulty, string> = {
    EASY: theme.vocabulary.easy,
    MEDIUM: theme.vocabulary.medium,
    HARD: theme.vocabulary.hard,
    BOSS: theme.vocabulary.boss,
  };

  return (
    <Link
      href={`/student/quests/${assignmentId}`}
      className="flex rounded-xl overflow-hidden bg-white/5 hover:bg-white/10 transition-colors group"
    >
      {/* Left color stripe */}
      <div className="w-1 flex-shrink-0" style={{ backgroundColor: courseColor }} />

      <div className="flex-1 px-4 py-3 min-w-0">
        {/* Course code + title */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <span
              className="text-xs font-semibold mr-2"
              style={{ color: courseColor }}
            >
              {courseCode}
            </span>
            <span className="text-sm font-semibold text-white group-hover:text-white/90 truncate">
              {title}
            </span>
          </div>

          {/* Difficulty badge */}
          <span
            className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[difficulty]}`}
          >
            {difficultyLabel[difficulty]}
          </span>
        </div>

        {/* Days remaining + XP */}
        <div className="flex items-center justify-between text-xs mb-2">
          <span className={urgencyColor}>
            {daysLeft > 0
              ? `${daysLeft}d remaining`
              : daysLeft === 0
                ? 'Due today'
                : `${Math.abs(daysLeft)}d overdue`}
          </span>
          <span className="text-yellow-400 font-semibold">+{pointValue} XP</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              backgroundColor: progressPct >= 100 ? '#10b981' : courseColor,
            }}
          />
        </div>
        {progressPct > 0 && (
          <p className="text-xs text-white/30 mt-1 text-right">{Math.round(progressPct)}%</p>
        )}
      </div>
    </Link>
  );
}
