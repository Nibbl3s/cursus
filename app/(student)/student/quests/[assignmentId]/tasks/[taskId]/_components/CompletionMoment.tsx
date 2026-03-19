'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  xp: number;
  taskTitle: string;
  nextTaskId: string | null;
  assignmentId: string;
}

export function CompletionMoment({ xp, taskTitle, nextTaskId, assignmentId }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  function handleContinue() {
    if (nextTaskId) {
      router.push(`/student/quests/${assignmentId}/tasks/${nextTaskId}`);
    } else {
      router.push(`/student/quests/${assignmentId}`);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-white mb-1">Task Complete!</h2>
        <p className="text-sm text-white/60 mb-4">{taskTitle}</p>
        <p className="text-emerald-400 font-semibold text-sm mb-6">+{xp} XP earned</p>
        <button
          onClick={handleContinue}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
        >
          {nextTaskId ? 'Continue →' : 'Back to Quest'}
        </button>
      </div>
    </div>
  );
}
