import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { BriefPreview } from '@/components/teacher/BriefPreview';

type TaskType =
  | 'STUDY' | 'RESEARCH' | 'WRITING' | 'REVIEW'
  | 'QUIZ'  | 'PRACTICE' | 'REFLECTION' | 'PEER_REVIEW' | 'SOCRATIC';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'BOSS';
type AssessmentMode = 'SELF_ASSESSED' | 'PEER_REVIEW' | 'SOCRATIC' | 'TEACHER_GRADED' | 'HYBRID';
type SubmissionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'UNDER_REVIEW' | 'AI_GRADED' | 'TEACHER_REVIEWED' | 'RELEASED';

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  STUDY:       'Study',
  RESEARCH:    'Research',
  WRITING:     'Writing',
  REVIEW:      'Review',
  QUIZ:        'Quiz',
  PRACTICE:    'Practice',
  REFLECTION:  'Reflection',
  PEER_REVIEW: 'Peer review',
  SOCRATIC:    'Socratic',
};

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  EASY:   'bg-green-50 text-green-700',
  MEDIUM: 'bg-blue-50 text-blue-700',
  HARD:   'bg-orange-50 text-orange-700',
  BOSS:   'bg-red-50 text-red-700',
};

const MODE_LABELS: Record<AssessmentMode, string> = {
  SELF_ASSESSED:  'Self-assessed',
  PEER_REVIEW:    'Peer review',
  SOCRATIC:       'Socratic',
  TEACHER_GRADED: 'Teacher graded',
  HYBRID:         'Hybrid',
};

const SUBMITTED_STATUSES = new Set<SubmissionStatus>([
  'SUBMITTED', 'UNDER_REVIEW', 'AI_GRADED', 'TEACHER_REVIEWED', 'RELEASED',
]);

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const session = await requireRole('TEACHER');
  const { courseId, assignmentId } = await params;

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: {
        select: {
          id:        true,
          name:      true,
          code:      true,
          color:     true,
          teacherId: true,
          _count:    { select: { enrollments: true } },
        },
      },
      tasks: { orderBy: { order: 'asc' } },
      rubric: {
        include: {
          criteria: { orderBy: { order: 'asc' } },
        },
      },
      submissions: {
        select: { status: true },
      },
    },
  });

  if (
    !assignment ||
    assignment.course.teacherId !== session.user.id ||
    assignment.courseId !== courseId
  ) {
    notFound();
  }

  const totalEnrolled = assignment.course._count.enrollments;
  const started       = assignment.submissions.length;
  const submitted     = assignment.submissions.filter((s) =>
    SUBMITTED_STATUSES.has(s.status as SubmissionStatus),
  ).length;

  const totalTaskMins = assignment.tasks.reduce((sum, t) => sum + t.estimatedMins, 0);

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/teacher/courses" className="hover:text-gray-600 transition-colors">
          Courses
        </Link>
        <span>/</span>
        <Link
          href={`/teacher/courses/${courseId}`}
          className="flex items-center gap-1.5 hover:text-gray-600 transition-colors"
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: assignment.course.color }}
          />
          {assignment.course.name}
        </Link>
        <span>/</span>
        <span className="text-gray-600 truncate max-w-48">{assignment.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{assignment.title}</h1>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{assignment.course.code}</p>
        </div>
        <Link
          href={`/teacher/courses/${courseId}/assignments/${assignmentId}/edit`}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Edit assignment
        </Link>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-gray-500">
          Due{' '}
          <span className="font-medium text-gray-700">
            {format(assignment.dueDate, 'MMM d, yyyy')}
          </span>
          {' '}
          <span className="text-gray-400">
            ({formatDistanceToNow(assignment.dueDate, { addSuffix: true })})
          </span>
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-500">
          Weight{' '}
          <span className="font-medium text-gray-700">{assignment.weight}%</span>
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-500">
          Points{' '}
          <span className="font-medium text-gray-700">{assignment.pointValue}</span>
        </span>
        <span className="text-gray-300">·</span>
        <span
          className={`px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_STYLES[assignment.difficulty as Difficulty]}`}
        >
          {assignment.difficulty.charAt(0) + assignment.difficulty.slice(1).toLowerCase()}
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-500">
          {MODE_LABELS[assignment.assessmentMode as AssessmentMode]}
        </span>
      </div>

      {/* Submission overview */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: 'Enrolled',  value: totalEnrolled },
          { label: 'Started',   value: started },
          { label: 'Submitted', value: submitted },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center gap-1 py-4 bg-white border border-gray-200 rounded-lg"
          >
            <span className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</span>
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </section>

      {/* Brief */}
      {assignment.brief ? (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Brief</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <BriefPreview source={assignment.brief} />
          </div>
        </section>
      ) : (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Brief</h2>
          <p className="text-sm text-gray-400">No brief provided.</p>
        </section>
      )}

      {/* Tasks */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Tasks{' '}
            <span className="font-normal text-gray-400">({assignment.tasks.length})</span>
          </h2>
          {totalTaskMins > 0 && (
            <span className="text-xs text-gray-400">
              ~{totalTaskMins} min total
            </span>
          )}
        </div>

        {assignment.tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks defined.</p>
        ) : (
          <ol className="space-y-2">
            {assignment.tasks.map((task, i) => {
              const unlockerTitle = task.unlocksAfter
                ? assignment.tasks.find((t) => t.id === task.unlocksAfter)?.title
                : null;

              return (
                <li
                  key={task.id}
                  className="flex items-start gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg"
                >
                  <span className="mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500 shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                        {TASK_TYPE_LABELS[task.taskType as TaskType] ?? task.taskType}
                      </span>
                      <span>~{task.estimatedMins} min</span>
                      <span>{task.pointValue} pts</span>
                      {unlockerTitle && (
                        <span className="text-amber-600">
                          unlocks after &ldquo;{unlockerTitle}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Rubric */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Rubric{' '}
          {assignment.rubric && (
            <span className="font-normal text-gray-400">
              ({assignment.rubric.criteria.length} criteria ·{' '}
              {assignment.rubric.criteria.reduce((s, c) => s + c.maxScore, 0)} pts max)
            </span>
          )}
        </h2>

        {!assignment.rubric || assignment.rubric.criteria.length === 0 ? (
          <p className="text-sm text-gray-400">No rubric defined.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Criterion</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 w-20">Max pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {assignment.rubric.criteria.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-gray-900 align-top whitespace-nowrap">
                      {c.label}
                    </td>
                    <td className="px-4 py-3 text-gray-500 align-top">{c.description}</td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium align-top tabular-nums">
                      {c.maxScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
