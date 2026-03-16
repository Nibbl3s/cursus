'use client';

import Link from 'next/link';
import { Difficulty } from '@prisma/client';
import { useTheme } from '@/components/student/ThemeProvider';
import { format } from 'date-fns';

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  EASY: 'text-green-400 bg-green-400/10',
  MEDIUM: 'text-sky-400 bg-sky-400/10',
  HARD: 'text-violet-400 bg-violet-400/10',
  BOSS: 'text-red-400 bg-red-400/10',
};

interface AssignmentRow {
  id: string;
  title: string;
  difficulty: Difficulty;
  dueDate: string; // ISO string — serialised from server
  progressPct: number;
}

interface CourseGroup {
  courseId: string;
  courseName: string;
  courseCode: string;
  courseColor: string;
  assignments: AssignmentRow[];
}

interface BossesViewProps {
  groups: CourseGroup[];
}

export function BossesView({ groups }: BossesViewProps) {
  const theme = useTheme();

  const difficultyLabel: Record<Difficulty, string> = {
    EASY: theme.vocabulary.easy,
    MEDIUM: theme.vocabulary.medium,
    HARD: theme.vocabulary.hard,
    BOSS: theme.vocabulary.boss,
  };

  if (groups.length === 0) {
    return (
      <p className="text-sm text-white/40 text-center py-16">
        No upcoming {theme.vocabulary.deadlines.toLowerCase()} — you&apos;re clear.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ courseId, courseName, courseCode, courseColor, assignments }) => (
        <div key={courseId} className="rounded-xl overflow-hidden border border-white/10">
          {/* Course header — course color as background */}
          <div
            className="px-4 py-2.5 flex items-center gap-2"
            style={{ backgroundColor: courseColor }}
          >
            <span className="text-sm font-bold text-white">{courseCode}</span>
            <span className="text-sm text-white/80">{courseName}</span>
          </div>

          {/* Assignment rows */}
          <div className="divide-y divide-white/5">
            {assignments.map((a) => {
              const daysLeft = Math.ceil(
                (new Date(a.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              const urgencyColor =
                daysLeft < 3
                  ? 'text-red-400'
                  : daysLeft <= 7
                    ? 'text-amber-400'
                    : 'text-green-400';

              return (
                <Link
                  key={a.id}
                  href={`/student/quests/${a.id}`}
                  className="flex items-center gap-4 px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {/* Title */}
                  <span className="flex-1 text-sm font-medium text-white truncate">
                    {a.title}
                  </span>

                  {/* Due date */}
                  <span className="hidden sm:block text-xs text-white/40 whitespace-nowrap">
                    {format(new Date(a.dueDate), 'dd MMM yyyy')}
                  </span>

                  {/* Days remaining */}
                  <span className={`text-xs font-semibold whitespace-nowrap ${urgencyColor}`}>
                    {daysLeft === 0
                      ? 'Due today'
                      : daysLeft === 1
                        ? '1 day left'
                        : `${daysLeft} days left`}
                  </span>

                  {/* Difficulty badge */}
                  <span
                    className={`hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[a.difficulty]}`}
                  >
                    {difficultyLabel[a.difficulty]}
                  </span>

                  {/* Progress */}
                  <div className="flex items-center gap-2 w-20 flex-shrink-0">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${a.progressPct}%`,
                          backgroundColor:
                            a.progressPct >= 100 ? '#10b981' : courseColor,
                        }}
                      />
                    </div>
                    <span className="text-xs text-white/40 w-8 text-right">
                      {Math.round(a.progressPct)}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
