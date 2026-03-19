'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CompletionMoment } from './CompletionMoment';
import { ReflectionTask } from './ReflectionTask';
import { ResearchTask } from './ResearchTask';
import { GuidedQuestionsTask } from './GuidedQuestionsTask';
import { FileUploadTask } from './FileUploadTask';
import { SocraticTask } from './SocraticTask';
import { PeerBoardTask } from './PeerBoardTask';

interface Task {
  id: string;
  title: string;
  taskType: string;
  prompt: string | null;
  starterFileUrl: string | null;
  resourceLinks: string[];
  isOptional: boolean;
  guidedQuestions: { question: string; hint: string }[] | null;
  learningObjective: string | null;
}

interface Assignment {
  id: string;
  title: string;
  scenarioText: string | null;
  courseCode: string;
  courseColor: string;
}

interface Props {
  task: Task;
  assignment: Assignment;
  submissionId: string;
  userId: string;
  alreadyCompleted: boolean;
  nextTaskId: string | null;
}

interface CompletionResult {
  xp: number;
  level: number;
}

export function TaskShell({ task, assignment, submissionId, userId, alreadyCompleted, nextTaskId }: Props) {
  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);

  async function handleComplete(completionData?: Record<string, unknown>) {
    const res = await fetch('/api/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, completionData }),
    });
    if (res.ok) {
      const data = await res.json();
      setCompletionResult({ xp: data.xp, level: data.level });
    }
  }

  const taskProps = {
    task,
    onComplete: handleComplete,
    alreadyCompleted,
  };

  function renderTaskContent() {
    switch (task.taskType) {
      case 'REFLECTION':       return <ReflectionTask {...taskProps} />;
      case 'RESEARCH':
      case 'STUDY':
      case 'WRITING':
      case 'PRACTICE':
      case 'REVIEW':
      case 'QUIZ':             return <ResearchTask {...taskProps} />;
      case 'GUIDED_QUESTIONS': return <GuidedQuestionsTask {...taskProps} />;
      case 'FILE_UPLOAD':      return <FileUploadTask {...taskProps} />;
      case 'SOCRATIC':         return <SocraticTask {...taskProps} submissionId={submissionId} userId={userId} />;
      case 'PEER_BOARD':
      case 'PEER_REVIEW':      return <PeerBoardTask {...taskProps} assignmentId={assignment.id} />;
      default:                 return <ResearchTask {...taskProps} />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Scenario anchor strip */}
      {assignment.scenarioText && (
        <div className="border-b border-white/10 bg-white/[0.03] px-6 py-3">
          <p className="text-xs text-white/40 max-w-3xl mx-auto">{assignment.scenarioText}</p>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="px-6 py-3 border-b border-white/5">
        <div className="max-w-3xl mx-auto flex items-center gap-2 text-xs text-white/40">
          <Link href="/student/quests" className="hover:text-white/70 transition-colors">Quests</Link>
          <span>›</span>
          <Link href={`/student/quests/${assignment.id}`} className="hover:text-white/70 transition-colors">
            {assignment.title}
          </Link>
          <span>›</span>
          <span className="text-white/60">{task.title}</span>
          {task.isOptional && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-white/40">Optional</span>
          )}
        </div>
      </div>

      {/* Task content */}
      <div className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        {renderTaskContent()}
      </div>

      {/* Completion overlay */}
      {completionResult && (
        <CompletionMoment
          xp={completionResult.xp}
          taskTitle={task.title}
          nextTaskId={nextTaskId}
          assignmentId={assignment.id}
        />
      )}
    </div>
  );
}
