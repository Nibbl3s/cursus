# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npx prisma migrate dev   # Run DB migrations (requires DIRECT_URL)
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma studio        # Browser-based DB GUI
```

There are no automated tests in this project.

## Architecture

**Cursus** is a quest-based educational platform — a Next.js 15 App Router fullstack app with PostgreSQL (Supabase), Prisma ORM, NextAuth magic-link auth, and Anthropic AI integration.

### Route Groups & Access Control

Three role-protected route groups, each with its own layout:

| Route group | Role required | Purpose |
|---|---|---|
| `/(teacher)/teacher/` | TEACHER | Course/assignment management |
| `/(student)/student/` | STUDENT | Learning dashboard, quests, submissions |
| `/(admin)/admin/` | ADMIN | Platform administration |

Access is enforced via `requireRole()` in [lib/auth/requireRole.ts](lib/auth/requireRole.ts) — call this at the top of server components/pages that need protection. It redirects unauthenticated users to `/login` and under-privileged users to `/unauthorized`.

### Authentication

NextAuth 5 (beta) with the Prisma adapter. Only email magic links via Resend — no passwords. The session is extended in [types/next-auth.d.ts](types/next-auth.d.ts) to include `role`. On first sign-in, a `Profile` record is auto-created via the `signIn` callback in [auth.ts](auth.ts).

### Database

Prisma with a `PrismaPg` adapter connecting to Supabase Postgres. The singleton client lives in [lib/prisma.ts](lib/prisma.ts). Two connection URLs are needed: `DATABASE_URL` (pooler, for runtime) and `DIRECT_URL` (direct, for `prisma migrate`).

Key schema domains:
- **Users/Auth**: `User`, `Profile`, `Account`, `Session`, `VerificationToken`
- **Courses**: `Course`, `Enrollment`, `KnowledgeBase`
- **Assignments**: `Assignment`, `Task`, `TaskCompletion`, `Rubric`, `RubricCriterion`
- **Assessment**: `Submission`, `SelfAssessment`, `SocraticDialogue`, `PeerReview`, `AIFeedback`
- **Gamification**: `Habit`, `HabitCompletion`, `Achievement`, `Profile` (XP/level/streaks)
- **AI Jobs**: `AIGenerationJob` (async queue for generation tasks)

### Data Fetching

Server components call Prisma directly — no API routes for page data loads. The pattern is: `await requireRole()` → `await prisma.query()` → render. Client components that need to mutate data call API routes with `fetch`, then call `router.refresh()` to re-render the parent server component.

### API Routes

All under `app/api/`. Routes follow REST conventions:
- `/api/courses` — list/create
- `/api/courses/[courseId]` — get/update/delete
- `/api/courses/[courseId]/enroll` — student enrollment (by email lookup)
- `/api/assignments`, `/api/assignments/[assignmentId]` — CRUD
- `/api/rubric`, `/api/tasks` — rubric and task management
- `/api/completions` — canonical task completion endpoint: creates `TaskCompletion`, awards XP, updates streak, recalculates `Submission.progressPct`, runs `checkAchievements`. Returns `{ xp, level, newAchievements }`. Idempotent.
- `/api/auth/[...nextauth]` — NextAuth handler

Every API route checks `auth()` for session and role before acting. Input is validated with Zod `schema.safeParse()`; on failure return `{ error: parsed.error.flatten() }` at status 422. Use `notFound()` (not a 403) when a resource exists but the user doesn't own it — this hides resource existence.

**Next.js 15**: Both page `params` and API route `params` are Promises and must be awaited:
```typescript
export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
```

### Theme System

The app has three cosmetic themes (Medieval RPG, Space, Cyber) defined in [lib/themes/](lib/themes/). Themes replace UI vocabulary (e.g., "course" → "realm", "assignment" → "quest") and apply color schemes. The `WorldTheme` interface drives all vocabulary substitution throughout components.

`ThemeProvider` in [components/student/ThemeProvider.tsx](components/student/ThemeProvider.tsx) injects CSS variables at runtime (`--color-*`) from `theme.palette`. Use the `useTheme()` hook in student-facing client components to access `theme.vocabulary` for themed text labels.

### Gamification Utilities

Three server-side libs power the XP/level/achievement system:
- `lib/points.ts` — `LEVEL_THRESHOLDS`, `getLevelFromXP(xp)`, `getXPToNextLevel(xp)`
- `lib/achievements.ts` — `ACHIEVEMENTS` map (6 entries) and `checkAchievements(userId, stats)` which creates `Achievement` records for newly met conditions; call after every XP-awarding action
- `lib/getDailyTasks.ts` — scores incomplete tasks by `0.5×urgency + 0.4×weight + 0.1×notStarted`, caps at 2 per course, returns top 8; unlocked state derived from `unlocksAfter` chain

### AI Integration

Anthropic Claude is used for: assignment generation, knowledge base generation, peer review synthesis, grading/feedback, and Socratic dialogue. AI routes should handle errors gracefully — see the `AIGenerationJob` model for async job patterns.

### Component Organization

- `components/teacher/` — forms and builders (CourseForm, AssignmentForm, RubricBuilder, TaskBuilder, etc.)
- `components/student/` — student UI and theme provider
- `components/admin/` — admin UI
- `lib/course-colors.ts` — `PRESET_COLORS` constant used in course creation forms

Client forms manage three state slices: `fieldErrors: Record<string, string>`, `serverError: string`, and `saving: boolean`. Complex teacher forms (AssignmentForm) chain multiple `fetch` calls — first the main resource, then rubric, then tasks — in sequence.

ESM-only packages (e.g. `@uiw/react-md-editor`) must be loaded with `dynamic(() => import(...), { ssr: false })`.

`TaskBuilder` uses the HTML5 Drag and Drop API directly (no library) to reorder tasks and remap `unlocksAfterIndex` dependencies. `lib/ensureSubmission.ts` provides a Prisma upsert helper that guarantees a `Submission` row exists before creating `TaskCompletion` records.

**Rubric deletion**: `RubricCriterion` has no cascade delete. Always delete criteria before deleting the rubric, or use a transaction:
```typescript
await prisma.$transaction([
  prisma.rubricCriterion.deleteMany({ where: { rubric: { assignmentId } } }),
  prisma.rubric.deleteMany({ where: { assignmentId } }),
]);
```

**Hydration**: `Math.random()` and `Date.now()` in `'use client'` components cause React error #418 (server/client HTML mismatch). Set them in `useEffect` with a `null` initial state.

**Themed headings**: Server components can't call `useTheme()`. When a page heading must use theme vocabulary, put the `<h1>` inside the co-located client component (see `BossesView`) rather than hardcoding it in the server page.

### Assessment Modes

Assignments support: `SELF_ASSESSED`, `PEER_REVIEW`, `SOCRATIC`, `TEACHER_GRADED`, `HYBRID`. Each mode has its own submission flow and feedback mechanisms.

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL          # Supabase pooler URL (runtime)
DIRECT_URL            # Supabase direct URL (migrations only)
AUTH_SECRET           # NextAuth session secret
AUTH_URL              # Callback base URL (http://localhost:3000 in dev)
ANTHROPIC_API_KEY     # Claude API
RESEND_API_KEY        # Magic link emails
EMAIL_FROM            # Sender address
```
