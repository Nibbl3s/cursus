'use client';

import Link from 'next/link';

interface CompletedTask {
  id: string;
  title: string;
  taskType: string;
}

interface NextTask {
  id: string;
  title: string;
  taskType: string;
  isOptional: boolean;
}

interface Props {
  assignmentId:      string;
  scenarioText:      string | null;
  assignmentTitle:   string;
  progressPct:       number;
  courseColor:       string;
  completedTasks:    CompletedTask[];
  nextTask:          NextTask | null;
  allDone:           boolean;
  hasStartedRequired: boolean;
  submissionStatus:  string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  STUDY:            'Study',
  RESEARCH:         'Research',
  WRITING:          'Writing',
  REVIEW:           'Review',
  QUIZ:             'Quiz',
  PRACTICE:         'Practice',
  REFLECTION:       'Reflection',
  PEER_REVIEW:      'Peer review',
  SOCRATIC:         'Socratic',
  GUIDED_QUESTIONS: 'Guided questions',
  FILE_UPLOAD:      'File upload',
  PEER_BOARD:       'Peer board',
};

export function QuestLobby({
  assignmentId,
  scenarioText,
  assignmentTitle,
  progressPct,
  courseColor,
  completedTasks,
  nextTask,
  allDone,
  hasStartedRequired,
  submissionStatus,
}: Props) {
  const circumference = 2 * Math.PI * 36; // r=36
  const offset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Scenario banner */}
      {scenarioText && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Your Mission</p>
          <p className="text-base text-white/90 leading-relaxed">{scenarioText}</p>
        </section>
      )}

      {/* Progress ring + CTA */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-6 flex items-center gap-6">
        {/* SVG ring */}
        <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0 -rotate-90">
          <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="36" fill="none"
            stroke={courseColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="flex-1">
          <p className="text-2xl font-bold text-white">{Math.round(progressPct)}%</p>
          <p className="text-sm text-white/50 mb-3">
            {allDone ? 'All tasks complete!' : 'Quest progress'}
          </p>
          {nextTask ? (
            <Link
              href={`/student/quests/${assignmentId}/tasks/${nextTask.id}`}
              className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: courseColor }}
            >
              {hasStartedRequired ? 'Continue Quest' : 'Start Quest'}
            </Link>
          ) : allDone ? (
            submissionStatus === 'SUBMITTED' || submissionStatus === 'RELEASED'
              ? <p className="text-sm text-emerald-400 font-semibold">✓ Submitted for grading</p>
              : <p className="text-sm text-emerald-400 font-semibold">✓ All tasks complete</p>
          ) : null}
        </div>
      </section>

      {/* Next task teaser */}
      {nextTask && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Up next</p>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/60">
              {TASK_TYPE_LABELS[nextTask.taskType] ?? nextTask.taskType}
            </span>
            <span className="text-sm text-white font-medium">{nextTask.title}</span>
            {nextTask.isOptional && (
              <span className="ml-auto text-xs text-white/40">Optional</span>
            )}
          </div>
        </section>
      )}

      {/* Completed tasks log */}
      {completedTasks.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">
            Completed ({completedTasks.length})
          </p>
          <div className="space-y-1">
            {completedTasks.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-2 flex items-center gap-3 opacity-60"
              >
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="text-sm text-white/70">{t.title}</span>
                <span className="ml-auto text-xs text-white/30">
                  {TASK_TYPE_LABELS[t.taskType] ?? t.taskType}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
