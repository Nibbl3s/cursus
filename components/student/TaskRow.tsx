'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TaskType } from '@prisma/client';
import { CourseColorDot } from '@/components/shared/CourseColorDot';

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  STUDY:            'Study',
  RESEARCH:         'Research',
  WRITING:          'Writing',
  REVIEW:           'Review',
  QUIZ:             'Quiz',
  PRACTICE:         'Practice',
  REFLECTION:       'Reflection',
  PEER_REVIEW:      'Peer Review',
  SOCRATIC:         'Socratic',
  GUIDED_QUESTIONS: 'Guided Questions',
  FILE_UPLOAD:      'File Upload',
  PEER_BOARD:       'Peer Board',
};

interface TaskRowProps {
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  estimatedMins: number;
  pointValue: number;
  courseCode: string;
  courseColor: string;
  isUnlocked: boolean;
}

export function TaskRow({
  taskId,
  taskTitle,
  taskType,
  estimatedMins,
  pointValue,
  courseCode,
  courseColor,
  isUnlocked,
}: TaskRowProps) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  // 'idle' | 'animating-out' | 'done'
  const [state, setState] = useState<'idle' | 'animating-out' | 'done'>('idle');

  // After the fade-out transition ends, fully remove and refresh
  useEffect(() => {
    if (state !== 'animating-out') return;
    const t = setTimeout(() => {
      setState('done');
      router.refresh();
    }, 300);
    return () => clearTimeout(t);
  }, [state, router]);

  async function handleComplete() {
    if (!isUnlocked || completing || state !== 'idle') return;
    setCompleting(true);
    try {
      const res = await fetch('/api/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      if (res.ok) setState('animating-out');
    } finally {
      setCompleting(false);
    }
  }

  if (state === 'done') return null;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300 overflow-hidden ${
        state === 'animating-out' ? 'opacity-0 scale-95 max-h-0 py-0' : 'opacity-100 scale-100 max-h-20'
      } ${isUnlocked ? 'bg-white/5 hover:bg-white/10' : 'opacity-40 cursor-not-allowed'}`}
    >
      {/* Completion checkbox */}
      <button
        onClick={handleComplete}
        disabled={!isUnlocked || completing}
        aria-label="Mark complete"
        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          isUnlocked
            ? 'border-white/40 hover:border-white/80 cursor-pointer'
            : 'border-white/20 cursor-not-allowed'
        }`}
      >
        {completing && (
          <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
        )}
      </button>

      {/* Course dot + code */}
      <CourseColorDot color={courseColor} size={10} />
      <span
        className="text-xs font-semibold px-1.5 py-0.5 rounded"
        style={{ backgroundColor: courseColor + '33', color: courseColor }}
      >
        {courseCode}
      </span>

      {/* Task title */}
      <span className="flex-1 text-sm font-medium truncate">
        {isUnlocked ? taskTitle : `🔒 ${taskTitle}`}
      </span>

      {/* Task type tag */}
      <span className="hidden sm:inline text-xs text-white/50 bg-white/10 rounded px-2 py-0.5">
        {TASK_TYPE_LABELS[taskType]}
      </span>

      {/* Time */}
      <span className="text-xs text-white/50 whitespace-nowrap">{estimatedMins}m</span>

      {/* XP */}
      <span className="text-xs font-semibold text-yellow-400 whitespace-nowrap">+{pointValue} XP</span>
    </div>
  );
}
