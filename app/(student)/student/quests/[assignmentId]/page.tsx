import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { ensureSubmission } from '@/lib/ensureSubmission';
import { AssignmentBrief } from '@/components/student/AssignmentBrief';
import { TaskRow } from '@/components/student/TaskRow';
import { PostToBoardButton } from '@/components/student/board/PostToBoardButton';
import { CourseColorDot } from '@/components/shared/CourseColorDot';
import { SubmitWorkPanel } from './_components/SubmitWorkPanel';
import { FeedbackPanel } from './_components/FeedbackPanel';

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

  // Ensure a Submission row exists before reading or referencing it
  const submission = await ensureSubmission(userId, assignmentId);

  // Fetch AI feedback if the submission has been released
  const aiFeedback =
    submission.status === 'RELEASED'
      ? await prisma.aIFeedback.findUnique({ where: { submissionId: submission.id } })
      : null;

  // Fetch completed task IDs for unlock state calculation
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

  const allTasksDone =
    assignment.tasks.length > 0 && assignment.tasks.every((t) => completedTaskIds.has(t.id));
  const isPeerReview = assignment.assessmentMode === 'PEER_REVIEW';
  const isReleased = submission.status === 'RELEASED';
  const hasSubmitted =
    submission.status === 'SUBMITTED' ||
    submission.status === 'UNDER_REVIEW' ||
    submission.status === 'AI_GRADED' ||
    submission.status === 'TEACHER_REVIEWED' ||
    isReleased;

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

      {/* Overall progress */}
      <div className="mb-8 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/50 font-semibold uppercase tracking-wide">
            Progress
          </span>
          <span className="text-sm font-bold text-white">
            {Math.round(submission.progressPct)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${submission.progressPct}%`,
              backgroundColor:
                submission.progressPct >= 100 ? '#10b981' : assignment.course.color,
            }}
          />
        </div>
      </div>

      {/* Assignment brief */}
      {assignment.brief ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">
            Brief
          </h2>
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <AssignmentBrief brief={assignment.brief} />
          </div>
        </section>
      ) : null}

      {/* Task chain */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
          Tasks
        </h2>
        {assignment.tasks.length === 0 ? (
          <p className="text-sm text-white/40">No tasks for this assignment.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {assignment.tasks.map((task) => {
              const isUnlocked =
                task.unlocksAfter === null || completedTaskIds.has(task.unlocksAfter);
              return (
                <TaskRow
                  key={task.id}
                  taskId={task.id}
                  taskTitle={task.title}
                  taskType={task.taskType}
                  estimatedMins={task.estimatedMins}
                  pointValue={task.pointValue}
                  courseCode={assignment.course.code}
                  courseColor={assignment.course.color}
                  isUnlocked={isUnlocked}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Work submission — always visible; locked until all tasks are done */}
      <SubmitWorkPanel
        assignmentId={assignmentId}
        initialContent={submission.content ?? null}
        alreadySubmitted={hasSubmitted}
        isLocked={!allTasksDone}
        tasksTotal={assignment.tasks.length}
        tasksDone={completedTaskIds.size}
      />

      {/* Feedback panel — shown when submission is released */}
      {isReleased && aiFeedback && (
        <FeedbackPanel
          masteryLevel={submission.masteryLevel as 'BEGINNING' | 'DEVELOPING' | 'PROFICIENT' | 'ADVANCED' | null}
          quickWins={aiFeedback.quickWins}
          strengths={aiFeedback.strengths}
          feedbackMarkdown={aiFeedback.feedbackMarkdown}
          finalScore={submission.finalScore}
        />
      )}

      {/* Post to Board — only for PEER_REVIEW assignments that have been submitted */}
      {isPeerReview && hasSubmitted && (
        <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
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
