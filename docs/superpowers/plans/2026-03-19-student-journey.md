# Student Learning Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform every assignment into a curiosity-driven, scenario-first journey where students work through interactive tasks one at a time and completion happens through doing the work, not ticking checkboxes.

**Architecture:** A new per-task page (`/student/quests/[assignmentId]/tasks/[taskId]`) hosts the interactive experience for each task type. The existing quest overview page becomes a lobby (scenario banner + single CTA + progress). The `/api/completions` endpoint is extended to store per-task completion data and trigger automatic submission when all required tasks are done.

**Tech Stack:** Next.js 15 App Router, Prisma + Supabase Postgres, Vercel Blob (file uploads), Anthropic AI (Socratic tasks), Tailwind CSS, TypeScript

---

## Spec Reference

`docs/superpowers/specs/2026-03-19-student-journey-design.md`

---

## File Map

### New files
| File | Purpose |
|---|---|
| `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/page.tsx` | Task page server component — fetches task + submission, renders TaskShell |
| `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/TaskShell.tsx` | Client component — scenario anchor strip, breadcrumb, routes to task-type component |
| `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/CompletionMoment.tsx` | Animated overlay shown after a task is completed |
| `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/ReflectionTask.tsx` | Text area prompt, submits on confirm |
| `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/ResearchTask.tsx` | Open-ended prompt with optional resource links |
| `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/GuidedQuestionsTask.tsx` | Sequential questions that unlock one at a time |
| `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/FileUploadTask.tsx` | Starter file download + drag-and-drop upload via Vercel Blob |
| `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/SocraticTask.tsx` | AI back-and-forth chat that completes when understanding is demonstrated |
| `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/PeerBoardTask.tsx` | Student writes and posts to bulletin board as the completion act |
| `app/api/tasks/[taskId]/socratic/route.ts` | Streaming Socratic dialogue endpoint for students (separate from teacher interview) |
| `app/(student)/student/quests/[assignmentId]/_components/QuestLobby.tsx` | Client component for the redesigned lobby (scenario, progress ring, CTA, completed log) |

### Modified files
| File | What changes |
|---|---|
| `prisma/schema.prisma` | New enum values, new fields on Task/Assignment/TaskCompletion, extend SocraticDialogue |
| `app/api/completions/route.ts` | Accept `completionData`, save to TaskCompletion, auto-submit when all required tasks done |
| `app/(student)/student/quests/[assignmentId]/page.tsx` | Replace task list + SubmitWorkPanel with QuestLobby component |
| `components/teacher/TaskBuilder.tsx` | Add new task types, per-type fields (prompt, learningObjective, guidedQuestions, starterFileUrl, isOptional) |
| `components/teacher/AssignmentForm.tsx` | Add scenarioText rich-text field |

### Removed files
| File | Reason |
|---|---|
| `app/(student)/student/quests/[assignmentId]/_components/SubmitWorkPanel.tsx` | Replaced by automatic submission |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new TaskType enum values**

In `prisma/schema.prisma`, extend the `TaskType` enum:

```prisma
enum TaskType {
  STUDY
  RESEARCH
  WRITING
  REVIEW
  QUIZ
  PRACTICE
  REFLECTION
  PEER_REVIEW
  SOCRATIC
  GUIDED_QUESTIONS
  FILE_UPLOAD
  PEER_BOARD
}
```

- [ ] **Step 2: Add fields to Assignment**

```prisma
model Assignment {
  // ... existing fields ...
  scenarioText     String?   // immersive real-world scenario shown in the lobby
  // ... rest unchanged ...
}
```

- [ ] **Step 3: Add fields to Task**

```prisma
model Task {
  // ... existing fields ...
  prompt            String?   // the challenge description shown to the student
  starterFileUrl    String?   // downloadable template/dataset for FILE_UPLOAD tasks
  resourceLinks     String[]  // optional reference URLs shown alongside the prompt
  isOptional        Boolean   @default(false) // marks task as an exploration branch
  guidedQuestions   Json?     // [{question: string, hint: string}]
  learningObjective String?   // for SOCRATIC tasks; guides AI and signals completion
}
```

- [ ] **Step 4: Add completionData to TaskCompletion**

```prisma
model TaskCompletion {
  // ... existing fields ...
  completionData    Json?     // answers, file URL, transcript ref, board post ID, etc.
}
```

- [ ] **Step 5: Extend SocraticDialogue with nullable taskId**

```prisma
model SocraticDialogue {
  // ... existing fields ...
  taskId           String?   // null = submission-level (existing); set = task-level SOCRATIC task
  task             Task?     @relation(fields: [taskId], references: [id])
}
```

Also add the reverse relation on Task:
```prisma
model Task {
  // ... existing fields ...
  socraticDialogues SocraticDialogue[]
}
```

- [ ] **Step 6: Run migration**

```bash
npx prisma migrate dev --name student-journey-schema
```

Expected: migration file created, client regenerated without errors.

- [ ] **Step 7: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: schema migration for student journey — task types, fields, socratic taskId"
```

---

## Task 2: Extend /api/completions

**Files:**
- Modify: `app/api/completions/route.ts`

The existing endpoint creates a TaskCompletion, awards XP, updates streak, recalculates `progressPct`, and already sets `Submission.status = 'SUBMITTED'` when `progressPct >= 100`. We extend it to:
1. Accept optional `completionData` and save it on the TaskCompletion record
2. When auto-submitting (progressPct 100%), compile all TaskCompletion.completionData records into `Submission.content` as a JSON summary

- [ ] **Step 1: Extend the Zod schema to accept completionData**

In `app/api/completions/route.ts`, change:
```typescript
const schema = z.object({ taskId: z.string() });
```
to:
```typescript
const schema = z.object({
  taskId:         z.string(),
  completionData: z.record(z.unknown()).optional(),
});
```

And destructure it:
```typescript
const { taskId, completionData } = parsed.data;
```

- [ ] **Step 2: Pass completionData when creating TaskCompletion**

Change:
```typescript
await prisma.taskCompletion.create({
  data: { taskId, userId, pointsAwarded: task.pointValue },
});
```
to:
```typescript
await prisma.taskCompletion.create({
  data: {
    taskId,
    userId,
    pointsAwarded: task.pointValue,
    ...(completionData ? { completionData } : {}),
  },
});
```

- [ ] **Step 3: Compile completionData into Submission.content on auto-submit**

Auto-submission must trigger when all **required** tasks are done, not when `progressPct >= 100` (which counts optional tasks too). Replace the existing `prisma.submission.update` call (the one that sets `progressPct` and `status`) with:

```typescript
// progressPct is based on required tasks only — optional tasks don't count toward progress
// so the ring always reaches 100% when the required work is done.
const [totalRequired, completedRequired] = await Promise.all([
  prisma.task.count({ where: { assignmentId: task.assignmentId, isOptional: false } }),
  prisma.taskCompletion.count({
    where: { userId, task: { assignmentId: task.assignmentId, isOptional: false } },
  }),
]);
const progressPct = totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0;
const allRequiredDone = totalRequired > 0 && completedRequired >= totalRequired;

// NOTE: The existing progressPct calculation (lines above this in the file) counts
// ALL tasks. Replace that entire block with the required-only counts above and
// remove the old totalTasks/completedTasks Promise.all.

if (allRequiredDone) {
  // Compile all completion data into a structured submission
  const allCompletions = await prisma.taskCompletion.findMany({
    where: { userId, task: { assignmentId: task.assignmentId } },
    select: { taskId: true, completionData: true },
  });
  const compiled = JSON.stringify(allCompletions, null, 2);

  await prisma.submission.update({
    where: { assignmentId_userId: { assignmentId: task.assignmentId, userId } },
    data: { progressPct, status: 'SUBMITTED', content: compiled },
  });
} else {
  await prisma.submission.update({
    where: { assignmentId_userId: { assignmentId: task.assignmentId, userId } },
    data: { progressPct, status: 'IN_PROGRESS' },
  });
}
```

- [ ] **Step 4: Verify manually**

Start dev server (`npm run dev`). Complete a task as a student. In Prisma Studio (`npx prisma studio`), confirm:
- `TaskCompletion` row has `completionData` field (null is fine for now — will be set by task components)
- `Submission.status` is still set correctly

- [ ] **Step 5: Commit**

```bash
git add app/api/completions/route.ts
git commit -m "feat: extend /api/completions to store completionData and compile auto-submission"
```

---

## Task 3: Quest Lobby Redesign

**Files:**
- Modify: `app/(student)/student/quests/[assignmentId]/page.tsx`
- Create: `app/(student)/student/quests/[assignmentId]/_components/QuestLobby.tsx`
- Delete: `app/(student)/student/quests/[assignmentId]/_components/SubmitWorkPanel.tsx`

The quest overview page becomes a scenario-first lobby. The task list and SubmitWorkPanel are removed. Students see: scenario banner → progress ring → next task teaser → "Start / Continue Quest" button → completed tasks log.

- [ ] **Step 1: Create QuestLobby client component**

Create `app/(student)/student/quests/[assignmentId]/_components/QuestLobby.tsx`:

```typescript
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
  assignmentId:   string;
  scenarioText:   string | null;
  assignmentTitle: string;
  progressPct:    number;
  courseColor:    string;
  completedTasks: CompletedTask[];
  nextTask:       NextTask | null;
  allDone:        boolean;
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
              {completedTasks.length === 0 ? 'Start Quest' : 'Continue Quest'}
            </Link>
          ) : allDone ? (
            <p className="text-sm text-emerald-400 font-semibold">✓ Submitted for grading</p>
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
                className="rounded-lg border border-white/5 bg-white/3 px-4 py-2 flex items-center gap-3 opacity-60"
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
```

- [ ] **Step 2: Rewrite the quest page server component**

Replace `app/(student)/student/quests/[assignmentId]/page.tsx` with:

```typescript
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { ensureSubmission } from '@/lib/ensureSubmission';
import { CourseColorDot } from '@/components/shared/CourseColorDot';
import { AssignmentBrief } from '@/components/student/AssignmentBrief';
import { QuestLobby } from './_components/QuestLobby';
import { FeedbackPanel } from './_components/FeedbackPanel';
import { PostToBoardButton } from '@/components/student/board/PostToBoardButton';

interface Props {
  params: Promise<{ assignmentId: string }>;
}

export default async function AssignmentDetailPage({ params }: Props) {
  const session = await requireRole('STUDENT');
  const userId = session.user.id;
  const { assignmentId } = await params;

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      tasks: { orderBy: { order: 'asc' } },
      course: { select: { code: true, color: true } },
    },
  });
  if (!assignment) notFound();

  const submission = await ensureSubmission(userId, assignmentId);

  const aiFeedback =
    submission.status === 'RELEASED'
      ? await prisma.aIFeedback.findUnique({ where: { submissionId: submission.id } })
      : null;

  const completions = await prisma.taskCompletion.findMany({
    where: { userId, task: { assignmentId } },
    select: { taskId: true },
  });
  const completedTaskIds = new Set(completions.map((c) => c.taskId));

  const daysLeft = Math.ceil(
    (new Date(assignment.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const urgencyColor =
    daysLeft < 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-white/50';

  const isReleased = submission.status === 'RELEASED';
  const isPeerReview = assignment.assessmentMode === 'PEER_REVIEW';
  const allDone = assignment.tasks.length > 0 && assignment.tasks.every((t) => completedTaskIds.has(t.id));

  // Required tasks only for next-task calculation
  const requiredTasks = assignment.tasks.filter((t) => !t.isOptional);
  const completedRequired = requiredTasks.filter((t) => completedTaskIds.has(t.id));
  const nextTask = requiredTasks.find((t) => !completedTaskIds.has(t.id)) ?? null;

  const completedTasksForLobby = assignment.tasks
    .filter((t) => completedTaskIds.has(t.id))
    .map((t) => ({ id: t.id, title: t.title, taskType: t.taskType }));

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <CourseColorDot color={assignment.course.color} size={10} />
          <span className="text-xs font-semibold" style={{ color: assignment.course.color }}>
            {assignment.course.code}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white">{assignment.title}</h1>
        <p className={`text-sm mt-1 ${urgencyColor}`}>
          {daysLeft > 0
            ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
            : daysLeft === 0
              ? 'Due today'
              : `${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} overdue`}
        </p>
      </div>

      {/* Assignment brief (shown if no scenarioText — legacy support) */}
      {assignment.brief && !assignment.scenarioText ? (
        <section className="mb-6">
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <AssignmentBrief brief={assignment.brief} />
          </div>
        </section>
      ) : null}

      {/* Quest lobby */}
      <QuestLobby
        assignmentId={assignmentId}
        scenarioText={assignment.scenarioText ?? null}
        assignmentTitle={assignment.title}
        progressPct={submission.progressPct}
        courseColor={assignment.course.color}
        completedTasks={completedTasksForLobby}
        nextTask={nextTask ? { id: nextTask.id, title: nextTask.title, taskType: nextTask.taskType, isOptional: nextTask.isOptional } : null}
        allDone={allDone}
      />

      {/* Feedback panel */}
      {isReleased && aiFeedback && (
        <div className="mt-6">
          <FeedbackPanel
            masteryLevel={submission.masteryLevel as 'BEGINNING' | 'DEVELOPING' | 'PROFICIENT' | 'ADVANCED' | null}
            quickWins={aiFeedback.quickWins}
            strengths={aiFeedback.strengths}
            feedbackMarkdown={aiFeedback.feedbackMarkdown}
            finalScore={submission.finalScore}
          />
        </div>
      )}

      {/* Post to Board */}
      {isPeerReview && (submission.status === 'SUBMITTED' || isReleased) && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Share your work</p>
            <p className="text-xs text-white/50">Post to the peer review board for feedback</p>
          </div>
          <PostToBoardButton
            submissionId={submission.id}
            alreadyPosted={submission.postedToBoard}
          />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Delete SubmitWorkPanel**

```bash
rm app/(student)/student/quests/\[assignmentId\]/_components/SubmitWorkPanel.tsx
```

- [ ] **Step 4: Verify manually**

`npm run dev` → open an assignment as a student → confirm:
- Scenario banner appears if `scenarioText` is set (none yet — test by setting one in Prisma Studio)
- Progress ring shows correct percentage
- "Start Quest" button links to the first task's URL (will 404 until Task 4 — that's fine)
- Old checkbox list and "Submit Work" form are gone

- [ ] **Step 5: Commit**

```bash
git add app/(student)/student/quests/
git commit -m "feat: redesign quest page as scenario-first lobby with progress ring and task teaser"
```

---

## Task 4: Task Page Server Component

**Files:**
- Create: `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/page.tsx`

This server component fetches the task and submission, determines unlock state, and renders the TaskShell (created in Task 5).

- [ ] **Step 1: Create the task page**

Create `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { ensureSubmission } from '@/lib/ensureSubmission';
import { TaskShell } from './_components/TaskShell';

interface Props {
  params: Promise<{ assignmentId: string; taskId: string }>;
}

export default async function TaskPage({ params }: Props) {
  const session = await requireRole('STUDENT');
  const userId = session.user.id;
  const { assignmentId, taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          scenarioText: true,
          course: { select: { code: true, color: true } },
          tasks: { orderBy: { order: 'asc' }, select: { id: true, isOptional: true } },
        },
      },
    },
  });

  if (!task || task.assignmentId !== assignmentId) notFound();

  const submission = await ensureSubmission(userId, assignmentId);

  // Check if this task is unlocked
  const alreadyCompleted = task.unlocksAfter
    ? await prisma.taskCompletion.findUnique({
        where: { taskId_userId: { taskId: task.unlocksAfter, userId } },
      })
    : true; // no prerequisite = always unlocked

  if (!alreadyCompleted) {
    // Task is locked — redirect to lobby
    redirect(`/student/quests/${assignmentId}`);
  }

  // Check if already completed
  const myCompletion = await prisma.taskCompletion.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });

  // Find the next required task after this one
  const requiredTasks = task.assignment.tasks.filter((t) => !t.isOptional);
  const currentIdx = requiredTasks.findIndex((t) => t.id === taskId);
  const nextTaskId = currentIdx >= 0 && currentIdx < requiredTasks.length - 1
    ? requiredTasks[currentIdx + 1].id
    : null;

  return (
    <TaskShell
      task={{
        id: task.id,
        title: task.title,
        taskType: task.taskType,
        prompt: task.prompt,
        starterFileUrl: task.starterFileUrl,
        resourceLinks: task.resourceLinks,
        isOptional: task.isOptional,
        guidedQuestions: task.guidedQuestions as { question: string; hint: string }[] | null,
        learningObjective: task.learningObjective,
      }}
      assignment={{
        id: assignmentId,
        title: task.assignment.title,
        scenarioText: task.assignment.scenarioText,
        courseCode: task.assignment.course.code,
        courseColor: task.assignment.course.color,
      }}
      submissionId={submission.id}
      userId={userId}
      alreadyCompleted={!!myCompletion}
      nextTaskId={nextTaskId}
    />
  );
}
```

- [ ] **Step 2: Verify the route exists**

`npm run build` (or `npm run dev`) — confirm no TypeScript errors on the new page. It will fail to render because `TaskShell` doesn't exist yet — that's expected.

---

## Task 5: TaskShell + CompletionMoment

**Files:**
- Create: `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/TaskShell.tsx`
- Create: `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/CompletionMoment.tsx`

TaskShell is the wrapper that all task types share: scenario anchor strip, breadcrumb, and the completion moment overlay.

- [ ] **Step 1: Create CompletionMoment**

Create `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/CompletionMoment.tsx`:

```typescript
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
    // Trigger entrance animation
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
```

- [ ] **Step 2: Create TaskShell**

Create `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/TaskShell.tsx`:

```typescript
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
      case 'REFLECTION':     return <ReflectionTask {...taskProps} />;
      case 'RESEARCH':
      case 'STUDY':
      case 'WRITING':
      case 'PRACTICE':
      case 'REVIEW':
      case 'QUIZ':           return <ResearchTask {...taskProps} />;
      case 'GUIDED_QUESTIONS': return <GuidedQuestionsTask {...taskProps} />;
      case 'FILE_UPLOAD':    return <FileUploadTask {...taskProps} />;
      case 'SOCRATIC':       return <SocraticTask {...taskProps} submissionId={submissionId} userId={userId} />;
      case 'PEER_BOARD':
      case 'PEER_REVIEW':    return <PeerBoardTask {...taskProps} assignmentId={assignment.id} />;
      default:               return <ResearchTask {...taskProps} />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Scenario anchor strip */}
      {assignment.scenarioText && (
        <div className="border-b border-white/10 bg-white/3 px-6 py-3">
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
```

- [ ] **Step 3: Verify compiles (task type components don't exist yet — add stubs)**

Since the task type components are imported but not created yet, temporarily stub them. Create each of the following with a minimal stub so the build doesn't error:

For each of `ReflectionTask.tsx`, `ResearchTask.tsx`, `GuidedQuestionsTask.tsx`, `FileUploadTask.tsx`, `SocraticTask.tsx`, `PeerBoardTask.tsx`:

```typescript
'use client';
export function XxxTask() { return <div>Coming soon</div>; }
```

Then verify: `npm run build` passes (or `npm run dev` starts without errors).

- [ ] **Step 4: Commit stubs**

```bash
git add app/(student)/student/quests/
git commit -m "feat: task page shell, completion moment, and task type stubs"
```

---

## Task 6: ReflectionTask + ResearchTask

**Files:**
- Modify: `.../_components/ReflectionTask.tsx`
- Modify: `.../_components/ResearchTask.tsx`

Both are simple text-submission components. Reflection is low-stakes with introspective prompts. Research is an open-ended response with optional resource links.

These two share the same interaction pattern: write → submit → complete.

- [ ] **Step 1: Implement ReflectionTask**

Replace stub with:

```typescript
'use client';

import { useState } from 'react';

interface TaskData {
  id: string;
  title: string;
  prompt: string | null;
  resourceLinks: string[];
}

interface Props {
  task: TaskData;
  onComplete: (data?: Record<string, unknown>) => Promise<void>;
  alreadyCompleted: boolean;
}

export function ReflectionTask({ task, onComplete, alreadyCompleted }: Props) {
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!response.trim()) return;
    setSaving(true);
    await onComplete({ response });
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ Reflection submitted</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>
        {task.prompt && (
          <p className="text-white/70 leading-relaxed">{task.prompt}</p>
        )}
      </div>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Take your time — there's no wrong answer here..."
        rows={6}
        className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />
      <button
        onClick={handleSubmit}
        disabled={saving || !response.trim()}
        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {saving ? 'Saving…' : 'Submit Reflection'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implement ResearchTask**

Replace stub with:

```typescript
'use client';

import { useState } from 'react';

interface TaskData {
  id: string;
  title: string;
  prompt: string | null;
  resourceLinks: string[];
}

interface Props {
  task: TaskData;
  onComplete: (data?: Record<string, unknown>) => Promise<void>;
  alreadyCompleted: boolean;
}

export function ResearchTask({ task, onComplete, alreadyCompleted }: Props) {
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!response.trim()) return;
    setSaving(true);
    await onComplete({ response });
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ Response submitted</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>
        {task.prompt && (
          <p className="text-white/70 leading-relaxed">{task.prompt}</p>
        )}
      </div>

      {task.resourceLinks.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Resources</p>
          <ul className="space-y-1">
            {task.resourceLinks.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Write your findings or answer here..."
        rows={8}
        className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />
      <button
        onClick={handleSubmit}
        disabled={saving || !response.trim()}
        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {saving ? 'Saving…' : 'Submit'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

Set a task to type `REFLECTION` or `RESEARCH` in Prisma Studio. Navigate to its task page. Confirm: prompt shows, textarea works, clicking Submit calls `/api/completions` and shows CompletionMoment.

- [ ] **Step 4: Commit**

```bash
git add app/(student)/student/quests/
git commit -m "feat: ReflectionTask and ResearchTask interactive components"
```

---

## Task 7: GuidedQuestionsTask

**Files:**
- Modify: `.../_components/GuidedQuestionsTask.tsx`

Questions are stored in `task.guidedQuestions` as `[{question, hint}]`. One question at a time — the student submits an answer, and only then does the next question appear.

- [ ] **Step 1: Implement GuidedQuestionsTask**

```typescript
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
  const allSubmitted = submitted.length === questions.length;

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
        <div key={idx} className="rounded-xl border border-white/5 bg-white/3 px-4 py-3 opacity-60">
          <p className="text-xs text-white/40 mb-1">Q{idx + 1}: {questions[idx].question}</p>
          <p className="text-sm text-white/70">{answers[idx]}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

In Prisma Studio, set a task's `taskType` to `GUIDED_QUESTIONS` and `guidedQuestions` to:
```json
[{"question":"What is a VLOOKUP used for?","hint":"Think about looking up values in a table"},{"question":"When would you use INDEX MATCH instead?","hint":"Consider when your lookup column is not the leftmost"}]
```
Navigate to the task page. Confirm questions reveal one at a time, hints toggle, progress dots update.

- [ ] **Step 3: Commit**

```bash
git add app/(student)/student/quests/
git commit -m "feat: GuidedQuestionsTask with sequential unlock and hint system"
```

---

## Task 8: FileUploadTask

**Files:**
- Modify: `.../_components/FileUploadTask.tsx`

**Prerequisite:** File uploads require external storage. This plan uses **Vercel Blob**.
- Add `@vercel/blob` package: `npm install @vercel/blob`
- Add `BLOB_READ_WRITE_TOKEN` to `.env.local` (from Vercel dashboard → Storage → Blob)
- Create an upload API route at `app/api/upload/route.ts`

- [ ] **Step 1: Install Vercel Blob**

```bash
npm install @vercel/blob
```

- [ ] **Step 2: Create upload API route**

Create `app/api/upload/route.ts`:

```typescript
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 422 });

  // 20 MB limit
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 422 });
  }

  const blob = await put(`uploads/${session.user.id}/${Date.now()}-${file.name}`, file, {
    access: 'public',
  });

  return NextResponse.json({ url: blob.url });
}
```

- [ ] **Step 3: Implement FileUploadTask**

```typescript
'use client';

import { useState, useRef } from 'react';

interface TaskData {
  id: string;
  title: string;
  prompt: string | null;
  starterFileUrl: string | null;
  resourceLinks: string[];
}

interface Props {
  task: TaskData;
  onComplete: (data?: Record<string, unknown>) => Promise<void>;
  alreadyCompleted: boolean;
}

export function FileUploadTask({ task, onComplete, alreadyCompleted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Upload failed');
      setUploading(false);
      return;
    }
    const { url } = await res.json();
    await onComplete({ fileUrl: url, fileName: file.name });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ File submitted</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>
        {task.prompt && <p className="text-white/70 leading-relaxed">{task.prompt}</p>}
      </div>

      {task.starterFileUrl && (
        <a
          href={task.starterFileUrl}
          download
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white hover:bg-white/10 transition-colors"
        >
          ⬇ Download starter file
        </a>
      )}

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/20 hover:border-white/30 bg-white/3'
        }`}
      >
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <p className="text-sm text-white">{file.name} <span className="text-white/40">({(file.size / 1024).toFixed(0)} KB)</span></p>
        ) : (
          <>
            <p className="text-white/60 text-sm mb-1">Drop your file here, or click to browse</p>
            <p className="text-white/30 text-xs">Max 20 MB</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {uploading ? 'Uploading…' : 'Submit File'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify manually**

Set `BLOB_READ_WRITE_TOKEN` in `.env.local`. Set a task to type `FILE_UPLOAD` in Prisma Studio. Navigate to its task page and upload a file. Confirm the file uploads and CompletionMoment appears.

- [ ] **Step 5: Commit**

```bash
git add app/(student)/student/quests/ app/api/upload/ package.json package-lock.json
git commit -m "feat: FileUploadTask with Vercel Blob upload and drag-and-drop"
```

---

## Task 9: SocraticTask

**Files:**
- Modify: `.../_components/SocraticTask.tsx`
- Create: `app/api/tasks/[taskId]/socratic/route.ts`

The SocraticTask is an AI back-and-forth chat. A new streaming endpoint accepts `learningObjective` and `messages`, keeps the dialogue going until the AI signals completion, then creates a `SocraticDialogue` record and the component calls `onComplete`.

- [ ] **Step 1: Verify `createInterviewStream` accepts a `tools` parameter**

Open `lib/ai/providers.ts` and read the `createInterviewStream` function signature. The Socratic route needs to pass a custom `tools` array (with a `mark_complete` tool) so the AI can signal completion.

- If `createInterviewStream` already accepts a `tools` option — proceed to Step 2.
- If it does **not** — extend the options type and pass `tools` through to both the Anthropic and OpenAI-compatible implementations before proceeding. For Anthropic (via `@anthropic-ai/sdk`), tools are passed as the `tools` array in the `messages.create` call. For OpenAI-compatible APIs, tools are passed as the `tools` array in the chat completions request body.

The normalized SSE format already handles `{"t":"tool","n":"...","i":{...}}` events, so the client-side parsing in `SocraticTask` will work once the provider passes the tool through.

- [ ] **Step 2: Create the Socratic API route**

Create `app/api/tasks/[taskId]/socratic/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/platformSettings';
import { createInterviewStream } from '@/lib/ai/providers';

export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { taskId } = await params;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { learningObjective: true, title: true },
  });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const settings = await getSettings();
  if (!settings.aiApiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const systemPrompt = `You are a Socratic tutor helping a student understand: "${task.learningObjective ?? task.title}".

Your role:
- Ask probing questions rather than giving answers
- Challenge assumptions and ask "why" and "how do you know"
- Correct misconceptions gently with questions
- When the student demonstrates clear understanding, emit the tool call "mark_complete" with a brief summary

Do NOT give the answer directly. Guide the student to discover it themselves.`;

  const stream = await createInterviewStream({
    provider: settings.aiProvider ?? 'anthropic',
    model: settings.aiModel ?? 'claude-sonnet-4-6',
    apiKey: settings.aiApiKey,
    baseUrl: settings.aiBaseUrl ?? undefined,
    systemPrompt,
    messages: parsed.data.messages,
    tools: [{
      name: 'mark_complete',
      description: 'Call this when the student has demonstrated sufficient understanding of the learning objective.',
      input_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Brief summary of what the student demonstrated' },
        },
        required: ['summary'],
      },
    }],
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
```

- [ ] **Step 2: Implement SocraticTask**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TaskData {
  id: string;
  title: string;
  prompt: string | null;
  learningObjective: string | null;
}

interface Props {
  task: TaskData;
  onComplete: (data?: Record<string, unknown>) => Promise<void>;
  alreadyCompleted: boolean;
  submissionId: string;
  userId: string;
}

export function SocraticTask({ task, onComplete, alreadyCompleted }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(userMessage?: string) {
    const content = userMessage ?? input.trim();
    if (!content || streaming) return;
    setInput('');
    setStreaming(true);
    setError('');

    const newMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(newMessages);

    try {
      const res = await fetch(`/api/tasks/${task.id}/socratic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) {
        setError('AI unavailable. Try again.');
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let completeSummary: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6);
          if (json === '[DONE]') continue;
          try {
            const event = JSON.parse(json);
            if (event.t === 'text') {
              assistantText += event.v;
              setMessages([...newMessages, { role: 'assistant', content: assistantText }]);
            } else if (event.t === 'tool' && event.n === 'mark_complete') {
              completeSummary = event.i?.summary ?? 'Understanding demonstrated';
            }
          } catch {}
        }
      }

      if (assistantText) {
        setMessages([...newMessages, { role: 'assistant', content: assistantText }]);
      }

      if (completeSummary !== null) {
        await onComplete({ transcript: [...newMessages, { role: 'assistant', content: assistantText }], summary: completeSummary });
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setStreaming(false);
    }
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ Socratic dialogue complete</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white mb-1">{task.title}</h1>
        {task.prompt && <p className="text-white/60 text-sm">{task.prompt}</p>}
      </div>

      {!started ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-white/60 text-sm max-w-sm">
              The AI will guide you through this topic with questions. Answer honestly — the goal is understanding, not a perfect response.
            </p>
            <button
              onClick={() => { setStarted(true); sendMessage('Hello, I\'m ready to start.'); }}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
            >
              Start Dialogue
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 border border-white/10 text-white/90'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <span className="text-white/40 text-xs animate-pulse">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="text-sm text-red-400 mb-2">{error}</p>}

          <div className="flex gap-2 mt-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Your response..."
              disabled={streaming}
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={streaming || !input.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

Set a task to type `SOCRATIC` with a `learningObjective` in Prisma Studio. Navigate to the task page. Confirm dialogue starts, AI responds, and completion fires when AI calls `mark_complete`.

- [ ] **Step 4: Commit**

```bash
git add app/(student)/student/quests/ app/api/tasks/
git commit -m "feat: SocraticTask with streaming AI dialogue and completion detection"
```

---

## Task 10: PeerBoardTask

**Files:**
- Modify: `.../_components/PeerBoardTask.tsx`

The student writes their solution/take and posts it to the bulletin board. Posting IS the completion act. This component posts to the existing board mechanism and then calls `onComplete`.

- [ ] **Step 1: Understand existing board posting**

Read `components/student/board/PostToBoardButton.tsx` to see the API it calls. The `PEER_BOARD` task will call the same mechanism but from the task page, before submission.

The key difference: the existing `PostToBoardButton` sets `Submission.postedToBoard = true`. For `PEER_BOARD` tasks, we post at task level and pass the post reference in `completionData`.

- [ ] **Step 2: Implement PeerBoardTask**

```typescript
'use client';

import { useState } from 'react';

interface TaskData {
  id: string;
  title: string;
  prompt: string | null;
  resourceLinks: string[];
}

interface Props {
  task: TaskData;
  onComplete: (data?: Record<string, unknown>) => Promise<void>;
  alreadyCompleted: boolean;
  assignmentId: string;
}

export function PeerBoardTask({ task, onComplete, alreadyCompleted }: Props) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handlePost() {
    if (!content.trim()) return;
    setSaving(true);
    setError('');

    // Post to board — reuses the submission board mechanism
    // The content is stored as the completion data; full board integration
    // (public board display) is a follow-up task.
    await onComplete({ boardPost: content });
  }

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <p className="text-emerald-400 font-semibold">✓ Posted to board</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>
        {task.prompt && <p className="text-white/70 leading-relaxed">{task.prompt}</p>}
      </div>

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
        <p className="text-xs text-indigo-300/70">
          Share your genuine thinking — there's more value in an honest attempt than a polished answer.
        </p>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your solution, approach, or findings..."
        rows={8}
        className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handlePost}
        disabled={saving || !content.trim()}
        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {saving ? 'Posting…' : 'Post to Board'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(student)/student/quests/
git commit -m "feat: PeerBoardTask posts response to board as task completion act"
```

---

## Task 11: Teacher — scenarioText Field

**Files:**
- Modify: `components/teacher/AssignmentForm.tsx`
- Modify: `app/api/assignments/route.ts` (POST)
- Modify: `app/api/assignments/[assignmentId]/route.ts` (GET + PATCH)

Add the `scenarioText` field to the assignment creation and editing flow.

- [ ] **Step 1: Add scenarioText state to AssignmentForm**

In `components/teacher/AssignmentForm.tsx`, add to the state block (after `const [brief, setBrief]`):
```typescript
const [scenarioText, setScenarioText] = useState(defaultValues?.scenarioText ?? '');
```

Add `scenarioText?: string` to the Props `defaultValues` type.

- [ ] **Step 2: Add scenarioText to the Zod schema in AssignmentForm**

```typescript
const assignmentSchema = z.object({
  // ... existing fields ...
  scenarioText: z.string().optional(),
});
```

- [ ] **Step 3: Add the form field**

In the form JSX, after the `brief` textarea, add:

```tsx
{/* Scenario text */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Scenario <span className="text-gray-400 font-normal text-xs">(student-facing mission context)</span>
  </label>
  <textarea
    value={scenarioText}
    onChange={(e) => setScenarioText(e.target.value)}
    placeholder="You've been hired as a data analyst at a retail chain. Their sales dropped 15% this quarter. Use the data to find out why."
    rows={4}
    className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
  />
  <p className="text-xs text-gray-400 mt-1">Sets the real-world context shown to students in the quest lobby.</p>
</div>
```

- [ ] **Step 4: Include scenarioText in the PATCH/POST payload**

In the `handleSubmit` function, include `scenarioText` in the body sent to the API.

- [ ] **Step 5: Update API routes to handle scenarioText**

In `app/api/assignments/route.ts` (POST) and `app/api/assignments/[assignmentId]/route.ts` (PATCH), add `scenarioText: z.string().optional()` to the Zod schema and include it in the `prisma.assignment.create/update` data object.

In the GET route, ensure `scenarioText` is included in the select/return.

- [ ] **Step 6: Verify manually**

Create a new assignment with a scenario text. Confirm it appears in the quest lobby for a student.

- [ ] **Step 7: Commit**

```bash
git add components/teacher/ app/api/assignments/
git commit -m "feat: add scenarioText field to assignment form and API"
```

---

## Task 12: Teacher — TaskBuilder Extended Fields

**Files:**
- Modify: `components/teacher/TaskBuilder.tsx`

Add the new fields: `prompt`, `isOptional`, `learningObjective` (for SOCRATIC), `guidedQuestions` builder (for GUIDED_QUESTIONS), `starterFileUrl` (for FILE_UPLOAD).

- [ ] **Step 1: Extend TaskDraft interface**

In `components/teacher/TaskBuilder.tsx`, extend `TaskDraft`:

```typescript
export interface TaskDraft {
  title:              string;
  taskType:           TaskType;
  estimatedMins:      number;
  pointValue:         number;
  unlocksAfterIndex:  number | null;
  // New fields
  prompt:             string;
  isOptional:         boolean;
  learningObjective:  string;
  guidedQuestions:    { question: string; hint: string }[];
  starterFileUrl:     string;
}
```

- [ ] **Step 2: Add new task types to TASK_TYPES and TYPE_LABELS**

```typescript
type TaskType =
  | 'STUDY' | 'RESEARCH' | 'WRITING' | 'REVIEW'
  | 'QUIZ'  | 'PRACTICE' | 'REFLECTION' | 'PEER_REVIEW' | 'SOCRATIC'
  | 'GUIDED_QUESTIONS' | 'FILE_UPLOAD' | 'PEER_BOARD';

const TYPE_LABELS: Record<TaskType, string> = {
  // ... existing ...
  GUIDED_QUESTIONS: 'Guided questions',
  FILE_UPLOAD:      'File upload',
  PEER_BOARD:       'Peer board',
};
```

Also update `EMPTY_TASK`:
```typescript
const EMPTY_TASK: TaskDraft = {
  title:             '',
  taskType:          'STUDY',
  estimatedMins:     30,
  pointValue:        20,
  unlocksAfterIndex: null,
  prompt:            '',
  isOptional:        false,
  learningObjective: '',
  guidedQuestions:   [],
  starterFileUrl:    '',
};
```

- [ ] **Step 3: Add per-task fields to the task card JSX**

After the existing Row 2 (type/mins/points/unlocks), add a Row 3 with the common fields and type-specific fields:

```tsx
{/* Row 3: prompt */}
<textarea
  value={task.prompt}
  onChange={(e) => update(i, 'prompt', e.target.value)}
  placeholder="Challenge description shown to the student..."
  rows={2}
  className="w-full px-2.5 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
/>

{/* Row 4: optional toggle */}
<label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
  <input
    type="checkbox"
    checked={task.isOptional}
    onChange={(e) => update(i, 'isOptional', e.target.checked)}
    className="rounded"
  />
  Optional (exploration branch)
</label>

{/* Type-specific fields */}
{task.taskType === 'SOCRATIC' && (
  <input
    value={task.learningObjective}
    onChange={(e) => update(i, 'learningObjective', e.target.value)}
    placeholder="Learning objective (guides AI dialogue)..."
    className="w-full px-2.5 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
  />
)}

{task.taskType === 'FILE_UPLOAD' && (
  <input
    value={task.starterFileUrl}
    onChange={(e) => update(i, 'starterFileUrl', e.target.value)}
    placeholder="Starter file URL (optional)..."
    className="w-full px-2.5 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
  />
)}

{task.taskType === 'GUIDED_QUESTIONS' && (
  <div className="space-y-2">
    <p className="text-xs font-medium text-gray-600">Questions</p>
    {task.guidedQuestions.map((q, qi) => (
      <div key={qi} className="flex gap-2 items-start">
        <div className="flex-1 space-y-1">
          <input
            value={q.question}
            onChange={(e) => {
              const next = [...task.guidedQuestions];
              next[qi] = { ...next[qi], question: e.target.value };
              update(i, 'guidedQuestions', next);
            }}
            placeholder={`Question ${qi + 1}...`}
            className="w-full px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            value={q.hint}
            onChange={(e) => {
              const next = [...task.guidedQuestions];
              next[qi] = { ...next[qi], hint: e.target.value };
              update(i, 'guidedQuestions', next);
            }}
            placeholder="Hint (optional)..."
            className="w-full px-2 py-1 text-xs text-gray-400 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="button"
          onClick={() => update(i, 'guidedQuestions', task.guidedQuestions.filter((_, j) => j !== qi))}
          className="text-gray-300 hover:text-red-500 text-lg leading-none mt-0.5"
        >×</button>
      </div>
    ))}
    <button
      type="button"
      onClick={() => update(i, 'guidedQuestions', [...task.guidedQuestions, { question: '', hint: '' }])}
      className="text-xs text-indigo-600 hover:text-indigo-800"
    >+ Add question</button>
  </div>
)}
```

- [ ] **Step 4: Update `app/api/tasks/route.ts` Zod schema and Prisma write**

Open `app/api/tasks/route.ts`. The existing `taskDraftSchema` has a hardcoded `z.enum` with the 9 old task types. New fields are silently stripped if not added here. Make these exact changes:

**Zod schema** — replace the `taskType` enum and add new fields:
```typescript
const taskDraftSchema = z.object({
  title:             z.string().min(1),
  taskType:          z.enum([
    'STUDY', 'RESEARCH', 'WRITING', 'REVIEW', 'QUIZ',
    'PRACTICE', 'REFLECTION', 'PEER_REVIEW', 'SOCRATIC',
    'GUIDED_QUESTIONS', 'FILE_UPLOAD', 'PEER_BOARD',
  ]),
  estimatedMins:     z.number().int().positive(),
  pointValue:        z.number().int().positive(),
  unlocksAfterIndex: z.number().int().nullable(),
  // New fields
  prompt:            z.string().optional(),
  isOptional:        z.boolean().optional(),
  learningObjective: z.string().optional(),
  guidedQuestions:   z.array(z.object({ question: z.string(), hint: z.string() })).optional(),
  starterFileUrl:    z.string().optional(),
});
```

**Prisma write** — wherever tasks are created/upserted, include the new fields:
```typescript
prompt:            t.prompt            || null,
isOptional:        t.isOptional        ?? false,
learningObjective: t.learningObjective || null,
guidedQuestions:   t.guidedQuestions   ?? [],
starterFileUrl:    t.starterFileUrl    || null,
resourceLinks:     [],  // managed separately in the future
```

- [ ] **Step 5: Verify manually**

Create a task with type `GUIDED_QUESTIONS` and add two questions. Save. Check in Prisma Studio that `guidedQuestions` JSON is saved correctly.

- [ ] **Step 6: Commit**

```bash
git add components/teacher/ app/api/tasks/
git commit -m "feat: extend TaskBuilder with prompt, optional flag, and type-specific fields"
```

---

## Task 13: Final Verification + Cleanup

- [ ] **Step 1: Run a full build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any reported issues.

- [ ] **Step 3: End-to-end smoke test**

As a teacher:
1. Create a new assignment with `scenarioText`
2. Add one task of each type with a `prompt`
3. Save

As a student:
1. Open the assignment → confirm lobby shows scenario, progress ring, "Start Quest" button
2. Click "Start Quest" → confirm task page loads with scenario anchor strip and breadcrumb
3. Complete a REFLECTION task → confirm CompletionMoment appears, "Continue" navigates to next task
4. Complete a GUIDED_QUESTIONS task → confirm questions unlock one at a time
5. Complete all tasks → confirm submission is auto-created in Prisma Studio

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete student learning journey — scenario lobby, task pages, all task types"
```

---

## Notes for Implementer

- **No automated tests exist** in this project. Verification is always manual via `npm run dev` + Prisma Studio.
- **Task type components are independent** once the TaskShell is built. They can be shipped one at a time.
- **File uploads require `BLOB_READ_WRITE_TOKEN`** in `.env.local` and Vercel Blob configured in the Vercel dashboard.
- **SocraticTask requires AI configured** in Platform Settings (Admin → Settings → AI Provider).
- The `TaskRow` checkbox component is still used on the student **dashboard** (daily tasks) — do NOT remove it. It is only removed from the quest lobby.
- Optional tasks are surfaced on the CompletionMoment after a required task completes. The `nextTaskId` passed to CompletionMoment only covers required tasks; optional tasks can be browsed from the lobby (future enhancement).
