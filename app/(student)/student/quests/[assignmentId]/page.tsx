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

  // Required tasks only for next-task calculation
  const requiredTasks = assignment.tasks.filter((t) => !t.isOptional);
  const nextTask = requiredTasks.find((t) => !completedTaskIds.has(t.id)) ?? null;
  const allDone = requiredTasks.length > 0 && requiredTasks.every((t) => completedTaskIds.has(t.id));

  const hasStartedRequired = requiredTasks.some((t) => completedTaskIds.has(t.id));

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
        hasStartedRequired={hasStartedRequired}
        submissionStatus={submission.status}
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
