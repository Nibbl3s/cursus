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

### API Routes

All under `app/api/`. Routes follow REST conventions:
- `/api/courses` — list/create
- `/api/courses/[courseId]` — get/update/delete
- `/api/courses/[courseId]/enroll` — student enrollment
- `/api/assignments`, `/api/assignments/[assignmentId]` — CRUD
- `/api/rubric`, `/api/tasks` — rubric and task management
- `/api/auth/[...nextauth]` — NextAuth handler

### Theme System

The app has three cosmetic themes (Medieval RPG, Space, Cyber) defined in [lib/themes/](lib/themes/). Themes replace UI vocabulary (e.g., "course" → "realm", "assignment" → "quest") and apply color schemes. The `WorldTheme` interface drives all vocabulary substitution throughout components.

### AI Integration

Anthropic Claude is used for: assignment generation, knowledge base generation, peer review synthesis, grading/feedback, and Socratic dialogue. AI routes should handle errors gracefully — see the `AIGenerationJob` model for async job patterns.

### Component Organization

- `components/teacher/` — forms and builders (CourseForm, AssignmentForm, RubricBuilder, TaskBuilder, etc.)
- `components/student/` — student UI and theme provider
- `components/admin/` — admin UI
- `lib/course-colors.ts` — `PRESET_COLORS` constant used in course creation forms

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
