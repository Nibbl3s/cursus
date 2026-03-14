# Build Prompt: Quest-Based Study Planner (Cursus)

## Project Overview

Build a full-stack study planning application where teachers manage courses and assignments through a neutral admin interface, and students experience the same data through a gamified, themeable frontend. The core insight: **the database is always factual; the theme is always cosmetic**.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Auth)
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **Email / Auth**: Resend (magic link login)
- **Deployment**: Vercel (free tier)
- **Language**: TypeScript throughout

---

## The Theme System — Core Architecture Decision

This is the most important architectural choice. Every gamification word lives in a theme config, never in the database or business logic.

### Theme Config Structure

```typescript
// lib/themes/types.ts
export interface WorldTheme {
  id: string;
  name: string;           // "Medieval RPG", "Space Explorer", "Cyberpunk Hacker"
  description: string;
  palette: {
    background: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
    textMuted: string;
    success: string;
    danger: string;
  };
  vocabulary: {
    // Core nouns
    assignment: string;        // "Quest", "Mission", "Hack", "Expedition"
    assignments: string;       // "Quests", "Missions", etc.
    task: string;              // "Sub-quest", "Objective", "Protocol"
    tasks: string;
    deadline: string;          // "Boss Battle", "Launch Date", "Reckoning"
    deadlines: string;
    habit: string;             // "Daily Rite", "Training Protocol", "Routine"
    habits: string;
    points: string;            // "XP", "Credits", "Rep", "Mana"
    level: string;             // "Level", "Rank", "Clearance"
    streak: string;            // "Streak", "Chain", "Uptime"
    mentor: string;            // "Eldrin", "Commander", "Ghost"
    profile: string;           // "Scholar Profile", "Agent File", "Profile"
    // Difficulty labels
    easy: string;              // "Common", "Rookie", "Basic"
    medium: string;            // "Rare", "Veteran", "Advanced"
    hard: string;              // "Epic", "Elite", "Critical"
    boss: string;              // "Legendary", "Commander", "Zero Day"
    // UI sections
    dashboardGreeting: string; // "Today's Journey", "Mission Briefing", "Daily Ops"
    questBoard: string;        // "Quest Board", "Mission Log", "Op Board"
    knowledgeCheck: string;    // "Knowledge Check", "Skill Scan", "Intel Test"
    board: string;             // "The Commons", "Mission Debrief", "The Grid Board"
    // Flavor
    dailyQuote: string[];      // Array of thematic quotes for the mentor
    mentorAvatar: string;      // emoji or image path placeholder
    completionMessage: string; // "Quest Complete!", "Mission Accomplished!", "Hack Successful!"
  };
  // CSS class suffix to apply for background textures / patterns
  cssTheme: string;            // "theme-medieval" | "theme-space" | "theme-cyber"
}
```

### Bundled Themes

Ship three themes out of the box. Students can select theirs in profile settings.

**1. Medieval RPG** (default)
- Dark brown/amber palette, serif display font, dungeon texture
- Vocabulary: Quest, Boss Battle, XP, Eldrin the Chronomancer, Guild of Scholars

**2. Space Explorer**
- Deep navy/cyan palette, monospace accents, star field background
- Vocabulary: Mission, Launch Deadline, Credits, Commander Orion, Deep Space Corps

**3. Cyberpunk Hacker**
- Black/green terminal palette, glitch effects, scan-line overlay
- Vocabulary: Hack, Zero Day, Rep, Ghost, The Grid

Themes are stored in `lib/themes/` as static TypeScript objects — no database round-trip needed. The student's selected theme ID is stored in their `profiles` table row and fetched once on login.

---

## Database Schema (Supabase / Prisma)

The schema is deliberately neutral. No RPG words anywhere.

```prisma
// prisma/schema.prisma

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  role          Role      @default(STUDENT)
  createdAt     DateTime  @default(now())
  profile       Profile?
  enrollments   Enrollment[]
  aiJobs        AIGenerationJob[]
  courses       Course[]          // courses this user teaches
  habits        Habit[]
  peerReviewsGiven PeerReview[]   // peer reviews authored by this user
}

enum Role {
  ADMIN      // platform-wide authority: manages all users, courses, roles, and data
  TEACHER    // manages own courses, assignments, knowledge bases, and enrollments
  STUDENT    // reads enrolled course content, tracks own progress
}

// Teacher-authored reference material attached to a course.
// Used as context for the AI mentor and for knowledge check generation.
model KnowledgeBase {
  id            String       @id @default(uuid())
  courseId      String
  course        Course       @relation(fields: [courseId], references: [id])
  title         String
  content       String       // markdown — written by teacher or AI-generated
  sourceType    KBSourceType @default(MANUAL)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

enum KBSourceType {
  MANUAL        // teacher typed it directly
  AI_ASSISTED   // teacher used internal LLM interview flow
  IMPORT        // pasted back from external LLM via JSON schema
}

// Tracks in-progress and completed AI generation jobs for assignments and knowledge bases.
// Allows the UI to show a "generating..." state and survive page refreshes.
model AIGenerationJob {
  id            String      @id @default(uuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  jobType       AIJobType
  status        AIJobStatus @default(PENDING)
  inputData     Json        // conversation history or form seed values
  outputData    Json?       // structured result once complete
  errorMessage  String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

enum AIJobType {
  ASSIGNMENT_GENERATION
  KNOWLEDGE_BASE_GENERATION
}

enum AIJobStatus {
  PENDING
  IN_PROGRESS
  COMPLETE
  FAILED
}

model Profile {
  id            String    @id @default(uuid())
  userId        String    @unique
  user          User      @relation(fields: [userId], references: [id])
  displayName   String
  themeId       String    @default("medieval")   // maps to bundled theme
  totalPoints   Int       @default(0)
  level         Int       @default(1)
  currentStreak Int       @default(0)
  bestStreak    Int       @default(0)
  lastActiveAt  DateTime?
  avatarUrl     String?
}

model Course {
  id            String    @id @default(uuid())
  teacherId     String
  teacher       User      @relation(fields: [teacherId], references: [id])
  name          String
  code          String    // e.g. "IB301"
  description   String?
  color         String    @default("#6366f1")  // teacher picks per course; used for color-coding throughout UI
  createdAt     DateTime  @default(now())
  assignments   Assignment[]
  enrollments   Enrollment[]
  tasks         Task[]    // denormalized relation for efficient dashboard queries
  knowledgeBases KnowledgeBase[]
}

model Enrollment {
  id            String    @id @default(uuid())
  userId        String
  courseId      String
  user          User      @relation(fields: [userId], references: [id])
  course        Course    @relation(fields: [courseId], references: [id])
  enrolledAt    DateTime  @default(now())

  @@unique([userId, courseId])
}

model Assignment {
  id                String         @id @default(uuid())
  courseId          String
  course            Course         @relation(fields: [courseId], references: [id])
  title             String
  description       String?
  brief             String?        // markdown — the teacher's brief, rendered for students
  dueDate           DateTime
  weight            Float          @default(0)    // grade weight as %, e.g. 40.0
  difficulty        Difficulty     @default(MEDIUM)
  pointValue        Int            @default(100)  // XP for engagement (not grade proxy)
  assessmentMode    AssessmentMode @default(SELF_ASSESSED)
  createdAt         DateTime       @default(now())
  tasks             Task[]
  submissions       Submission[]
  rubric            Rubric?
  peerReviewConfig  PeerReviewConfig?
  anchorSubmission  AnchorSubmission?
}

enum AssessmentMode {
  SELF_ASSESSED     // student reflects + AI validates calibration
  PEER_REVIEW       // students review each other against a shared rubric
  SOCRATIC          // AI Socratic dialogue produces understanding report
  TEACHER_GRADED    // traditional: teacher reviews AI pre-grade and overrides
  HYBRID            // combination configured per assignment
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
  BOSS
}

// Rubric is teacher-defined criteria used by peer review, AI grading, and self-assessment prompts.
// Each criterion has a name, description, and max score.
model Rubric {
  id            String          @id @default(uuid())
  assignmentId  String          @unique
  assignment    Assignment      @relation(fields: [assignmentId], references: [id])
  criteria      RubricCriterion[]
}

model RubricCriterion {
  id            String  @id @default(uuid())
  rubricId      String
  rubric        Rubric  @relation(fields: [rubricId], references: [id])
  label         String  // e.g. "Argument clarity", "Use of sources"
  description   String  // what excellent looks like
  maxScore      Int     @default(10)
  order         Int     @default(0)
}

// One teacher-graded submission used as the calibration anchor for peer review.
model AnchorSubmission {
  id              String     @id @default(uuid())
  assignmentId    String     @unique
  assignment      Assignment @relation(fields: [assignmentId], references: [id])
  content         String     // the work itself (markdown or URL)
  teacherScores   Json       // { criterionId: score } map
  teacherFeedback String?
}

// Configuration for peer review assignments.
model PeerReviewConfig {
  id                    String     @id @default(uuid())
  assignmentId          String     @unique
  assignment            Assignment @relation(fields: [assignmentId], references: [id])
  boardEnabled          Boolean    @default(true)  // true = board model; false = assigned model
  anonymized            Boolean    @default(true)  // whether poster identity is hidden on board
  calibrationRequired   Boolean    @default(true)  // must pass anchor review before posting a review
  minReviewsToReceive   Int        @default(2)     // board: how many reviews before score is computed
}

model Task {
  id            String    @id @default(uuid())
  assignmentId  String
  assignment    Assignment @relation(fields: [assignmentId], references: [id])
  courseId      String
  course        Course    @relation(fields: [courseId], references: [id])
  title         String
  taskType      TaskType  @default(STUDY)
  estimatedMins Int       @default(30)
  pointValue    Int       @default(20)
  order         Int       @default(0)
  unlocksAfter  String?
  completions   TaskCompletion[]
}

enum TaskType {
  STUDY
  RESEARCH
  WRITING
  REVIEW
  QUIZ
  PRACTICE
  REFLECTION    // self-assessment response
  PEER_REVIEW   // reviewing a peer's submission
  SOCRATIC      // Socratic dialogue session
}

model TaskCompletion {
  id            String   @id @default(uuid())
  taskId        String
  userId        String
  task          Task     @relation(fields: [taskId], references: [id])
  completedAt   DateTime @default(now())
  pointsAwarded Int

  @@unique([taskId, userId])
}

// The core submission record. progressPct tracks task completion.
// finalScore and masteryLevel are separate from XP — they measure understanding, not effort.
model Submission {
  id                  String           @id @default(uuid())
  assignmentId        String
  userId              String
  assignment          Assignment       @relation(fields: [assignmentId], references: [id])
  status              SubmissionStatus @default(IN_PROGRESS)
  progressPct         Float            @default(0)
  content             String?          // the actual work, markdown or file URL
  submittedAt         DateTime?
  // Assessment outputs — populated after grading, independent of XP
  finalScore          Float?           // 0–100, derived from evidence
  masteryLevel        MasteryLevel?    // qualitative understanding indicator
  teacherOverride     Boolean          @default(false)
  releasedAt          DateTime?        // when feedback became visible to student
  selfAssessment      SelfAssessment?
  socraticdialogue    SocraticDialogue?
  peerReviewsReceived PeerReview[]     @relation("reviewee")
  aiFeedback          AIFeedback?
  // Board fields — posting is a deliberate second act after submitting
  postedToBoard       Boolean          @default(false)
  postedAt            DateTime?
  boardPinned         Boolean          @default(false) // teacher can pin exemplary posts
  boardHidden         Boolean          @default(false) // teacher can hide inappropriate posts
}

enum SubmissionStatus {
  NOT_STARTED
  IN_PROGRESS
  SUBMITTED
  UNDER_REVIEW     // peer review or Socratic in progress
  AI_GRADED        // AI has produced score + feedback, pending teacher review
  TEACHER_REVIEWED // teacher has seen and optionally adjusted
  RELEASED         // feedback visible to student
}

enum MasteryLevel {
  BEGINNING
  DEVELOPING
  PROFICIENT
  ADVANCED
}

// Self-assessment: student reflects on their own work before any external review.
model SelfAssessment {
  id                  String     @id @default(uuid())
  submissionId        String     @unique
  submission          Submission @relation(fields: [submissionId], references: [id])
  reflectionResponses Json       // { questionId: answer } — questions generated from brief
  selfScore           Float      // student's own score estimate 0–100
  confidenceLevel     Int        // 1–5
  completedAt         DateTime   @default(now())
  // Calibration result after Socratic probing
  calibrationScore    Float?     // how accurate self-score was vs final score
  socraticdialogue    SocraticDialogue?
}

// Socratic dialogue session — used both standalone and as self-assessment validation.
model SocraticDialogue {
  id              String      @id @default(uuid())
  submissionId    String?     @unique
  submission      Submission? @relation(fields: [submissionId], references: [id])
  selfAssessmentId String?    @unique
  selfAssessment  SelfAssessment? @relation(fields: [selfAssessmentId], references: [id])
  transcript      Json        // array of { role, content } messages
  understandingReport Json    // structured AI report: { strengths[], gaps[], recommendations[] }
  completedAt     DateTime    @default(now())
}

// Peer review: one student reviews another's board post.
// Voluntary in the board model — any calibrated student in the course can review any post.
model PeerReview {
  id                  String     @id @default(uuid())
  submissionId        String     // submission being reviewed (the board post)
  reviewerUserId      String     // the reviewing student's user ID
  submission          Submission @relation("reviewee", fields: [submissionId], references: [id])
  reviewer            User       @relation(fields: [reviewerUserId], references: [id])
  criterionScores     Json       // { criterionId: score } map
  qualitativeFeedback String     // required — must leave a comment, not just scores
  criterionComments   Json?      // optional per-criterion comments { criterionId: comment }
  calibrationScore    Float?     // reviewer's calibration score for this assignment (set at unlock)
  isAnchorReview      Boolean    @default(false) // true if this is the calibration anchor review
  completedAt         DateTime   @default(now())
}

// Tracks which students have unlocked reviewing rights for a given assignment
// by successfully completing the anchor calibration review.
model ReviewerCalibration {
  id               String     @id @default(uuid())
  userId           String
  assignmentId     String
  calibrationScore Float      // closeness to teacher anchor scores, 0–1
  unlockedAt       DateTime   @default(now())

  @@unique([userId, assignmentId])
}

// AI-generated grade and feedback, produced before teacher review.
model AIFeedback {
  id                  String     @id @default(uuid())
  submissionId        String     @unique
  submission          Submission @relation(fields: [submissionId], references: [id])
  criterionScores     Json       // { criterionId: score } map
  overallScore        Float
  feedbackMarkdown    String     // detailed feedback in markdown
  quickWins           String[]   // 2–3 specific, actionable improvements
  strengths           String[]   // what the student did well
  confidenceLevel     Float      // AI's own confidence 0–1; low = flag for teacher
  generatedAt         DateTime   @default(now())
}

model Habit {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  title         String
  frequency     HabitFrequency @default(DAILY)
  pointValue    Int       @default(10)
  completions   HabitCompletion[]
}

enum HabitFrequency {
  DAILY
  WEEKLY
}

model HabitCompletion {
  id            String    @id @default(uuid())
  habitId       String
  userId        String
  habit         Habit     @relation(fields: [habitId], references: [id])
  completedAt   DateTime  @default(now())
  pointsAwarded Int
}

model Achievement {
  id            String    @id @default(uuid())
  userId        String
  achievementKey String   // e.g. "first_quest", "boss_slayer", "week_warrior"
  unlockedAt    DateTime  @default(now())

  @@unique([userId, achievementKey])
}
```

---

## App Structure

```
app/
  (auth)/
    login/page.tsx              # Magic link entry
    verify/page.tsx             # Email verification landing

  (admin)/
    layout.tsx                  # Admin shell — neutral, data-dense, distinct from teacher UI
    dashboard/page.tsx          # Platform overview: total users, courses, activity stats
    users/
      page.tsx                  # All users table: name, email, role, last active, enrolled courses
      [userId]/page.tsx         # User detail: edit role, view enrollments, reset/deactivate
    courses/
      page.tsx                  # All courses across all teachers
      [courseId]/page.tsx       # Course detail with full override rights
    settings/page.tsx           # Platform-wide settings: default theme, feature flags

  (teacher)/
    layout.tsx                  # Teacher shell — neutral UI, no theme
    dashboard/page.tsx          # All courses overview: enrollment counts, upcoming deadlines
    courses/
      page.tsx                  # Course list with + New Course
      [courseId]/
        page.tsx                # Course detail: assignments list + per-student progress table
        edit/page.tsx           # Edit course name, code, color picker
        assignments/
          new/page.tsx          # Assignment creation hub — three modes (see below)
          [assignmentId]/
            page.tsx            # Assignment detail: brief preview, task list, submission overview
            edit/page.tsx       # Edit brief (markdown), due date, weight, difficulty, XP
        knowledge/
          page.tsx              # Knowledge base list for this course
          new/page.tsx          # Knowledge base creation hub — three modes (see below)
          [kbId]/edit/page.tsx
        board/page.tsx          # Board overview: all posted submissions, review counts, pin/hide controls
        grading/page.tsx        # AI pre-grade queue: confidence-sorted, inline adjustment, bulk release
        students/page.tsx       # Enrolled students, invite by email, enrollment link

  (student)/
    layout.tsx                  # Student shell — applies active theme
    dashboard/page.tsx          # "Today's Journey": prioritized tasks, approaching deadlines, habits
    quests/page.tsx             # Quest Board: all assignments, filterable by course
    quests/[assignmentId]/page.tsx  # Assignment detail: brief (rendered markdown) + task chain
    board/page.tsx              # Course selector → redirect to first enrolled course board
    board/[courseId]/page.tsx   # The bulletin board: posted submissions for this course
    board/[courseId]/review/[submissionId]/page.tsx  # Side-by-side review UI
    board/[courseId]/calibrate/[assignmentId]/page.tsx  # Anchor calibration before unlocking
    calendar/page.tsx           # Weekly grid, blocks color-coded by course color
    bosses/page.tsx             # Deadlines view grouped by course
    knowledge/page.tsx          # All pending quizzes across courses
    habits/page.tsx
    mentor/page.tsx             # AI chat
    profile/page.tsx
    settings/page.tsx           # Theme selector

  api/
    auth/[...nextauth]/route.ts
    admin/
      users/route.ts            # CRUD users, role changes — ADMIN only
      users/[userId]/route.ts
    courses/route.ts
    assignments/route.ts
    tasks/route.ts
    completions/route.ts
    habits/route.ts
    knowledge-bases/route.ts
    ai/
      generate/route.ts         # Internal LLM generation endpoint (assignments + knowledge bases)
      interview/route.ts        # Streaming interview conversation endpoint
      grade/route.ts            # AI pre-grade a submission against rubric
      socratic/route.ts         # Streaming Socratic dialogue
      synthesize-reviews/route.ts  # Synthesise peer reviews into AIFeedback once threshold met
      reflect/route.ts          # Generate reflection questions from assignment brief
    board/
      [courseId]/route.ts       # GET posted submissions for a course, POST to post/unpost
      review/route.ts           # POST a peer review, GET reviews for a submission
    mentor/route.ts             # Student-facing AI mentor
    themes/route.ts

lib/
  themes/
    index.ts
    medieval.ts
    space.ts
    cyber.ts
    types.ts
  supabase.ts
  prisma.ts
  points.ts
  achievements.ts
  getDailyTasks.ts
  auth/
    requireRole.ts              # Server-side role guard: throws if session role < required
  ai/
    assignmentSchema.ts         # Zod schema for AI-generated assignment JSON
    knowledgeBaseSchema.ts      # Zod schema for AI-generated knowledge base JSON
    prompts.ts                  # All system prompts for generation + interview modes
    parseImport.ts              # Validates and maps pasted JSON → form values

components/
  student/
    ThemeProvider.tsx
    CourseFilterBar.tsx
    StatCard.tsx
    AssignmentCard.tsx
    TaskRow.tsx
    HabitCard.tsx
    MentorChat.tsx
    AssignmentBrief.tsx
  student/board/
    BoardView.tsx               # Course board: filterable grid of submission cards
    SubmissionCard.tsx          # Card on the board: brief preview, poster, review count, CTA
    ReviewForm.tsx              # Side-by-side brief + submission + rubric scoring form
    CalibrationGate.tsx         # Anchor review UI shown before unlocking
    PostToBoardButton.tsx       # Shown on assignment detail after submission
  teacher/
    BoardOverview.tsx           # Teacher view: all posts, pin/hide, review count per submission
    AssignmentForm.tsx
    AssignmentCreationHub.tsx   # Mode selector: Manual | Import | AI Generate
    KnowledgeBaseForm.tsx
    KnowledgeBaseCreationHub.tsx
    AIInterviewChat.tsx         # Streaming chat UI for internal interview mode
    ImportPastePanel.tsx        # Textarea + validate button for external LLM import
    ExportPromptPanel.tsx       # Shows copyable prompt for external LLM mode
    TaskBuilder.tsx
    CourseCard.tsx
    ColorPicker.tsx
    SubmissionTable.tsx
  admin/
    UserTable.tsx               # Sortable/filterable table of all users
    RoleSelector.tsx            # Inline role change dropdown
    PlatformStatsBar.tsx        # Total users, active courses, completions today
  shared/
    ProgressBar.tsx
    DifficultyBadge.tsx
    XPBadge.tsx
    CourseColorDot.tsx
```

---

## Theme Provider — How It Works

```typescript
// components/student/ThemeProvider.tsx
'use client';

import { createContext, useContext } from 'react';
import { WorldTheme } from '@/lib/themes/types';
import { themes } from '@/lib/themes';

const ThemeContext = createContext<WorldTheme>(themes.medieval);

export function ThemeProvider({ themeId, children }: { 
  themeId: string; 
  children: React.ReactNode 
}) {
  const theme = themes[themeId] ?? themes.medieval;
  
  // Inject CSS variables from palette
  const cssVars = Object.entries(theme.palette)
    .map(([k, v]) => `--color-${k}: ${v}`)
    .join('; ');

  return (
    <ThemeContext.Provider value={theme}>
      <div 
        style={{ cssText: cssVars } as React.CSSProperties}
        className={`theme-root ${theme.cssTheme}`}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// Usage anywhere in student views:
// const theme = useTheme();
// <h1>{theme.vocabulary.dashboardGreeting}</h1>
// <span>{theme.vocabulary.points}</span>
```

---

## What to Build (Feature Priority)

### Phase 1 — Core (build first)

**Authentication**
- Magic link via Resend — no passwords, simpler for students
- Role detection on login: redirect teacher → `/teacher/dashboard`, student → `/student/dashboard`
- Store session via Supabase Auth

**Teacher: Course + Assignment Builder**
- Create course with name, code, and color (12 preset swatches — not a free-form color picker)
- Assignment creation via `AssignmentCreationHub`: three modes — Manual Form, External LLM Import (copy-paste JSON), Internal AI Interview (streaming chat inside the tool). All three modes flow into the same review form before saving. See the "Three Modes" section for full detail.
- Knowledge base creation via `KnowledgeBaseCreationHub`: same three modes, simpler output (title + markdown content)
- Task builder: ordered list of tasks per assignment, each with type, estimated time, XP
- Optional: mark tasks as locked until previous task is complete
- Enrollment: invite students by email or share a `/enroll?code=XYZ` link

**Admin**
- Seed the first admin directly via SQL (see First Admin Setup section)
- Admin dashboard: platform stats, all-users table with inline role editor, all-courses table
- Role changes via `RoleSelector` take effect on next login
- All admin routes protected by `requireRole('ADMIN')` server-side guard

**Teacher: Course Detail View**
- Assignment list for this course with progress summary (e.g. "18/24 students started")
- `SubmissionTable`: per-student rows showing status, progress %, grade (once entered)
- This is the teacher's primary grading and monitoring surface

**Teacher: Dashboard**
- Cards per course showing enrollment count, number of active assignments, next deadline
- Not the same as the student dashboard — neutral, data-dense, no gamification

**Student: Dashboard**
- Today's prioritized tasks (see `getDailyTasks` logic below)
- Each task shows a `CourseColorDot` and course code so the student always knows context
- Approaching deadlines sidebar, grouped and color-coded by course
- Daily habits section
- Stats bar: weekly XP, streak, assignments done, deadlines beaten
- Mentor daily quote (static array from theme, no API call)

**Student: Quest Board (Assignment List)**
- `CourseFilterBar` at top: pill buttons "All | IB301 | MKT202 | FIN101", each pill uses the course color
- Each assignment card shows a left color stripe matching its course color
- Progress bar, difficulty badge, days remaining, XP reward
- Defaults to "All" — filter state lives in URL param (`?course=IB301`) so it's shareable/bookmarkable

**Student: Assignment Detail**
- Renders teacher's markdown `brief` field in full — this replaces emailing a PDF brief
- Task chain below the brief: sequential steps with lock/unlock state
- Mark task complete → award XP → check achievements → recalculate progress %

**Student: Profile + Theme Selector**
- Total XP, level, best streak, completed count
- Achievement grid (locked/unlocked states)
- Theme selector: 3 cards showing world name, palette preview, and sample vocabulary ("Quests" vs "Missions" vs "Hacks") — select and save

### Phase 2 — Add after core works

**Calendar View**
- Weekly grid, blocks color-coded by course color (not task type)
- Tasks and deadlines rendered as blocks; clicking a block opens the assignment detail
- Course legend at top showing all enrolled courses with their colors

**Habits**
- Student creates own habits (not teacher-controlled)
- Daily/weekly frequency, streak tracking, XP per check-in

**Knowledge Check**
- Teacher attaches MCQ questions to a specific assignment (not free-floating)
- In the student's task chain, a quiz task opens the Knowledge Check UI for that assignment
- The global `/knowledge` page is just a filtered view of all pending quiz tasks across courses
- Student completes quiz → XP reward → feeds into assignment progress %

**Assessment Modes (Phase 2 — after basic submission works)**
- Self-assessment with Socratic validation: reflection question generation + dialogue UI
- Peer review: anchor submission upload, reviewer assignment, calibration scoring
- Socratic standalone: AI reads submission and opens dialogue
- AI pre-grade queue: teacher grading queue with confidence indicators and bulk release
- Build one mode fully before adding the next. Suggested order: AI pre-grade → self-assessment → peer review → Socratic standalone

**AI Mentor Chat**
- Route `/api/mentor` proxies to Claude API (`claude-sonnet-4-20250514`)
- System prompt is themed: medieval wizard / space commander / cyber ghost persona
- Context injected: student's current assignments across all courses, deadlines, progress
- 4 starter prompts: Study plan / Break down task / Study tips / Stay motivated
- Stream the response — don't wait for full completion (Vercel 10s timeout)

### Phase 3 — Omit for now (scope risk)

- Learning path AI generation from uploaded PDFs (complex, needs queue)
- TimeEdit timetable import
- Peer collaboration / group assignments
- Grade analytics dashboard for teachers
- Push notifications
- Admin audit log (who changed what and when)
- Bulk user import via CSV

---

## Multi-Course: getDailyTasks Logic

This is the most important function for making a multi-course setup feel manageable rather than overwhelming. It runs server-side and returns a prioritized flat list of tasks for the student's dashboard.

```typescript
// lib/getDailyTasks.ts

interface DailyTask {
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  estimatedMins: number;
  pointValue: number;
  assignmentId: string;
  assignmentTitle: string;
  assignmentDueDate: Date;
  assignmentWeight: number;
  courseId: string;
  courseCode: string;
  courseColor: string;
  isUnlocked: boolean;
  priorityScore: number;  // computed — not stored
}

export async function getDailyTasks(userId: string): Promise<DailyTask[]> {
  // 1. Fetch all incomplete tasks across all enrolled courses
  //    Join: Task → Assignment → Course, filter by enrollment
  //    Exclude tasks where TaskCompletion exists for this userId
  
  // 2. Determine unlock state for each task
  //    A task is unlocked if unlocksAfter is null,
  //    OR if the task referenced by unlocksAfter has a TaskCompletion for this user

  // 3. Score each unlocked task by priority:
  const score = (task: RawTask): number => {
    const daysUntilDue = differenceInDays(task.assignment.dueDate, new Date());
    const urgency = Math.max(0, 30 - daysUntilDue) / 30;        // 0–1, higher = more urgent
    const weight = task.assignment.weight / 100;                  // 0–1
    const recency = task.assignment.progressPct < 0.1 ? 0.1 : 0; // boost not-yet-started
    return (urgency * 0.5) + (weight * 0.4) + (recency * 0.1);
  };

  // 4. Sort by score descending, return top 8 tasks
  //    Cap at 2 tasks per course so no single course dominates the dashboard
  
  // 5. Locked tasks are included but rendered greyed-out at the bottom,
  //    so students understand what's coming without being blocked visually
}
```

**Why this matters:** without this function, a student with 4 courses and 20 assignments sees a wall of tasks. With it, the dashboard surfaces the 8 tasks that matter most today — weighted by deadline urgency and assignment grade weight — while respecting task unlock order. The course cap (max 2 per course) ensures no single heavy course crowds out others.

---

## Course Color System

Course colors are the primary visual anchor throughout the student UI. They are set by the teacher once and propagate everywhere automatically.

Rules:
- Teacher picks from 12 preset colors when creating a course (not a free-form picker — consistency matters)
- The color appears as: a left border stripe on assignment cards, a filled pill on the `CourseFilterBar`, a small dot (`CourseColorDot`) next to every task on the dashboard, and as the background color of calendar blocks
- Colors are stored as hex on the `Course` model and fetched with every query that includes course data
- Suggested preset palette: `#6366f1` (indigo), `#0ea5e9` (sky), `#10b981` (emerald), `#f59e0b` (amber), `#ef4444` (red), `#8b5cf6` (violet), `#ec4899` (pink), `#14b8a6` (teal), `#f97316` (orange), `#84cc16` (lime), `#06b6d4` (cyan), `#a78bfa` (purple)

---

## Teacher Dashboard vs Student Dashboard

These are two completely separate experiences sharing the same data.

**Teacher dashboard** — neutral, information-dense:
- Course cards showing: course name/code, color swatch, enrollment count, active assignment count, next deadline
- Clicking a course → Course Detail: assignment list + `SubmissionTable` (student × assignment progress matrix)
- No XP, no streaks, no gamification — teachers should not have to decode RPG metaphors
- Markdown editor for assignment briefs (use a simple library like `@uiw/react-md-editor`)

**Student dashboard** — themed, motivational:
- Reads from the same assignments/tasks/submissions but renders through the theme vocabulary
- The teacher's `brief` markdown renders in the assignment detail view using `react-markdown`
- Assignment weight (40%) is never shown raw to students — it maps to the XP value and difficulty badge instead, which communicate stakes without GPA anxiety

---



```typescript
// lib/points.ts

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5700, 7500
];

export function getLevelFromXP(xp: number): number {
  return LEVEL_THRESHOLDS.findLastIndex(threshold => xp >= threshold) + 1;
}

export function getXPToNextLevel(xp: number): { current: number; needed: number } {
  const level = getLevelFromXP(xp);
  const needed = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const current = xp - LEVEL_THRESHOLDS[level - 1];
  return { current, needed: needed - LEVEL_THRESHOLDS[level - 1] };
}

// Achievement keys
export const ACHIEVEMENTS = {
  FIRST_QUEST: { key: 'first_quest', label: 'First Quest', condition: (stats) => stats.questsDone >= 1 },
  BOSS_SLAYER: { key: 'boss_slayer', label: 'Boss Slayer', condition: (stats) => stats.bossesDefeated >= 5 },
  WEEK_WARRIOR: { key: 'week_warrior', label: 'Week Warrior', condition: (stats) => stats.bestStreak >= 7 },
  KNOWLEDGE_SEEKER: { key: 'knowledge_seeker', label: 'Knowledge Seeker', condition: (stats) => stats.quizzesCompleted >= 10 },
  SCHOLAR_ELITE: { key: 'scholar_elite', label: 'Scholar Elite', condition: (stats) => stats.level >= 10 },
  CHRONOMANCER: { key: 'chronomancer', label: 'Chronomancer', condition: (stats) => stats.bestStreak >= 30 },
};
```

---

## Assessment System

The traditional submit-wait-grade loop is replaced by a system where assessment is continuous, evidence-based, and feedback is oriented toward quick wins and growth rather than verdict delivery. The `finalScore` and `masteryLevel` fields on `Submission` are populated from accumulated evidence — not a single grading event. XP rewards engagement with the process; mastery level reflects understanding.

**Core principle: separate effort from outcome.** A student who engages deeply with a hard assignment earns XP regardless of their final score. `finalScore` and `masteryLevel` are the understanding signal; `pointsAwarded` on task completions is the effort signal. Teachers and students see both, but they are never conflated.

---

### Assessment Mode 1 — Self-Assessment with Socratic Validation

**When to use:** formative assignments, reflection tasks, work where the process matters as much as the output.

**Flow:**

1. Student completes their tasks and optionally submits work content
2. The system generates 4–6 reflection questions from the assignment brief using the AI (`/api/ai/generate-reflection-questions`). Questions target: what they did, what was difficult, what they'd change, and one or two content-specific probes derived from the rubric criteria
3. Student answers the reflection questions and gives a self-score (0–100) and confidence level (1–5) — this is the `SelfAssessment` record
4. The AI then runs a short Socratic dialogue (3–5 exchanges) to validate the student's confidence. It probes the weakest area of their self-assessment — not to test, but to surface gaps: *"You said you're confident about your market analysis — what assumption is your conclusion most dependent on?"*
5. The AI compares the student's responses against the rubric and produces an `understandingReport`: strengths, gaps, and 2–3 specific recommendations
6. `calibrationScore` is computed: how close the student's self-score was to the AI's assessment. This feeds back into the student's metacognitive profile over time — students who self-assess accurately earn a "calibration streak" achievement
7. Teacher sees a summary view: self-score, AI validation score, calibration gap, understanding report. Can override or add qualitative feedback before releasing

**XP awarded:** completing the reflection (base XP) + bonus XP for high calibration accuracy (within 10 points of final score)

---

### Assessment Mode 2 — Peer Review via the Board

**When to use:** assignments where reading peer work is itself a learning activity — case analyses, reports, presentations, arguments. The board model makes review a social, voluntary act rather than an administrative obligation.

**The core idea:** instead of the system assigning submissions to reviewers, students post their work to a course bulletin board. Other students in the course browse the board and choose which submissions to review. Participation is voluntary but incentivised. The brief is always displayed alongside the submission so reviewers have full context on what was asked.

**Two actions, deliberately separated:**
- *Submitting* is required and private — the student hands in their work by the deadline
- *Posting to the board* is a second, conscious act — the student decides to make their work visible to peers. This distinction matters: it gives students agency over their own visibility, and it means the board only contains work students are prepared to stand behind

**Flow:**

1. **Teacher setup:** configures `PeerReviewConfig` — enable board, anonymized or attributed, calibration required (recommended). Creates a `Rubric` with criteria and uploads an `AnchorSubmission` with their own scoring — this is the calibration reference

2. **Calibration unlock:** before a student can post any review on the board, they must review the anchor submission. Their criterion scores are compared to the teacher's `teacherScores`. The score gap becomes their `calibrationScore`, stored in `ReviewerCalibration`. Once unlocked, they can review any board post for this assignment

3. **Posting:** after submitting their work, the student sees a "Post to Board" button on their assignment detail page. Posting sets `postedToBoard = true` and `postedAt`. Their submission card now appears on the course board

4. **The Board** (`/student/courses/[courseId]/board`):
   - Cards for each posted submission, showing: assignment title, assignment brief (always visible — the brief is the frame for evaluation), poster name or "Anonymous Scholar" depending on config, number of reviews received so far, a "Review this" CTA
   - Filter by assignment, sort by: fewest reviews (surface under-reviewed work), most recent, most reviewed
   - A student cannot review their own post
   - A student who has not yet completed calibration for an assignment sees a "Unlock reviewing for [assignment]" prompt instead of the review CTA

5. **Reviewing:** clicking "Review this" opens a side-by-side view — assignment brief on the left, submission on the right, rubric form below. Each criterion requires a score and a written comment (no score-only reviews). An optional per-criterion comment field allows more targeted feedback

6. **Score computation:** when a submission has received `minReviewsToReceive` reviews (default 2), the system computes its peer score:
   ```
   peerScore = weightedAverage(
     reviews.map(r => r.criterionWeightedScore),
     weights = reviews.map(r => r.calibrationScore)  // better-calibrated reviewers count more
   )
   ```
   This runs automatically — no manual triggering needed

7. **AI synthesis:** once `minReviewsToReceive` is reached, `/api/ai/synthesize-peer-reviews` runs and creates an `AIFeedback` record summarising reviewer consensus: consistent strengths, consistent gaps, and 2–3 quick wins. This is what the student sees as their feedback headline

8. **Teacher oversight:** the teacher's board view (`/teacher/courses/[courseId]/board`) shows all posted submissions, review counts, computed peer scores, and AI synthesis. Teacher can: pin exemplary posts (surfaced at the top for the whole class), hide inappropriate posts, manually adjust the final score before releasing

9. **Release:** teacher reviews the aggregated score + AI synthesis, adjusts if needed, and releases. Student sees feedback with mastery level first, score on demand

**Incentive structure:**
- Students who want reviews need to *be* reviewers — the system surfaces under-reviewed posts first
- High calibration score earns bonus XP and a "Sharp Eye" achievement
- Posting to the board earns XP (putting your work out is an act of intellectual courage)
- Each review completed earns XP regardless of calibration quality

**XP awarded:** submitting own work, completing calibration anchor review (+ bonus for accuracy), posting to board, each peer review completed, bonus XP for calibration score above threshold.

**What the teacher sees that they didn't before:** the board view is pedagogically rich. A teacher can see which arguments peers found persuasive, which gaps multiple reviewers independently flagged, and which posts attracted the most engagement. Pinned posts become implicit exemplars — the class can see what "good" looks like without the teacher having to say it explicitly.

**Schema notes:**
- `PeerReview.reviewerUserId` is the user ID directly (not a Submission ID) since the reviewer may not have posted their own work to the board. The `reviewer` relation is on `User`, not `Submission` — and `peerReviewsGiven` lives on the `User` model accordingly
- `ReviewerCalibration` is a separate table tracking unlock status per student per assignment — decoupled from the review itself so calibration status is queryable without joining through reviews
- `qualitativeFeedback` on `PeerReview` is non-optional — the system enforces a minimum 50-character comment before submission is allowed

---

### Assessment Mode 3 — Socratic Dialogue (Standalone)

**When to use:** high-stakes assignments, exam preparation, cases where AI-assisted verification of understanding is the primary assessment mechanism. Most useful when the teacher suspects work may not fully reflect the student's own understanding.

**Flow:**

1. Student submits their work (content field on Submission)
2. The AI reads the assignment brief, rubric, and submitted work, then opens a Socratic dialogue session
3. The AI asks 5–8 open questions, escalating in depth. It is not looking for a single right answer — it is mapping the topology of the student's understanding: where it is solid, where it is thin, where it collapses under probing
4. The dialogue is conversational, not interrogatory. The AI acknowledges good answers, asks follow-ups, and says "that's interesting — can you say more about X?" rather than "wrong"
5. On completion, the AI produces a structured `understandingReport`:
   ```json
   {
     "strengths": ["Clear grasp of X", "Good use of Y framework"],
     "gaps": ["Assumption about Z not examined", "Unclear on the difference between A and B"],
     "recommendations": [
       "Re-read section 3 of the brief with focus on Z",
       "Try applying your argument to the counter-case in example 2"
     ],
     "suggestedScore": 72,
     "confidenceLevel": 0.81
   }
   ```
6. Teacher reviews the transcript and report. The transcript is the evidence — the teacher can see exactly what the student understood and what they didn't, not just a number
7. Teacher confirms, adjusts score, and adds any qualitative feedback before releasing

**XP awarded:** completing the dialogue session (regardless of score)

---

### Assessment Mode 4 — AI Pre-Grade with Teacher Review Queue

**When to use:** traditional submitted work where the teacher still wants to be in the loop but wants AI to do the first pass. The default for most formal assignments.

**Flow:**

1. Student submits work content (markdown or file URL)
2. `/api/ai/grade` runs: AI reads brief, rubric, and submission. Produces `AIFeedback`: criterion scores, overall score, feedback markdown, quick wins, strengths, confidence level
3. Submission status moves to `AI_GRADED`
4. Teacher sees a grading queue sorted by: flagged low-confidence items first, then by submission time. Each item shows the AI score, confidence level, and a preview of the feedback
5. Teacher clicks in, reviews the AI feedback, edits criterion scores inline if needed, adds or replaces qualitative feedback, marks as reviewed
6. After teacher review (or after 24h auto-release window for high-confidence items), status moves to `RELEASED` and the student sees their feedback

**The grading queue UI (`/teacher/courses/[courseId]/grading`):**
- Table: student name, assignment, AI score, confidence (green/yellow/red indicator), submitted at, status
- Filter by: needs review, auto-releasable, already released
- Bulk action: release all high-confidence items
- Inline score adjustment without leaving the queue

**XP awarded:** none for submission itself. XP is earned during the task chain (the work). The grade is separate.

---

### Feedback Design — Quick Wins and Growth Language

Regardless of assessment mode, all feedback shown to students follows these rules, enforced by the AI system prompt and the teacher UI:

- **Always include quick wins:** 2–3 specific, actionable things the student can do right now. Not "improve your analysis" — "Your market sizing in section 2 uses only one data source. Adding the industry report from your reading list would strengthen that claim directly."
- **Strengths first:** feedback opens with what worked, not what didn't
- **No grade-first display:** students see the feedback and mastery level before they see the numeric score. The score is one click away, not the headline
- **Mastery language over percentages in the student UI:** `PROFICIENT` rather than 74%. The numeric score is available but not the default view. Teachers always see the numeric score.
- **Separation of effort and outcome:** the student's XP total and their mastery level are shown in separate UI sections — they are measuring different things and should not be visually conflated

---

### Grading API

```typescript
// app/api/ai/grade/route.ts
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: Request) {
  const { submissionId, submissionContent, brief, rubricCriteria } = await req.json();

  const systemPrompt = `You are an expert educational assessor. Your job is to evaluate student work 
fairly and produce feedback that helps the student improve. Always lead with strengths. 
Quick wins must be specific and immediately actionable — never vague.
Output ONLY valid JSON matching the AIFeedback schema. No preamble.`;

  const userPrompt = `
Assignment brief: ${brief}

Rubric criteria:
${rubricCriteria.map(c => `- ${c.label} (max ${c.maxScore}): ${c.description}`).join('
')}

Student submission:
${submissionContent}

Produce a JSON object with:
- criterionScores: { criterionId: score } (score must not exceed maxScore)
- overallScore: weighted average 0-100
- feedbackMarkdown: 200-400 word feedback, strengths-first
- quickWins: array of 2-3 specific actionable strings
- strengths: array of 2-3 strings
- confidenceLevel: your confidence in this assessment 0-1 
  (lower if submission is ambiguous, very short, or rubric criteria are subjective)
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = response.content[0].text;
  const parsed = AIFeedbackSchema.parse(JSON.parse(raw));

  // Save to DB and update submission status
  await prisma.aIFeedback.create({ data: { submissionId, ...parsed } });
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'AI_GRADED' },
  });

  return Response.json({ success: true });
}
```

---

### Socratic Dialogue API

```typescript
// app/api/ai/socratic/route.ts
// Streams a Socratic dialogue turn by turn.
// On the final turn, returns a tool_use block with the understandingReport.

const SOCRATIC_FINALIZE_TOOL = {
  name: 'finalize_understanding_report',
  description: 'Call when you have enough exchanges to assess understanding. Pass the structured report.',
  input_schema: {
    type: 'object',
    properties: {
      strengths: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
      suggestedScore: { type: 'number' },
      confidenceLevel: { type: 'number' },
    },
    required: ['strengths', 'gaps', 'recommendations', 'suggestedScore', 'confidenceLevel'],
  },
};

// System prompt instructs the AI to:
// - Ask open, probing questions (not yes/no)
// - Acknowledge good answers warmly
// - After 5-8 exchanges, call finalize_understanding_report
// - Never reveal that it is generating a score during the dialogue
```

---

## AI Mentor Integration



```typescript
// app/api/mentor/route.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// System prompt is generated from the student's active theme
function buildSystemPrompt(themeId: string, studentContext: StudentContext): string {
  const personas = {
    medieval: `You are Eldrin the Chronomancer, a wise and ancient wizard who guides scholars through their academic quests. Speak with warmth and archaic gravitas. Never break character. The student's current quests: ${JSON.stringify(studentContext.assignments)}`,
    space: `You are Commander Orion, a veteran deep-space officer mentoring a new recruit. Be decisive, mission-focused, and encouraging. Current missions: ${JSON.stringify(studentContext.assignments)}`,
    cyber: `You are Ghost, an elite hacker and mentor in the Grid. Speak in terse, technical, street-smart language. Current hacks in progress: ${JSON.stringify(studentContext.assignments)}`,
  };
  return personas[themeId] ?? personas.medieval;
}

export async function POST(req: Request) {
  const { messages, themeId, studentContext } = await req.json();
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: buildSystemPrompt(themeId, studentContext),
    messages,
  });
  
  return Response.json({ content: response.content[0].text });
}
```

---

## Supabase Setup Checklist

1. Create project at supabase.com
2. Enable Email auth with "Magic Link" (disable password)
3. Add Resend as custom SMTP: Settings → Auth → SMTP
4. Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
5. Run `prisma db push` to sync schema
6. Create `get_my_role()` SQL function in Supabase SQL editor (used by RLS policies):
   ```sql
   CREATE OR REPLACE FUNCTION get_my_role()
   RETURNS TEXT AS $$
     SELECT role FROM "User" WHERE id = auth.uid()::text;
   $$ LANGUAGE sql SECURITY DEFINER;
   ```
7. Apply RLS policies from the "Updated Supabase RLS Policies" section above
8. Seed first admin via SQL: `UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com'`

---

## Environment Variables

```bash
# .env.local
DATABASE_URL=postgresql://...          # Supabase connection string
DIRECT_URL=postgresql://...            # For Prisma migrations
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

---

## Vercel Free Tier Constraints to Keep in Mind

- Serverless function timeout: 10s — keep AI mentor calls snappy, stream responses
- No background jobs — achievement checks happen synchronously on task completion
- 100GB bandwidth/month — fine for a class of 30–100 students
- Use Vercel's Edge Config or just static JSON for theme configs (no DB hit for themes)

---

## Assignment & Knowledge Base Creation — Three Modes

Every assignment and knowledge base has a creation hub page (`AssignmentCreationHub`, `KnowledgeBaseCreationHub`) that presents three distinct entry points. All three modes ultimately produce the same structured output and flow into the same review form before anything is saved to the database.

---

### Mode 1 — Manual Form

The default. The teacher fills out fields directly:

- Assignment: title, brief (markdown editor), due date, weight, difficulty, XP value, then builds the task chain with `TaskBuilder`
- Knowledge base: title, content (markdown editor)

Nothing special here — this is a standard create form with a save button.

---

### Mode 2 — External LLM Import (Copy-Paste Bridge)

This mode lets a teacher use any external LLM (ChatGPT, Claude.ai, Gemini) to do the thinking, then bring the result back into the tool.

**Step 1 — Export prompt.** The teacher clicks "Generate with External AI." The tool shows an `ExportPromptPanel` containing a pre-built prompt they can copy. The prompt instructs the external LLM to:

1. Interview the teacher with targeted questions (learning objectives, deliverables, deadlines, difficulty, suggested subtasks)
2. Once it has enough, output a single JSON object matching the tool's import schema — nothing else

The export prompt is generated from `lib/ai/prompts.ts` and includes the schema inline so the external LLM knows exactly what to produce.

**Step 2 — Paste back.** Once the teacher has the JSON from the external LLM, they paste it into the `ImportPastePanel` textarea and click "Validate & Import." The tool runs `lib/ai/parseImport.ts`, which validates against the Zod schema, surfaces field-level errors if anything is malformed, and on success pre-fills the review form.

**Step 3 — Review and save.** The teacher reviews the pre-filled form, edits anything they want, and saves normally.

**The import schema** (defined in `lib/ai/assignmentSchema.ts`):

```typescript
import { z } from 'zod';

export const TaskImportSchema = z.object({
  title: z.string(),
  taskType: z.enum(['STUDY', 'RESEARCH', 'WRITING', 'REVIEW', 'QUIZ', 'PRACTICE', 'REFLECTION', 'PEER_REVIEW', 'SOCRATIC']),
  estimatedMins: z.number().int().positive(),
  pointValue: z.number().int().positive(),
  unlocksAfterIndex: z.number().int().nullable(), // index into tasks array, null = unlocked
});

export const AssignmentImportSchema = z.object({
  title: z.string(),
  brief: z.string(),           // markdown
  dueDate: z.string(),         // ISO 8601
  weight: z.number().min(0).max(100),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'BOSS']),
  pointValue: z.number().int().positive(),
  tasks: z.array(TaskImportSchema).min(1),
});

export const KnowledgeBaseImportSchema = z.object({
  title: z.string(),
  content: z.string(),         // markdown
});

export type AssignmentImport = z.infer<typeof AssignmentImportSchema>;
export type KnowledgeBaseImport = z.infer<typeof KnowledgeBaseImportSchema>;
```

The external LLM prompt (stored in `lib/ai/prompts.ts`) ends with:

```
When you have gathered enough information, output ONLY a valid JSON object matching
this exact schema and nothing else — no preamble, no explanation, no markdown fences:
[schema printed inline]
```

---

### Mode 3 — Internal AI Generation (Interview inside the tool)

Same interview logic as Mode 2, but the conversation happens inside the tool via `AIInterviewChat`. The teacher never leaves the page.

**Flow:**

1. Teacher opens the creation hub and selects "AI Interview"
2. `AIInterviewChat` renders a streaming chat UI
3. The first message is sent automatically — the AI introduces itself and asks its first question
4. The teacher answers; the AI asks follow-up questions until it has enough to generate
5. When the AI is confident, it calls a special tool (`finalize_assignment`) to signal completion — this is how the frontend knows to stop the interview and show the review form
6. The AI's final structured output is parsed with the same Zod schema as Mode 2
7. Teacher reviews pre-filled form and saves

**The generation API** at `/api/ai/generate`:

```typescript
// app/api/ai/generate/route.ts
import Anthropic from '@anthropic-ai/sdk';
import { AssignmentImportSchema } from '@/lib/ai/assignmentSchema';

const client = new Anthropic();

const FINALIZE_TOOL = {
  name: 'finalize_assignment',
  description: 'Call this when you have gathered all necessary information to generate the assignment. Pass the complete structured assignment as the argument.',
  input_schema: {
    type: 'object',
    properties: {
      assignment: AssignmentImportSchema,  // Zod-to-JSON-schema conversion
    },
    required: ['assignment'],
  },
};

export async function POST(req: Request) {
  const { messages, jobType } = await req.json();
  
  const systemPrompt = jobType === 'ASSIGNMENT_GENERATION'
    ? prompts.assignmentInterviewer   // from lib/ai/prompts.ts
    : prompts.knowledgeBaseInterviewer;

  // Stream the response back to the client
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    tools: [FINALIZE_TOOL],
    messages,
  });

  // Return as a streaming response — client listens for tool_use blocks
  return new Response(stream.toReadableStream());
}
```

**On the client**, `AIInterviewChat` listens to the stream. When it receives a `tool_use` block with `name: "finalize_assignment"`, it:
1. Parses `tool_input.assignment` through the Zod schema
2. Hides the chat UI
3. Pre-fills the review form with the validated data
4. Shows a success banner: "Your assignment is ready to review"

**Persisting job state** — when the teacher starts an AI interview, create an `AIGenerationJob` row with `status: IN_PROGRESS` and append messages to `inputData` as the conversation progresses. If the teacher refreshes mid-interview, the UI can restore the conversation from the job row. On completion, save `outputData` so the pre-filled form survives a page reload. On save, mark the job `COMPLETE`.

---

### Shared: Review Form Before Save

All three modes converge here. The review form is the same `AssignmentForm` component used in Mode 1, but pre-populated. This means:

- Teachers always have full control before anything hits the database
- The AI is never trusted to write directly to the DB — it only fills a form
- Validation errors surface naturally at the form level, regardless of input mode

---

## Admin Role

Admin is a separate role (`ADMIN` in the `Role` enum), not an extension of Teacher. Admins get their own route group `(admin)/` with a distinct shell layout.

### What Admin Can Do (That Teachers Cannot)

| Capability | Teacher | Admin |
|---|---|---|
| Create/edit own courses | ✓ | ✓ |
| View other teachers' courses | ✗ | ✓ |
| Edit other teachers' courses | ✗ | ✓ |
| Change any user's role | ✗ | ✓ |
| Add/remove any user | ✗ | ✓ |
| View all student progress across platform | ✗ | ✓ |
| Deactivate accounts | ✗ | ✓ |
| View platform-wide analytics | ✗ | ✓ |
| Change platform settings | ✗ | ✓ |

### Admin Dashboard

Three sections:

**Platform Stats Bar** — total users (broken down by role), active courses, task completions today, new signups this week. No gamification — just clean numbers.

**Users Table** (`UserTable`) — sortable, filterable table with columns: display name, email, role (inline `RoleSelector` dropdown), enrolled courses count, last active, actions (view, deactivate). Changing role via the dropdown triggers a server action that updates the `User.role` field. Role changes take effect on next login (session is not invalidated mid-session to avoid jarring UX).

**Courses Table** — all courses across all teachers, with teacher name, enrollment count, active assignment count. Admin can click into any course and has full edit rights.

### Server-Side Role Guard

All admin routes are protected by `lib/auth/requireRole.ts`:

```typescript
// lib/auth/requireRole.ts
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export async function requireRole(minRole: 'STUDENT' | 'TEACHER' | 'ADMIN') {
  const session = await getServerSession();
  if (!session) redirect('/login');
  
  const hierarchy = { STUDENT: 0, TEACHER: 1, ADMIN: 2 };
  const userLevel = hierarchy[session.user.role as keyof typeof hierarchy] ?? 0;
  const requiredLevel = hierarchy[minRole];
  
  if (userLevel < requiredLevel) redirect('/unauthorized');
  return session;
}

// Usage in any server component or route handler:
// const session = await requireRole('ADMIN');
// const session = await requireRole('TEACHER');
```

All `/api/admin/*` routes call `requireRole('ADMIN')` at the top before any DB operation. All `(admin)/` layout components call it server-side so the entire route group is gated.

### RLS Policies — Admin Additions

Add to Supabase RLS:
- `ADMIN` role bypasses all course/enrollment ownership checks (can read/write any row)
- Use a `get_my_role()` SQL function that reads `users.role` for the current session user, and reference it in policies to avoid hardcoding

### First Admin Setup

The first admin cannot be created via the UI (chicken-and-egg). Seed it directly:

```sql
-- Run once in Supabase SQL editor after first signup
UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';
```

After that, any admin can promote others via the Users table.

---

## Updated Supabase RLS Policies

```sql
-- NOTE: Prisma generates PascalCase table names and camelCase column names by default.
-- All table and column references must be double-quoted to match.

-- Teachers own their courses
CREATE POLICY "teachers_own_courses" ON "Course"
  FOR ALL USING ("teacherId" = auth.uid()::text OR get_my_role() = 'ADMIN');

-- Students read enrolled courses only
CREATE POLICY "students_read_enrolled_courses" ON "Course"
  FOR SELECT USING (
    get_my_role() = 'ADMIN'
    OR "teacherId" = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM "Enrollment"
      WHERE "Enrollment"."courseId" = "Course"."id"
      AND "Enrollment"."userId" = auth.uid()::text
    )
  );

-- Students write only their own completions
CREATE POLICY "students_own_completions" ON "TaskCompletion"
  FOR ALL USING ("userId" = auth.uid()::text OR get_my_role() = 'ADMIN');

-- Knowledge bases: teacher of the course or admin
CREATE POLICY "knowledge_base_access" ON "KnowledgeBase"
  FOR ALL USING (
    get_my_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM "Course" WHERE "Course"."id" = "KnowledgeBase"."courseId"
      AND "Course"."teacherId" = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM "Enrollment"
      WHERE "Enrollment"."courseId" = "KnowledgeBase"."courseId"
      AND "Enrollment"."userId" = auth.uid()::text
    )
  );
```

---

## What Makes This Different from a Generic Todo App



The key is that **completing a task has consequences**: XP is awarded, streaks are maintained, achievements are checked, level is recalculated — all in one server action. The student feels the weight of each completion. The teacher never sees any of this machinery; they see assignments, submissions, grades, and progress percentages.

**The multi-course layer** is what makes this usable at scale. Course colors give students a persistent mental map across all views. The `getDailyTasks` prioritization function means the dashboard is always actionable — not a backlog dump. The `CourseFilterBar` on the Quest Board means a student can context-switch cleanly between courses without losing orientation.

The theme layer means the same product can serve a medieval fantasy student and a cyberpunk student without a single conditional in the business logic. The course color system and theme system are independent axes — a student can be in Space Explorer mode with four differently-colored courses, and both systems work without interfering with each other.

**The assessment layer** is what makes this educationally honest. XP measures effort and engagement — it goes up every time a student does something. `masteryLevel` measures understanding — it reflects what the evidence says. These are shown in separate UI sections and are never conflated. A student can have high XP and a DEVELOPING mastery level, and both pieces of information are useful and true. The teacher's job shifts from corrector to calibrator: they set rubrics, review AI flags, and handle edge cases — rather than grading a stack of submissions from scratch.

**The board** is where the assessment system becomes social. Instead of private bilateral exchange, students post work they're prepared to stand behind, reviewers choose what they engage with, and calibration ensures quality. The teacher gains a live view of what the class finds persuasive, what gaps are appearing across multiple students' work, and which posts deserve to be pinned as exemplars. The brief is always displayed alongside the submission on the board — reviewing without the original question is not reviewing, it is reacting.