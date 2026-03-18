# Student Learning Journey — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Problem Statement

The current student experience reduces learning to a checklist: tick a task checkbox, fill in a markdown form, submit. There is no real engagement, no curiosity trigger, and no proof of actual understanding. Students go through the motions rather than doing the work.

## Goal

Transform every assignment into a curiosity-driven journey. Students land in a real-world scenario, work through challenges one at a time, and prove understanding through doing — not reporting.

---

## Design

### 1. The Quest Overview Page ("the lobby")

The existing flat task-list page is replaced with a scenario-first lobby.

**Layout:**
1. **Scenario banner** — rich text describing the real-world situation (e.g., *"You've been hired as a data analyst at a retail chain. Their sales dropped 15% this quarter. Find out why."*)
2. **Progress ring** — percentage of required tasks completed
3. **Single CTA** — "Start Quest" (first visit) or "Continue Quest" (returning)
4. **Next task teaser** — title and task type badge only; full content is on the task page
5. **Completed tasks log** — collapsed summary of finished tasks; read-only

The full task list is no longer shown upfront. Students see only what they've done and what's immediately next.

---

### 2. Task Pages (full immersion)

Route: `/student/quests/[assignmentId]/tasks/[taskId]`

Each task lives on its own dedicated page. Three zones:

**Top — Scenario anchor strip**
A compact, persistent reminder of the overarching scenario. Always visible, never dominant.

**Middle — The Challenge**
Task-type-specific interactive UI:

| Task Type | Student Experience |
|---|---|
| `GUIDED_QUESTIONS` | Sequential questions that unlock one at a time. Each answer must be submitted before the next question appears. |
| `SOCRATIC` | Back-and-forth AI chat. The AI challenges thinking, asks "why", refuses to give answers directly. Ends when the AI judges sufficient understanding. Uses existing `SocraticDialogue` infrastructure. |
| `FILE_UPLOAD` | Clear instructions, optional downloadable starter file, drag-and-drop upload zone. |
| `PEER_BOARD` | Student writes their solution/take, posts to the bulletin board. Can browse classmates' posts. |
| `RESEARCH` | Open-ended prompt with optional resource links. Student submits written findings. |
| `REFLECTION` | Short introspective prompts. Low-stakes, no wrong answer. |

**Bottom — Completion gate**
Completion is triggered by the act of doing, not a manual checkbox:
- GUIDED_QUESTIONS: all questions answered
- SOCRATIC: AI signals understanding reached
- FILE_UPLOAD: file successfully uploaded
- PEER_BOARD: post submitted
- RESEARCH / REFLECTION: response submitted

---

### 3. Progressive Reveal & Navigation

**Task entry:** "Start Quest" / "Continue Quest" navigates directly to the current task. No choice required.

**Task completion moment:** On finishing a task, the student sees a brief animated screen with:
- Summary of what they accomplished
- XP earned
- Teaser for the next task
- A single "Continue" button navigating to the next task

**Optional exploration tasks:** After completing a required task, optional branches are surfaced: *"Want to go deeper? [Explore bonus challenge]"* — skip or take, no consequence either way.

**Navigation:**
- Breadcrumb: `Quest → [Assignment title] → Task 2 of 5`
- Back arrow returns to the quest lobby (not to a previous task)
- Completed tasks are read-only summaries; they cannot be redone by default

**Automatic submission:** When all required tasks are completed, the submission is compiled automatically from `TaskCompletion.completionData` records. The manual "Submit Work" markdown box is removed entirely.

---

### 4. Teacher Authoring

**Assignment level changes:**
- `scenarioText` — rich text field for the real-world scenario framing (replaces or extends current `brief`)

**Task level changes (significantly expanded):**
- `prompt` — the challenge description shown to the student; rich text
- `starterFileUrl` — downloadable template/dataset for FILE_UPLOAD tasks
- `resourceLinks` — array of optional reference URLs
- `isOptional` — marks task as an exploration branch
- `guidedQuestions` — structured JSON array of `{question, hint}` for GUIDED_QUESTIONS tasks
- `learningObjective` — for SOCRATIC tasks; the AI uses this to guide the dialogue and judge completion

**AI-assisted authoring:** AI-assisted scenario/task authoring (extending `AIInterviewChat`) is out of scope for this iteration. Teachers author scenario text and task prompts manually via form fields.

---

### 5. Data Model Changes

**Enum migration — `TaskType`:**
Three new values must be added to the existing `TaskType` enum (which currently has `STUDY`, `RESEARCH`, `WRITING`, `REVIEW`, `QUIZ`, `PRACTICE`, `REFLECTION`, `PEER_REVIEW`, `SOCRATIC`):
```
GUIDED_QUESTIONS  // sequential unlocking questions
FILE_UPLOAD       // student uploads a file artifact
PEER_BOARD        // student posts to the bulletin board as the act of completing
```

**Schema additions:**

```prisma
// Assignment
scenarioText  String?   // rich scenario description (replaces/extends brief)

// Task (additions)
prompt            String?   // challenge description for student
starterFileUrl    String?   // downloadable file for FILE_UPLOAD tasks
resourceLinks     String[]  // optional reference URLs
isOptional        Boolean   @default(false)
guidedQuestions   Json?     // [{question: string, hint: string}]
learningObjective String?   // for SOCRATIC tasks; guides AI and signals completion

// TaskCompletion (addition)
completionData    Json?     // answers, file URL, transcript ref, board post ID, etc.

// SocraticDialogue (schema extension)
// Currently scoped to a Submission. SOCRATIC task types need one dialogue per task,
// not one per submission. Add a nullable taskId FK so a dialogue can be scoped to a
// specific task. Existing submission-level dialogues remain valid (taskId = null).
taskId  String?   // null = submission-level (existing); set = task-level SOCRATIC task
```

**Completion endpoint:**
Task pages call the canonical `POST /api/completions` endpoint (awards XP, updates streak, runs `checkAchievements`). The existing `POST /api/tasks/[taskId]/complete` legacy route is left unchanged. The `/api/completions` endpoint is extended to accept an optional `completionData` payload that is written to `TaskCompletion.completionData`.

**Automatic submission trigger:**
After each call to `/api/completions`, the server checks whether all required tasks for the assignment are now complete. If so, it automatically upserts the `Submission` record to `SUBMITTED` status, compiling `completionData` from all `TaskCompletion` records. This check runs server-side inside the completions endpoint — no separate client action required.

**PEER_BOARD task flow:**
`PEER_BOARD` tasks have their own post mechanism wired into task completion. When the student submits their board post from the task page, the post is created and `/api/completions` is called with the resulting post ID in `completionData`. The existing `PostToBoardButton` (which operates on the `Submission` record after submission) is a separate feature and remains unchanged.

**New files:**
- `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/page.tsx` — task page (server component)
- Task type client components under `app/(student)/student/quests/[assignmentId]/tasks/[taskId]/_components/`:
  - `GuidedQuestionsTask.tsx`
  - `SocraticTask.tsx`
  - `FileUploadTask.tsx`
  - `PeerBoardTask.tsx`
  - `ResearchTask.tsx`
  - `ReflectionTask.tsx`

**Removed / replaced:**
- `SubmitWorkPanel` — replaced by automatic submission on task completion
- Checkbox-driven `TaskRow` on the quest lobby — replaced by the new lobby layout

**Unchanged:**
- AI grading, feedback, and release flow
- Existing `SocraticDialogue` model and infrastructure (reused for SOCRATIC tasks)
- XP, achievements, streaks (canonical `/api/completions` endpoint, extended as above)
- Theme system and vocabulary substitution
- `PostToBoardButton` on the quest lobby (post-submission peer sharing, separate from `PEER_BOARD` task type)
- Teacher grading queue and `FeedbackPanel`

---

## Out of Scope

- Changing the grading or feedback system
- Changing authentication or role system
- Redesigning the teacher assignment creation flow beyond the task field additions noted above
- Implementing all task types simultaneously — types can be shipped incrementally
- AI-assisted scenario/task authoring (extending `AIInterviewChat`)

---

## Success Criteria

- A student opening an assignment sees a scenario and a single "Start" button — no raw task list
- Each task type has a dedicated, interactive page UI
- Completing a task happens through doing the work, not ticking a checkbox
- Submission is automatic; no separate submission form required
- Teachers can author scenario text and per-task prompts, files, and learning objectives
