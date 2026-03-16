# Cursus — Step-by-Step Build Guide

This guide turns the build prompt into a sequenced construction plan. Each phase
produces something testable before you move on. The build prompt remains the source
of truth for all design decisions — this guide tells you the order and how to
execute each step with Claude Code.

## How to use this with Claude Code

Each step includes a **Claude Code instruction** block. Feed it the indicated
section(s) from the build prompt as context. Keep instructions to one file or
concern at a time. Review the generated code before accepting — it will
occasionally drift from the spec.

A useful framing line to open every session with:
> "I am building an educational platform called Cursus. Here is the relevant
> section of my build specification. Follow it precisely."

---

## Important: Architecture Decisions

### Auth Strategy — NextAuth as Session Provider

This project uses **NextAuth** as the sole session provider. Supabase is used only
as a PostgreSQL database — not for its Auth service. This means:

- All login/session logic goes through NextAuth with the Prisma adapter
- Magic link emails are sent via Resend (configured as NextAuth's email provider)
- Supabase Auth features (`auth.uid()`, Supabase RLS with session context) are
  **not used at runtime**. RLS policies use the `SUPABASE_SERVICE_ROLE_KEY` to
  bypass RLS from server-side code, and all access control is enforced via
  `requireRole()` in Next.js server components and API routes
- The Supabase dashboard's Auth settings (magic link, SMTP) are not needed —
  Resend is configured directly in the NextAuth email provider

**Why:** using both NextAuth and Supabase Auth creates a dual-session problem
where `auth.uid()` in RLS policies won't match the NextAuth session. A single
session provider keeps things clean. NextAuth gives us full control over
callbacks, role injection, and redirect logic.

### Schema Evolution

Whenever a step says "add a field via Prisma migration", run:
```bash
npx prisma db push
npx prisma generate
```
This applies to any schema change after Phase 1, including the
`reflectionQuestions` field in Phase 11. If you are on a team or have production
data, use `npx prisma migrate dev` instead of `db push`.

### Vercel Streaming Configuration

Any API route that streams responses from the Anthropic API (mentor, Socratic,
AI interview) **must** export a duration config to avoid Vercel's default
10-second serverless timeout:

```typescript
export const maxDuration = 60; // seconds — keeps the Node.js runtime
```

**Do NOT use `export const runtime = 'edge'`** on any route that imports
Prisma Client — Prisma requires the Node.js runtime. Since most AI routes
fetch context from the database before calling Anthropic, `maxDuration` is
the correct approach. On Vercel's Hobby plan `maxDuration` caps at 60 s;
Pro plan allows up to 300 s.

Add this to every streaming route: `/api/mentor`, `/api/ai/socratic`,
`/api/ai/interview`, `/api/ai/generate`, `/api/ai/grade`,
`/api/ai/reflect`, `/api/ai/synthesize-reviews`.

### AI Route Error Handling

All AI API routes must include:
1. A try/catch around the Anthropic API call
2. Safe JSON parsing with a fallback (the AI may include preamble text)
3. A meaningful error response (500 with `{ error: 'AI generation failed' }`)
4. For grading routes: if JSON parsing fails, set `AIFeedback.confidenceLevel`
   to 0.0 and flag for manual teacher review rather than crashing

Apply this pattern to: `/api/ai/grade`, `/api/ai/socratic`, `/api/ai/reflect`,
`/api/ai/synthesize-reviews`, `/api/mentor`.

---

## Phase 0 — Project Scaffolding
*Goal: a running Next.js app connected to Supabase, deployed to Vercel, with
nothing broken.*

### Step 0.1 — Initialise the repo

Do this manually, not via Claude Code.

```bash
npx create-next-app@latest cursus \
  --typescript --tailwind --eslint --app --src-dir=false
cd cursus
git init && git remote add origin https://github.com/Nibbl3s/cursus.git
```

### Step 0.2 — Install core dependencies

```bash
npm install @prisma/client prisma @supabase/supabase-js next-auth @auth/prisma-adapter @auth/core resend @anthropic-ai/sdk react-markdown @uiw/react-md-editor zod date-fns clsx tailwind-merge
```

> **Note on NextAuth v5:** if using NextAuth v5 (beta), the package name is
> `next-auth@beta` and the adapter is `@auth/prisma-adapter`. Check the
> [NextAuth docs](https://authjs.dev) for the latest import paths — v5 uses
> `import NextAuth from "next-auth"` instead of `next-auth/next`.

> **Note:** `@uiw/react-md-editor` is the markdown *editor* (used in teacher
> forms). `react-markdown` is the markdown *renderer* (used in student views to
> display briefs and feedback). Both are needed.

### Step 0.3 — Folder structure

Create these empty folders now so generated files land in the right places:

```bash
mkdir -p "app/(auth)" "app/(teacher)" "app/(student)" "app/(admin)" app/api
mkdir -p "lib/themes" "lib/auth" "lib/ai"
mkdir -p "components/student/board" "components/teacher" "components/admin" "components/shared"
mkdir -p prisma
```

> **Shell note:** parentheses in directory names must be quoted to avoid shell
> globbing. The brace expansion `{(auth),(teacher)}` fails in many shells.

### Step 0.4 — Environment variables

Create `.env.local` with all keys from the build prompt's **Environment Variables**
section. Fill in real values from Supabase, Resend, and Anthropic dashboards.
Add `.env.local` to `.gitignore` immediately.

### Step 0.5 — Deploy empty app to Vercel

Connect the GitHub repo to Vercel now. Add all env vars in the Vercel dashboard.
Confirm a successful empty deployment before writing any feature code. This
validates your environment end-to-end early, when it's cheap to debug.

**Checkpoint:** `https://your-project.vercel.app` loads the Next.js default page.

---

## Phase 1 — Database Schema
*Goal: all tables exist in Supabase, Prisma client generates without errors.*

### Step 1.1 — Write the Prisma schema

**Context:** paste the entire **Database Schema** section from the build
prompt.

**Instruction:**
> "Generate the complete `prisma/schema.prisma` file from this schema specification.
> Use `postgresql` as the provider. Include `directUrl` for migrations alongside
> `url`. Do not add any models or fields not in the spec. Pay attention to all
> `@relation` directives — in particular: `Course.teacher` relates to `User`,
> `Habit.user` relates to `User`, and `PeerReview.reviewer` relates to `User`
> (not to Submission). The `User` model has `peerReviewsGiven PeerReview[]`,
> `courses Course[]`, and `habits Habit[]` relations."

Review the output carefully against the spec. The models to confirm are present:
User, Profile, Course, Enrollment, Assignment, Rubric, RubricCriterion,
AnchorSubmission, PeerReviewConfig, Task, TaskCompletion, Submission,
SelfAssessment, SocraticDialogue, PeerReview, ReviewerCalibration, AIFeedback,
Habit, HabitCompletion, Achievement, KnowledgeBase, AIGenerationJob.

**Key relations to verify:**
- `Course.teacher → User` (foreign key on `teacherId`)
- `Habit.user → User` (foreign key on `userId`)
- `PeerReview.reviewer → User` (foreign key on `reviewerUserId`)
- `User.peerReviewsGiven → PeerReview[]` (not on Submission)
- `Submission.peerReviewsReceived → PeerReview[]` via `@relation("reviewee")`

### Step 1.2 — Push schema to Supabase

```bash
npx prisma generate
npx prisma db push
```

Fix any Prisma validation errors before continuing. Common issues: missing
`@relation` names on self-referencing models, enum values not matching.

### Step 1.3 — Seed the first admin

```sql
-- Run after your first magic-link signup
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

> **Note on RLS:** since this project uses NextAuth (not Supabase Auth) for
> sessions, all database access goes through Prisma using the service role
> connection string. RLS policies are not enforced at runtime — access control
> is handled by `requireRole()` in Next.js. You can optionally add RLS policies
> as a defence-in-depth measure using the SQL from the build prompt's
> **Updated Supabase RLS Policies** section, but they are not required for the
> app to function.

**Checkpoint:** Supabase Table Editor shows all tables. Prisma Studio
(`npx prisma studio`) shows all models.

---

## Phase 2 — Authentication
*Goal: magic link login works, role-based redirect works, session is accessible
server-side.*

### Step 2.1 — NextAuth configuration

**Context:** paste the **Tech Stack** section and the auth portion of the
**App Structure** section (the `api/auth` route and the `lib/auth/requireRole.ts`
file).

**Instruction:**
> "Generate `app/api/auth/[...nextauth]/route.ts` using the Prisma adapter and
> the Resend email provider for magic link login. The session must include the
> user's `role` field from the User model (extend the session callback).
> On sign-in, if no Profile exists for this user, create one with default values
> (`themeId: 'medieval'`, `totalPoints: 0`, `level: 1`, `currentStreak: 0`,
> `bestStreak: 0`). After sign-in, redirect based on role:
> ADMIN → `/admin/dashboard`, TEACHER → `/teacher/dashboard`,
> STUDENT → `/student/dashboard`."

### Step 2.2 — requireRole guard

**Instruction:**
> "Generate `lib/auth/requireRole.ts` exactly as specified. The hierarchy is
> STUDENT = 0, TEACHER = 1, ADMIN = 2. Redirect to `/login` if no session,
> `/unauthorized` if insufficient role."

### Step 2.3 — Login page

**Instruction:**
> "Generate `app/(auth)/login/page.tsx` — a simple magic link request form.
> POST the email to NextAuth's email provider. Show a confirmation message after
> submission. No password field. Use Tailwind for styling."

### Step 2.4 — Verify page and unauthorized page

**Instruction:**
> "Generate `app/(auth)/verify/page.tsx` — shown after clicking the magic link
> email, confirms the user is being signed in. Generate
> `app/unauthorized/page.tsx` — shown when a user accesses a route above their
> role level."

**Checkpoint:** sign up with your email, receive the magic link, click it, land
on the correct dashboard for your role. Check that `requireRole('ADMIN')` in a
test server component redirects correctly for a STUDENT session.

---

## Phase 3 — Theme System
*Goal: ThemeProvider works, CSS variables inject correctly, useTheme hook returns
vocabulary, three themes are complete.*

### Step 3.1 — Theme types and registry

**Context:** paste the entire **Theme System** section from the build
prompt including the `WorldTheme` interface and all three bundled theme
descriptions. **Important:** paste the full theme descriptions (palette colors,
vocabulary words, CSS class names) so Claude can generate complete theme objects
rather than placeholders.

**Instruction:**
> "Generate `lib/themes/types.ts` with the `WorldTheme` interface exactly as
> specified. Then generate `lib/themes/medieval.ts`, `lib/themes/space.ts`, and
> `lib/themes/cyber.ts` as complete theme objects implementing this interface.
> Fill in every field — palette hex values, all vocabulary entries, daily quotes
> array (at least 5 quotes per theme), mentor avatar emoji, and CSS theme class.
> Then generate `lib/themes/index.ts` that exports a `themes` record keyed by
> theme ID."

### Step 3.2 — ThemeProvider component

**Context:** paste the **Theme Provider — How It Works** section.

**Instruction:**
> "Generate `components/student/ThemeProvider.tsx` exactly as specified. The
> provider must inject CSS variables from `theme.palette` as inline styles and
> apply `theme.cssTheme` as a className. Export `useTheme` hook."

### Step 3.3 — Wire ThemeProvider into the student layout

**Instruction:**
> "Generate `app/(student)/layout.tsx`. It must be a server component that fetches
> the current user's `themeId` from their Profile using Prisma, then passes it to
> `ThemeProvider` which wraps all children. Call `requireRole('STUDENT')` at the
> top."

**Checkpoint:** add a temporary test component that calls `useTheme()` and renders
`theme.vocabulary.assignment`. Switch your profile's `themeId` in Prisma Studio
between `medieval`, `space`, and `cyber` and confirm the word changes on reload.

---

## Phase 4 — Teacher: Courses and Assignments
*Goal: a teacher can create a course, edit it, create an assignment with tasks,
create a rubric, and invite students.*

### Step 4.1 — Teacher layout and dashboard shell

**Context:** the teacher routes from the **App Structure** section and
the **Teacher Dashboard** description from **Teacher Dashboard vs Student
Dashboard**.

**Instruction:**
> "Generate `app/(teacher)/layout.tsx` — calls `requireRole('TEACHER')`, renders
> a neutral sidebar nav with links to: Dashboard, Courses, Settings. No theme,
> no gamification. Then generate `app/(teacher)/dashboard/page.tsx` — fetches all
> courses owned by the current teacher and renders `CourseCard` components showing
> name, code, color swatch, enrollment count, and next deadline."

### Step 4.2 — CourseCard and ColorPicker components

**Context:** component descriptions from the **App Structure** section,
plus the color palette list from **Course Color System**.

**Instruction:**
> "Generate `components/teacher/CourseCard.tsx` — displays course name, code,
> color swatch (a small circle), enrollment count, active assignment count, and
> next deadline. Clicking the card navigates to `/teacher/courses/[courseId]`.
> Then generate `components/teacher/ColorPicker.tsx` — renders 12 colored circles
> as a palette selector. The 12 hex values are listed in the build spec's Course
> Color System section."

### Step 4.3 — Course creation and editing

**Instruction:**
> "Generate `app/api/courses/route.ts` — POST creates a new Course owned by the
> current teacher (from session), GET returns all courses for the current teacher.
> Generate `app/api/courses/[courseId]/route.ts` — GET returns single course,
> PATCH updates name/code/description/color (teacher must own the course).
> Validate with Zod: name (required), code (required), description (optional),
> color (must be one of the 12 preset hex values). Then generate
> `app/(teacher)/courses/page.tsx` with a course list and a '+ New Course' button
> that opens a form using `ColorPicker`. Then generate
> `app/(teacher)/courses/[courseId]/edit/page.tsx` — a form pre-filled with the
> course's current values, PATCHes on save."

### Step 4.4 — Assignment creation — Manual mode

**Context:** the Manual Form description from **Assignment & Knowledge
Base Creation — Three Modes**.

**Instruction:**
> "Generate `components/teacher/AssignmentForm.tsx` — fields: title, brief
> (use `@uiw/react-md-editor`), dueDate, weight (0–100), difficulty (select:
> EASY/MEDIUM/HARD/BOSS), pointValue, assessmentMode (select from the
> AssessmentMode enum). All fields validated with Zod on submit.
> Then generate `app/api/assignments/route.ts` — POST creates an Assignment under
> the given courseId. Teacher must own the course (verify server-side).
> Generate `app/api/assignments/[assignmentId]/route.ts` — GET returns single
> assignment, PATCH updates fields (teacher must own the parent course).
> Then generate `app/(teacher)/courses/[courseId]/assignments/new/page.tsx`
> rendering `AssignmentCreationHub` with only the Manual tab active for now.
> Then generate `app/(teacher)/courses/[courseId]/assignments/[assignmentId]/edit/page.tsx`
> — a form pre-filled with the assignment's current values, PATCHes on save."

### Step 4.5 — Rubric builder

**Instruction:**
> "Generate `components/teacher/RubricBuilder.tsx` — an ordered list of criterion
> inputs, each with: label, description, maxScore. Criteria can be added, removed,
> and reordered. On save, POST to `app/api/rubric/route.ts` which creates the
> Rubric and RubricCriterion records for the assignment. If a Rubric already exists
> for this assignment, replace it. Include the RubricBuilder as a section within
> the assignment creation/edit form, shown below the main fields."

> **Why build rubrics here instead of Phase 12:** rubrics are needed by the AI
> grading route (Phase 10) and self-assessment (Phase 11), not just peer review.
> Building them now ensures all assessment modes have rubrics available.

### Step 4.6 — TaskBuilder component

**Instruction:**
> "Generate `components/teacher/TaskBuilder.tsx`. It manages an ordered list of
> tasks. Each task has: title, taskType (select from the full TaskType enum:
> STUDY, RESEARCH, WRITING, REVIEW, QUIZ, PRACTICE, REFLECTION, PEER_REVIEW,
> SOCRATIC), estimatedMins, pointValue, and an optional unlocksAfter field
> (select from previous tasks in the list). Tasks can be reordered by drag (use
> the HTML5 drag-and-drop API — no external library needed). On save, POST the
> task array to `app/api/tasks/route.ts`. Generate that API route too — it
> bulk-creates tasks for an assignment, replacing any existing tasks."

### Step 4.7 — Course detail and submission table

**Instruction:**
> "Generate `app/(teacher)/courses/[courseId]/page.tsx` — shows the course name,
> a list of assignments with progress summary (e.g. '12/24 students started'),
> and links to each assignment's detail page and edit page. Then generate
> `components/teacher/SubmissionTable.tsx` — a table with student name rows and
> assignment columns, each cell showing submission status and progress %."

### Step 4.8 — Assignment detail page (teacher view)

**Instruction:**
> "Generate `app/(teacher)/courses/[courseId]/assignments/[assignmentId]/page.tsx`
> — shows assignment title, rendered brief, due date, weight, difficulty, task
> list, rubric preview, submission overview (how many students started/submitted).
> Links to the edit page. This page will later be extended with anchor submission
> upload (Phase 12)."

### Step 4.9 — Student enrollment

**Instruction:**
> "Generate `app/(teacher)/courses/[courseId]/students/page.tsx` — shows enrolled
> students and two enrollment methods:
> 1. 'Invite by Email' form — POST to `app/api/courses/[courseId]/enroll/route.ts`
>    which: looks up the User by email. If found, create an Enrollment record. If
>    NOT found, create a User record with `role: STUDENT` and an empty Profile
>    (the user will complete onboarding on first magic-link sign-in — NextAuth's
>    Prisma adapter will link the Account record at that point). Send a Resend
>    welcome email containing a magic link to the student dashboard.
> 2. 'Enrollment Link' — displays a shareable URL in the format
>    `/enroll?code=[courseId]`. Generate `app/enroll/page.tsx` — reads the `code`
>    query param, requires an active session (redirect to login if not), creates
>    the Enrollment record, and redirects to the student dashboard."

**Checkpoint:** teacher can create a course, edit it, create an assignment with
rubric and tasks, view the course detail page, and enroll a student by email or
link. The enrolled student exists in the database.

---

## Phase 5 — Student: Dashboard and Quest Board
*Goal: an enrolled student can log in, see their prioritised tasks today, and
browse their assignments.*

### Step 5.0 — Submission record creation

Before building the dashboard, we need to ensure Submission records exist.

**Instruction:**
> "Generate `lib/ensureSubmission.ts` — exports an async function
> `ensureSubmission(userId: string, assignmentId: string)` that: checks if a
> Submission record exists for this user + assignment pair. If not, creates one
> with `status: NOT_STARTED` and `progressPct: 0`. Returns the Submission.
> Use `upsert` for atomic safety. Call this function: (a) when a student first
> views an assignment detail page, and (b) inside the task completion API before
> updating progress. This ensures a Submission always exists before anything tries
> to update it."

### Step 5.1 — getDailyTasks function

**Context:** the entire **Multi-Course: getDailyTasks Logic** section.

**Instruction:**
> "Generate `lib/getDailyTasks.ts` exactly as specified. Implement the full
> scoring function: `score = 0.5 * urgencyNorm + 0.4 * weightNorm + 0.1 * notStartedBonus`
> where `urgencyNorm` is 0–1 based on days to deadline, `weightNorm` is
> `assignment.weight / 100`, and `notStartedBonus` is 1.0 if the student has
> not started the parent assignment, else 0.0 — so the final score stays in the
> 0–1 range. Cap at 2 tasks per course. Return top 8 tasks. Include unlock logic:
> a task is unlocked if `unlocksAfter` is null, or if the referenced task has a
> TaskCompletion for this user."

### Step 5.2 — Student dashboard

**Context:** the student dashboard description from Phase 1 of **What to
Build**.

**Instruction:**
> "Generate `app/(student)/dashboard/page.tsx`. It must: call `getDailyTasks` for
> the current user, render each task as a `TaskRow` with `CourseColorDot` and
> course code. Fetch approaching deadlines (assignments due within 14 days across
> all enrolled courses), grouped by course. Render stat cards: weekly XP, streak,
> quests done. Render today's daily habits. Show a mentor daily quote — pick
> randomly from `theme.vocabulary.dailyQuote`."

### Step 5.3 — TaskRow and CourseColorDot components

**Instruction:**
> "Generate `components/shared/CourseColorDot.tsx` — a small filled circle
> rendered with the course's hex color. Generate `components/student/TaskRow.tsx`
> — shows: CourseColorDot, course code badge, task title, task type tag,
> estimated time, XP value, and a completion checkbox. Checking the checkbox calls
> POST `/api/completions` with the taskId. On success, the row animates out and
> the parent re-fetches tasks."

### Step 5.4 — Points and achievements library

> **Build order note:** this step must come before Step 5.5 (Task completion API)
> because the completion API imports `getLevelFromXP` and `checkAchievements`.

**Context:** the entire **Points & Level Logic** section from the build
prompt.

**Instruction:**
> "Generate `lib/points.ts` exactly as specified — LEVEL_THRESHOLDS array,
> `getLevelFromXP`, `getXPToNextLevel`. Then generate `lib/achievements.ts` with
> the ACHIEVEMENTS map and a `checkAchievements(userId, stats)` function that
> checks each achievement condition and creates an Achievement record if not
> already unlocked."

### Step 5.5 — Task completion API

**Instruction:**
> "Generate `app/api/completions/route.ts` — POST marks a task complete for the
> current user. It must: call `ensureSubmission` for the parent assignment first,
> then create a `TaskCompletion` record, add `pointsAwarded` to the user's
> `Profile.totalPoints`, recalculate `level` using `getLevelFromXP`, update
> `currentStreak` and `bestStreak`, update `Submission.progressPct` for the
> parent assignment, run `checkAchievements` from `lib/achievements.ts`. Return
> the updated XP and level so the UI can animate the change."

### Step 5.6 — Quest Board (assignment list)

**Context:** the Quest Board description from the student Phase 1 features.

**Instruction:**
> "Generate `app/(student)/quests/page.tsx`. It must: fetch all assignments across
> enrolled courses, render a `CourseFilterBar` at the top, render each assignment
> as an `AssignmentCard`. Filter state lives in URL param `?course=courseId`.
> Generate `components/student/CourseFilterBar.tsx` — pill buttons for each
> enrolled course, using the course color. Generate
> `components/student/AssignmentCard.tsx` — shows a left color stripe in the
> course color, assignment title, difficulty badge, days remaining, XP value,
> and a progress bar."

### Step 5.7 — Assignment detail page

**Instruction:**
> "Generate `app/(student)/quests/[assignmentId]/page.tsx`. It must: call
> `ensureSubmission` on load, render the assignment brief as markdown using
> `react-markdown`, render the task chain below it using `TaskRow` components
> with lock/unlock state shown visually (locked tasks are greyed out with a
> padlock icon), show overall assignment progress %. If the assignment's
> `assessmentMode` is `PEER_REVIEW` and the student has submitted, show a
> 'Post to Board' button (`PostToBoardButton` component)."

### Step 5.8 — Bosses (Deadlines) view

**Instruction:**
> "Generate `app/(student)/bosses/page.tsx` — a dedicated deadlines page. Fetch
> all assignments across enrolled courses that have a future due date. Group by
> course, sort by due date ascending within each group. Each row shows: assignment
> title, due date, days remaining (with urgency coloring: green > 7 days,
> amber 3–7 days, red < 3 days), difficulty badge, progress %. Clicking a row
> navigates to the assignment detail page. Use course color as the group header
> background."

**Checkpoint:** student logs in, sees today's tasks on the dashboard, can check
off a task and watch XP increase, can browse the Quest Board filtered by course,
can open an assignment to read the brief and see the task chain, and can view
all upcoming deadlines on the Bosses page.

---

## Phase 6 — Student: Profile and Theme Selector
*Goal: student can see their stats, achievements, and switch world themes.*

### Step 6.1 — Profile page

**Context:** the profile description from student Phase 1 features and
the **Points & Level Logic** section.

**Instruction:**
> "Generate `app/(student)/profile/page.tsx`. It must: show the student's display
> name, level, XP progress bar (current XP / XP to next level using
> `getXPToNextLevel`), total XP, best streak, quests done. Render the achievement
> grid — 6 achievement cards showing locked/unlocked state using the ACHIEVEMENTS
> map from `lib/achievements.ts`."

### Step 6.2 — Theme selector

**Instruction:**
> "Generate `app/(student)/settings/page.tsx`. It must: show three theme selector
> cards — one per bundled theme. Each card shows the theme name, a palette preview
> (5 small color swatches from `theme.palette`), and sample vocabulary
> (`theme.vocabulary.assignment`, `theme.vocabulary.deadline`,
> `theme.vocabulary.points`). Selecting a card saves the themeId via PATCH
> `/api/profile/theme`. The page reloads after save so the ThemeProvider picks up
> the new theme. Generate the PATCH route too."

We are here.

**Checkpoint:** student can switch from Medieval to Space Explorer and back. All
vocabulary on the dashboard changes. XP is visible with the correct level
calculation.

---

## Phase 7 — Admin Panel
*Goal: admin can view all users, manage individual users, change roles, view all
courses, and configure platform settings.*

### Step 7.1 — Admin layout and dashboard

**Context:** the entire **Admin Role** section from the build prompt.

**Instruction:**
> "Generate `app/(admin)/layout.tsx` — calls `requireRole('ADMIN')`, renders a
> sidebar with links to Dashboard, Users, Courses, Settings. Then generate
> `app/(admin)/dashboard/page.tsx` — shows `PlatformStatsBar` with: total users
> by role, total active courses, task completions today, new signups this week.
> Fetch all stats server-side with Prisma aggregate queries."

### Step 7.2 — Users table and user detail

**Instruction:**
> "Generate `components/admin/UserTable.tsx` — a sortable table with columns:
> display name, email, role (rendered as `RoleSelector` dropdown), enrolled
> courses count, last active, a 'View' link. Generate
> `components/admin/RoleSelector.tsx` — a select element that PATCHes
> `/api/admin/users/[userId]` on change. Generate the API routes:
> `app/api/admin/users/route.ts` — GET returns all users (ADMIN only).
> `app/api/admin/users/[userId]/route.ts` — GET returns single user, PATCH
> updates role (validates valid Role enum), DELETE deactivates account.
> All routes require ADMIN role.
> Generate `app/(admin)/users/page.tsx` using `UserTable`.
> Generate `app/(admin)/users/[userId]/page.tsx` — user detail page showing:
> display name, email, role (editable via RoleSelector), list of enrolled courses,
> profile stats (XP, level, streak), account actions (deactivate)."

### Step 7.3 — Admin courses view

**Instruction:**
> "Generate `app/(admin)/courses/page.tsx` — fetches all courses across all
> teachers with teacher name, enrollment count, active assignment count. Uses a
> simple table. Each row links to `/admin/courses/[courseId]`. Generate
> `app/(admin)/courses/[courseId]/page.tsx` — same as the teacher course detail
> but without ownership restriction."

### Step 7.4 — Admin settings page

**Instruction:**
> "Generate `app/(admin)/settings/page.tsx` — platform-wide settings page.
> Include: default theme selector (which theme new students get), feature flags
> (toggles for: AI mentor enabled, peer review enabled, self-assessment enabled
> — stored as a JSON config in a new `PlatformSettings` singleton table or as
> environment variables read from Vercel). For now, store settings in a simple
> JSON file at `lib/platformSettings.ts` that can be swapped for a DB-backed
> solution later."

**Checkpoint:** admin can log in, see platform stats, change a user's role in the
table, view a user's detail page, view any course, and access settings.

---

## Phase 8 — Assignment Creation: Import and AI Interview Modes
*Goal: all three creation modes work. Manual is already done in Phase 4.*

### Step 8.1 — Zod import schemas

**Context:** the full **Mode 2 — External LLM Import** section including
the schema code block.

**Instruction:**
> "Generate `lib/ai/assignmentSchema.ts` with `TaskImportSchema`,
> `AssignmentImportSchema`, and their exported types exactly as specified. The
> `taskType` enum in `TaskImportSchema` must include all values from the TaskType
> database enum: STUDY, RESEARCH, WRITING, REVIEW, QUIZ, PRACTICE, REFLECTION,
> PEER_REVIEW, SOCRATIC. Generate `lib/ai/knowledgeBaseSchema.ts` with
> `KnowledgeBaseImportSchema`."

### Step 8.2 — Import parse and validate

**Instruction:**
> "Generate `lib/ai/parseImport.ts` — exports `parseAssignmentImport(json: string)`
> which: parses the JSON string safely (catch SyntaxError), validates against
> `AssignmentImportSchema`, returns `{ success: true, data }` or
> `{ success: false, errors: ZodError }`. Export a matching function for
> knowledge bases."

### Step 8.3 — Export prompt generator

**Context:** the Mode 2 prompt description and the schema from Step 8.1.

**Instruction:**
> "Generate `lib/ai/prompts.ts` — exports `buildExportPrompt(type: 'assignment'
> | 'knowledgeBase'): string`. The prompt instructs an external LLM to interview
> the teacher, gather all needed information, and output ONLY a JSON object
> matching the relevant schema (print the schema inline in the prompt). Include
> the exact schema in the prompt string so the external LLM has it."

### Step 8.4 — ImportPastePanel and ExportPromptPanel components

**Instruction:**
> "Generate `components/teacher/ExportPromptPanel.tsx` — shows the copyable prompt
> from `buildExportPrompt` in a `<pre>` block with a 'Copy to clipboard' button.
> Generate `components/teacher/ImportPastePanel.tsx` — a textarea where the
> teacher pastes the JSON output from the external LLM. A 'Validate & Import'
> button calls `parseAssignmentImport`, shows field-level errors if invalid, and
> on success calls an `onImport(data)` callback that pre-fills the parent
> AssignmentForm."

### Step 8.5 — Internal AI interview API

**Context:** the full **Mode 3 — Internal AI Generation** section including
the API code block.

**Instruction:**
> "Generate `app/api/ai/interview/route.ts` — a streaming POST endpoint. It takes
> `{ messages, jobType }`, builds a system prompt from `lib/ai/prompts.ts`
> (use `assignmentInterviewer` or `knowledgeBaseInterviewer` based on jobType),
> includes the `finalize_assignment` tool definition exactly as specified, and
> streams the Anthropic response back to the client. Model:
> `claude-sonnet-4-20250514` (or latest Sonnet version available), max_tokens: 1000. Add `export const maxDuration = 60`
> for Vercel streaming support (do NOT use edge runtime — Prisma needs Node.js). Wrap the Anthropic call in try/catch and return
> a 500 response on failure."

### Step 8.6 — AIInterviewChat component and job persistence

**Instruction:**
> "Generate `components/teacher/AIInterviewChat.tsx` — a streaming chat UI.
> On mount, sends an empty first message to trigger the AI's opening question.
> Streams responses from `/api/ai/interview`. When a `tool_use` block with
> `name: 'finalize_assignment'` is received, hides the chat and calls
> `onComplete(data)` with the parsed assignment data. Show a loading indicator
> while streaming. Generate `app/api/ai/generate/route.ts` to create and update
> `AIGenerationJob` records for job persistence."

### Step 8.7 — AssignmentCreationHub (full version)

**Instruction:**
> "Generate `components/teacher/AssignmentCreationHub.tsx` — renders three tabs:
> 'Manual', 'Import from AI', 'AI Interview'. Manual tab: renders AssignmentForm
> directly. Import tab: renders ExportPromptPanel then ImportPastePanel; on import
> success, switches to AssignmentForm pre-filled with the data. AI Interview tab:
> renders AIInterviewChat; on complete, switches to AssignmentForm pre-filled with
> the data. All three paths end at the same AssignmentForm review step. Update
> `app/(teacher)/courses/[courseId]/assignments/new/page.tsx` to use the full
> AssignmentCreationHub with all three tabs active."

**Checkpoint:** teacher can create an assignment in all three modes. The import
mode correctly validates and rejects malformed JSON. The AI interview mode
completes and pre-fills the form.

---

## Phase 9 — Knowledge Bases
*Goal: teacher can create, edit, and manage knowledge bases per course.*

### Step 9.1 — Knowledge base API and pages

**Instruction:**
> "Generate `app/api/knowledge-bases/route.ts` — POST creates a KnowledgeBase for
> a course (teacher must own the course), GET returns all knowledge bases for a
> courseId. Generate `app/(teacher)/courses/[courseId]/knowledge/page.tsx` — lists
> knowledge bases with title, source type badge, last updated. Generate
> `app/(teacher)/courses/[courseId]/knowledge/new/page.tsx` for creation.
> Generate `app/(teacher)/courses/[courseId]/knowledge/[kbId]/edit/page.tsx` for
> editing. Generate `components/teacher/KnowledgeBaseForm.tsx` and
> `KnowledgeBaseCreationHub.tsx` — identical pattern to `AssignmentCreationHub`
> but for knowledge bases. Use `KnowledgeBaseImportSchema` and
> `knowledgeBaseInterviewer` prompt."

**Checkpoint:** teacher can create a knowledge base in all three modes. Knowledge
bases appear in the course detail. Existing knowledge bases can be edited.

---

## Phase 10 — Assessment: AI Pre-Grade Queue
*Goal: student submits work, AI grades it, teacher reviews in a queue with
auto-release for high-confidence items.*

This is the first and simplest assessment mode to build — start here before any
other assessment mode.

### Step 10.1 — Submission content field and submit action

**Instruction:**
> "Update `app/(student)/quests/[assignmentId]/page.tsx` to add a work submission
> area at the bottom of the task chain. When all tasks are complete, show a
> markdown editor (use `@uiw/react-md-editor`) for the student to enter their
> work. A 'Submit Work' button POSTs to `app/api/assignments/[assignmentId]/submit`
> which sets `Submission.content`, `submittedAt`, and `status: SUBMITTED`.
> Generate this API route. The route must call `ensureSubmission` first."

### Step 10.2 — AI grading API

**Context:** the **Grading API** code section from the Assessment System.

**Instruction:**
> "Generate `app/api/ai/grade/route.ts` as specified. It must: fetch the
> submission, assignment brief, and rubric criteria from the DB, call the Anthropic
> API with the grading system prompt, parse the JSON response against a Zod schema
> matching `AIFeedback`, create the `AIFeedback` record, and update the submission
> status to `AI_GRADED`. Add `export const maxDuration = 60` for Vercel (do NOT use edge runtime).
> **Error handling:** wrap the Anthropic call in try/catch. If JSON parsing fails,
> attempt to extract JSON from the response using a regex fallback. If that also
> fails, create an AIFeedback record with `confidenceLevel: 0.0` and empty
> feedback, so the submission appears in the teacher queue as needing manual review
> rather than silently failing. Call this route from a server action triggered
> immediately after submission."

### Step 10.3 — Teacher grading queue

**Instruction:**
> "Generate `app/(teacher)/courses/[courseId]/grading/page.tsx` — a table of all
> submissions for this course with status `AI_GRADED`, `TEACHER_REVIEWED`, or
> `RELEASED`. Columns: student name, assignment title, AI score, confidence level
> shown as a green/yellow/red dot (green ≥ 0.8, yellow ≥ 0.6, red < 0.6),
> submitted at, status. Sort: low-confidence first. Filter tabs:
> Needs Review | Auto-releasable | Released.
> **Auto-release logic:** 'Auto-releasable' tab shows items with confidence ≥ 0.8
> where the linked AIFeedback `createdAt` is ≥ 24 hours ago (i.e. the AI graded
> them at least 24 hours ago, giving the teacher time to review). Add a 'Release All
> High-Confidence' bulk action button that sets all auto-releasable submissions
> to `status: RELEASED`, `releasedAt: now()`. Clicking a row opens the
> submission detail."

### Step 10.4 — Submission detail and teacher override

**Instruction:**
> "Generate `app/(teacher)/courses/[courseId]/grading/[submissionId]/page.tsx`.
> Shows: student name, assignment brief, student's submitted content, AI feedback
> (criterion scores, overall score, feedback markdown, quick wins, strengths).
> Teacher can edit the overall score inline (number input), add qualitative
> feedback (markdown editor), and click 'Release to Student'. Release sets
> `Submission.status = RELEASED`, `releasedAt = now()`,
> `teacherOverride = true` if score was changed."

### Step 10.5 — Student feedback view

**Instruction:**
> "Update `app/(student)/quests/[assignmentId]/page.tsx` — when submission status
> is `RELEASED`, show a feedback panel. Display in this order: mastery level badge
> first (BEGINNING/DEVELOPING/PROFICIENT/ADVANCED), then quick wins (2–3 bullet
> points), then strengths, then the full feedback markdown. Numeric score is shown
> only when the student clicks 'See score'. Never show the score as the headline."

**Checkpoint:** student submits work, AI grades it, teacher sees it in the queue
with a confidence indicator, teacher can bulk-release high-confidence items or
review individually, student sees feedback with mastery level first.

---

## Phase 11 — Assessment: Self-Assessment with Socratic Validation
*Goal: for SELF_ASSESSED assignments, student reflects and AI validates.*

### Step 11.1 — Reflection question generation

**Instruction:**
> "Generate `app/api/ai/reflect/route.ts` — takes assignmentId, calls the
> Anthropic API with the assignment brief and rubric criteria to generate 5
> reflection questions targeting: what they did, what was hard, what they'd change,
> and 2 content-specific probes from the rubric. Return as a JSON array of
> question strings. Cache the result on the Assignment model (add a
> `reflectionQuestions Json?` field to the Assignment model in
> `prisma/schema.prisma`, then run `npx prisma db push && npx prisma generate`)
> so they are generated once per assignment. Add error handling: try/catch the
> Anthropic call, return 500 with message on failure."

### Step 11.2 — Self-assessment form

**Instruction:**
> "Generate `components/student/SelfAssessmentForm.tsx` — shown after task
> completion on SELF_ASSESSED assignments. Renders each reflection question with
> a textarea. Includes a self-score slider (0–100) and confidence selector (1–5
> stars). On submit, POST to `app/api/self-assessment/route.ts` which creates the
> SelfAssessment record and triggers the Socratic validation dialogue."

### Step 11.3 — Socratic validation dialogue

**Context:** the Socratic Dialogue API section.

**Instruction:**
> "Generate `app/api/ai/socratic/route.ts` as a streaming endpoint. Add
> `export const maxDuration = 60` for Vercel (not edge — Prisma needs Node.js). System prompt instructs the AI to
> probe the student's self-assessment answers (passed as context), ask 3–5
> follow-up questions about the weakest area, and call
> `finalize_understanding_report` when done. Wrap the Anthropic call in try/catch.
> Generate `components/student/SocraticChat.tsx` — streaming chat UI, identical
> pattern to `AIInterviewChat.tsx`. On finalise, save the SocraticDialogue record
> and redirect the student to their feedback view."

**Checkpoint:** for a SELF_ASSESSED assignment, the student completes reflection,
has a 3–5 turn Socratic conversation, and sees their understanding report.

---

## Phase 11b — Assessment: Standalone Socratic Dialogue
*Goal: for SOCRATIC assignments, AI reads submission and conducts a deep
understanding probe.*

This is a separate assessment mode from Phase 11's validation dialogue. Where
Phase 11 uses Socratic questioning to validate a self-assessment (3–5 turns),
standalone Socratic is a deeper exploration (5–8 turns) that serves as the
primary assessment mechanism.

### Step 11b.1 — Standalone Socratic dialogue flow

**Context:** the **Assessment Mode 3 — Socratic Dialogue (Standalone)**
section from the build prompt.

**Instruction:**
> "Update `app/(student)/quests/[assignmentId]/page.tsx` — when the assignment's
> `assessmentMode` is `SOCRATIC` and the student has submitted work, show a
> 'Begin Understanding Check' button instead of waiting for teacher review. This
> launches the Socratic dialogue.
> Update `app/api/ai/socratic/route.ts` to accept a `mode` parameter:
> `'validation'` (existing — 3–5 turns, probes self-assessment) or `'standalone'`
> (new — 5–8 turns, reads submitted work + brief + rubric). The standalone system
> prompt instructs the AI to: read the brief, rubric, and submitted work; ask 5–8
> open probing questions escalating in depth; acknowledge good answers warmly;
> never reveal it is scoring; call `finalize_understanding_report` with a
> structured report including `suggestedScore` and `confidenceLevel`.
> On completion, save the SocraticDialogue record linked to the Submission,
> update status to `AI_GRADED`, and show the student a 'Your understanding check
> is complete — your teacher will review the results' message.
> The teacher sees the transcript + understanding report in the grading queue
> (already built in Phase 10) and can confirm/adjust the score before releasing."

**Checkpoint:** for a SOCRATIC assignment, the student submits work, begins a
5–8 turn dialogue, and the teacher receives the transcript with the AI's
understanding report in the grading queue.

---

## Phase 12 — Assessment: The Board (Peer Review)
*Goal: students post work to the board, calibrate, review voluntarily.*

> **Note:** Phase 12 depends on Phase 10 (the grading queue and submission flow)
> but does **not** depend on Phase 11 (self-assessment). Peer review is an
> independent assessment mode.

### Step 12.0 — PeerReviewConfig management

> **Prerequisite:** before students can peer-review, the teacher must configure
> review settings for the assignment. The `PeerReviewConfig` model (created in
> Phase 1) stores: `minReviewsToGive`, `minReviewsToReceive`, `anonymized`,
> `rubricId`. This step creates the UI and API for managing it.

**Instruction:**
> "Generate `app/api/assignments/[assignmentId]/peer-config/route.ts` — POST
> creates or updates the PeerReviewConfig for a PEER_REVIEW assignment (teacher
> must own the parent course). Fields: `minReviewsToGive` (default 2),
> `minReviewsToReceive` (default 3), `anonymized` (boolean, default true),
> `rubricId` (must reference an existing Rubric for this assignment). GET returns
> the current config. Add a PeerReviewConfig section to the assignment edit page
> (`app/(teacher)/courses/[courseId]/assignments/[assignmentId]/edit/page.tsx`)
> so the teacher can set these values when `assessmentMode` is `PEER_REVIEW`."

### Step 12.1 — Anchor submission upload

**Instruction:**
> "Update `app/(teacher)/courses/[courseId]/assignments/[assignmentId]/page.tsx`
> — add an 'Anchor Submission' section (shown only for PEER_REVIEW assignments).
> Teacher pastes or types the anchor work content, then scores it against each
> rubric criterion. POST to `app/api/anchor/route.ts` which creates the
> AnchorSubmission record."

### Step 12.2 — Post to Board

**Instruction:**
> "Generate `components/student/board/PostToBoardButton.tsx` — shown on the
> assignment detail page after submission. Clicking POST to
> `app/api/board/[courseId]/route.ts` which sets `postedToBoard = true` and
> `postedAt`. The button changes to 'Posted to Board ✓' after success. Generate
> the POST handler in the board API route."

### Step 12.3 — Board landing page

**Instruction:**
> "Generate `app/(student)/board/page.tsx` — a course selector page. Fetch all
> enrolled courses that have at least one PEER_REVIEW assignment. Show a card per
> course with the course color. Clicking a course navigates to
> `/student/board/[courseId]`. If the student is enrolled in only one course with
> peer review, redirect automatically."

### Step 12.4 — Board view

**Instruction:**
> "Generate `app/(student)/board/[courseId]/page.tsx`. Fetches all submissions
> where `postedToBoard = true` and `boardHidden = false` for the given course.
> Renders `SubmissionCard` components. Pinned posts appear first. Filter by
> assignment. Sort options: fewest reviews first (default), most recent, most
> reviewed. Generate `components/student/board/BoardView.tsx` and
> `components/student/board/SubmissionCard.tsx` — card shows: assignment title,
> the full assignment brief (always visible), poster name or 'Anonymous'
> depending on `PeerReviewConfig.anonymized`, review count, a 'Review this' CTA.
> If the current user has not completed calibration for this assignment, the CTA
> shows 'Unlock reviewing' instead. A student cannot review their own post."

### Step 12.5 — Calibration gate

**Instruction:**
> "Generate `app/(student)/board/[courseId]/calibrate/[assignmentId]/page.tsx`.
> Shows the AnchorSubmission content alongside the rubric. Student scores each
> criterion and leaves a qualitative comment. On submit, POST to
> `app/api/calibrate/route.ts` which: compares student scores to teacher scores,
> computes calibrationScore (1 minus normalised mean absolute error across
> criteria), creates a `ReviewerCalibration` record. Redirect to the board."

### Step 12.6 — Review form

**Instruction:**
> "Generate `app/(student)/board/[courseId]/review/[submissionId]/page.tsx`.
> Side-by-side layout: assignment brief on the left, student submission on the
> right, rubric review form below. Each criterion: score input (0 to maxScore),
> required qualitative comment (minimum 50 characters enforced client-side).
> Submit POST to `app/api/board/review/route.ts` which: creates the PeerReview
> record (with `reviewerUserId` set to the current user's ID — this is a User
> relation, not a Submission relation), checks if `minReviewsToReceive` is now
> met, if so triggers peer score computation (weighted by reviewer calibration
> scores) and `/api/ai/synthesize-reviews`. Generate the synthesize-reviews
> route — it reads all PeerReview records for the submission, prompts the AI to
> synthesise consensus strengths and gaps, creates an AIFeedback record."

### Step 12.7 — Teacher board overview

**Instruction:**
> "Generate `components/teacher/BoardOverview.tsx` and
> `app/(teacher)/courses/[courseId]/board/page.tsx`. Teacher sees all board posts
> for the course: poster, assignment, review count, computed peer score (if
> available). Actions per post: Pin (sets `boardPinned = true`, surfaces post at
> top of student board), Hide (sets `boardHidden = true`, removes from student
> board). Pinned posts shown with a star badge."

**Checkpoint:** student can post to board, other students can calibrate and review
voluntarily, peer scores compute automatically at threshold, AI synthesises
reviews, teacher can pin and hide posts.

---

## Phase 13 — AI Mentor Chat
*Goal: themed AI mentor answers student questions with context awareness.*

### Step 13.1 — Mentor API

**Context:** the **AI Mentor Integration** section from the build prompt.

**Instruction:**
> "Generate `app/api/mentor/route.ts` exactly as specified. It must build a
> persona-specific system prompt from the student's themeId (medieval/space/cyber),
> inject the student's current assignments (title, dueDate, progressPct) as
> context, and call `claude-sonnet-4-20250514` (or latest Sonnet version available) with max_tokens 500. Stream the
> response. Add `export const maxDuration = 60` for Vercel streaming support
> (not edge — Prisma needs Node.js). Wrap the Anthropic call in try/catch and
> return a friendly error message on failure. The three persona system prompts
> are specified in the build prompt."

### Step 13.2 — MentorChat component

**Instruction:**
> "Generate `components/student/MentorChat.tsx` — streaming chat UI with the
> mentor avatar (theme.vocabulary.mentorAvatar emoji) and mentor name
> (theme.vocabulary.mentor) in the header. Four starter prompt buttons:
> 'Study plan', 'Break down task', 'Study tips', 'Stay motivated'. These send
> pre-written prompts to start the conversation. Renders streamed responses
> incrementally. Generate `app/(student)/mentor/page.tsx` using this component."

**Checkpoint:** student chats with Eldrin (or Commander Orion or Ghost depending
on theme). Responses stream in. The mentor references the student's actual
current assignments.

---

## Phase 14 — Calendar, Habits, and Knowledge Check
*Goal: weekly calendar with course-colour-coded blocks, student habit tracking,
and quiz functionality.*

### Step 14.1 — Calendar view

**Instruction:**
> "Generate `app/(student)/calendar/page.tsx` — a weekly view showing two things:
> (1) **Deadlines**: assignment due dates rendered as full-width markers on
> their due day, coloured by course. (2) **Suggested study blocks**: use
> `getDailyTasks` to get prioritised tasks for each day of the week, then stack
> them vertically as blocks (height proportional to `estimatedMins`) in the
> relevant day column. These are suggestion blocks, not scheduled time slots —
> no time-of-day axis is needed. Render each block with the course color as the
> background. A course legend at the top shows enrolled courses with their
> colours. No external calendar library — build the grid with CSS Grid."

### Step 14.2 — Habits

**Instruction:**
> "Generate `app/api/habits/route.ts` — GET returns user's habits (filter by
> userId using the Habit → User relation), POST creates a new Habit owned by the
> current user. Generate `app/api/habits/[habitId]/complete/route.ts` — POST
> creates a HabitCompletion, awards XP (use `habit.pointValue` or a default of
> 5 XP per completion), updates the Habit's own `currentStreak` field (not the
> Profile streak — that tracks task completions). Generate
> `app/(student)/habits/page.tsx` showing habit cards with streak count and
> progress bar. Generate `components/student/HabitCard.tsx` with a check button
> that marks completion for today."

### Step 14.3 — Knowledge Check (Quiz system)

**Instruction:**
> "Generate the knowledge check / quiz system. This attaches MCQ questions to
> assignments (not free-floating).
> 1. Generate `app/api/assignments/[assignmentId]/quiz/route.ts` — POST creates
>    quiz questions (teacher only; JSON array of `{ question, options[], correct }`),
>    GET returns quiz questions for the assignment.
> 2. Generate `components/student/KnowledgeCheck.tsx` — renders quiz questions one
>    at a time, shows correct/incorrect feedback after each answer, tallies score.
>    On completion, POST to `/api/completions` to mark the QUIZ-type task as done
>    and award XP.
> 3. In `app/(student)/quests/[assignmentId]/page.tsx`, when a task with
>    `taskType: QUIZ` is clicked, open the KnowledgeCheck UI for that assignment.
> 4. Generate `app/(student)/knowledge/page.tsx` — a global view of all pending
>    quiz tasks across enrolled courses (filtered view of incomplete QUIZ tasks).
>    Each row links to the parent assignment's detail page."

**Checkpoint:** calendar shows tasks and deadlines colour-coded by course. Student
can add habits and check them off daily. Teacher can attach quiz questions to an
assignment, student can complete them, and the global knowledge page lists all
pending quizzes.

---

## Phase 15 — Polish and Launch
*Goal: production-ready, no obvious errors, all routes protected.*

### Step 15.1 — Error boundaries and loading states

**Instruction:**
> "Add a `loading.tsx` and `error.tsx` to each route group: `(student)`,
> `(teacher)`, `(admin)`. Loading state shows a neutral spinner. Error state shows
> a friendly message and a 'Try again' button."

### Step 15.2 — Route protection audit

Run through every route manually and confirm: students cannot access teacher
routes, teachers cannot access admin routes, unauthenticated users are redirected
to `/login`, API routes return 401/403 for wrong roles.

### Step 15.3 — Mobile responsiveness

**Instruction:**
> "Review the student dashboard, quest board, and board view for mobile
> responsiveness. The sidebar nav should collapse to a bottom tab bar on screens
> below 768px. Use Tailwind responsive prefixes (sm:, md:) throughout."

### Step 15.4 — Final Vercel deployment check

- Confirm all env vars are set in Vercel dashboard
- Ensure `prisma generate` runs before `next build` in Vercel. Add a `postinstall`
  script to `package.json`: `"postinstall": "prisma generate"`. This ensures the
  Prisma Client is generated on every `npm install` (including Vercel deploys)
- Verify all streaming routes have `export const maxDuration = 60`
  (do NOT use `runtime = 'edge'` — Prisma requires Node.js runtime)
- Test the full student and teacher flows on the deployed URL, not just localhost

---

## Blind Spots and Reminders

Things not explicitly covered by a step but needed for a working build:

1. **Middleware for route protection:** the guide relies on `requireRole()` in
   each page/route, but a Next.js `middleware.ts` at the root would catch
   unauthenticated users before they reach any route group. Consider adding one
   in Phase 2 or Phase 15 that redirects unauthenticated requests to `/login`
   for all paths under `/(student)`, `/(teacher)`, `/(admin)`, and `/api`
   (except `/api/auth`).

2. **Student navigation / sidebar:** Phase 5 builds the dashboard and pages but
   no step explicitly generates the student sidebar/navbar with links to
   Dashboard, Quests, Board, Calendar, Habits, Knowledge, Mentor, Profile,
   Settings. The teacher and admin layouts include nav in their layout steps.
   Add student nav to Step 3.3 (student layout) or create a Step 5.0b.

3. **Database seeding script:** Phase 1.3 seeds the first admin via raw SQL,
   but a `prisma/seed.ts` script would help development. Consider adding a
   seeding step that creates a test teacher, a test student, a course, and
   sample assignments.

4. **Environment variable validation:** no step validates that all required env
   vars are present at startup. Add a `lib/env.ts` with Zod validation of
   `process.env` (imported in the root layout or `next.config.js`) so missing
   keys fail fast instead of causing cryptic runtime errors.

5. **Quiz question creation UI:** Step 14.3 generates the quiz API and student
   quiz component, but doesn't generate a teacher UI for creating quiz questions.
   The API expects a JSON array posted by the teacher — add a
   `components/teacher/QuizBuilder.tsx` step or extend the assignment edit page.

6. **Rate limiting on AI routes:** all AI routes (`/api/mentor`, `/api/ai/*`)
   call the Anthropic API with no rate limiting. A student could spam the mentor
   chat and run up API costs. Consider adding a simple per-user rate limit
   (e.g. 20 requests per hour) in Phase 15 or as middleware.

---

## Summary of Build Order

| Phase | What you build | Depends on |
|---|---|---|
| 0 | Scaffolding + Vercel deploy | — |
| 1 | Database schema | 0 |
| 2 | Auth + role routing | 1 |
| 3 | Theme system | 2 |
| 4 | Teacher: courses, assignments, rubrics (manual) | 1, 2 |
| 5 | Student: dashboard, quest board, bosses view | 3, 4 |
| 6 | Student: profile + theme selector | 3, 5 |
| 7 | Admin panel (users, courses, settings) | 2 |
| 8 | Assignment creation: import + AI modes | 4 |
| 9 | Knowledge bases | 4, 8 (reuses import schemas + AI interview pattern) |
| 10 | Assessment: AI pre-grade queue + auto-release | 4, 5 |
| 11 | Assessment: self-assessment + Socratic validation | 10 |
| 11b | Assessment: standalone Socratic dialogue | 10, 11.3 (reuses Socratic API) |
| 12 | Assessment: the board (peer review) | 10 |
| 13 | AI mentor chat | 3, 5 |
| 14 | Calendar, habits, knowledge check | 5 |
| 15 | Polish + launch | all |

## General Rules for This Project

1. **One concern per prompt.** Keep instructions to 2–3 files at most. Split
   complex components into separate prompts.

2. **Always provide the relevant spec section.** Reference the build prompt
   section that describes what you're building so Claude has full context.

3. **Review before accepting.** Claude will occasionally add extra fields, skip
   Zod validation, or use a different import path. Read the output.

4. **Test before moving on.** Each phase has a checkpoint. Do not skip it.
   A broken foundation makes everything above it harder to debug.

5. **When output drifts, correct once then continue.** If a generated file
   differs from the spec, correct it and note the correction. Do not spend
   more than 10 minutes debugging — rewrite from scratch with a more specific
   prompt if needed.

6. **Commit after each checkpoint.** `git commit` at the end of each phase.
   You want a clean rollback point if the next phase breaks something.
