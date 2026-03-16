import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { SubmissionReview, type CriterionScore } from './_components/SubmissionReview';

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; submissionId: string }>;
}) {
  const session = await requireRole('TEACHER');
  const { courseId, submissionId } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          brief: true,
          courseId: true,
          course: { select: { id: true, name: true, code: true, color: true, teacherId: true } },
          rubric: { include: { criteria: { orderBy: { order: 'asc' } } } },
        },
      },
      aiFeedback: true,
    },
  });

  if (
    !submission ||
    submission.assignment.courseId !== courseId ||
    submission.assignment.course.teacherId !== session.user.id
  ) {
    notFound();
  }

  if (!submission.content) notFound();

  const user = await prisma.user.findUnique({
    where: { id: submission.userId },
    select: { name: true, email: true },
  });

  const { aiFeedback, assignment } = submission;
  const studentName = user ? (user.name ?? user.email.split('@')[0]) : submission.userId;
  const criteria = assignment.rubric?.criteria ?? [];

  // Map criterion scores JSON to typed array with labels
  const rawScores = (aiFeedback?.criterionScores ?? {}) as Record<string, number>;
  const criterionScores: CriterionScore[] = criteria.map((c) => ({
    id: c.id,
    label: c.label,
    maxScore: c.maxScore,
    score: rawScores[c.id] ?? null,
  }));

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
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
        <Link
          href={`/teacher/courses/${courseId}/grading`}
          className="hover:text-gray-600 transition-colors"
        >
          Grading
        </Link>
        <span>/</span>
        <span className="text-gray-600 truncate max-w-40">{studentName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{assignment.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {studentName}
            {submission.submittedAt && (
              <span className="text-gray-400">
                {' '}· submitted {format(submission.submittedAt, 'MMM d, yyyy HH:mm')}
              </span>
            )}
          </p>
        </div>
        <Link
          href={`/teacher/courses/${courseId}/grading`}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Grading
        </Link>
      </div>

      {!aiFeedback ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No AI feedback available for this submission yet.
        </div>
      ) : (
        <SubmissionReview
          submissionId={submissionId}
          courseId={courseId}
          studentName={studentName}
          assignmentBrief={assignment.brief ?? null}
          submittedContent={submission.content}
          aiFeedbackMarkdown={aiFeedback.feedbackMarkdown}
          aiOverallScore={aiFeedback.overallScore}
          quickWins={aiFeedback.quickWins}
          strengths={aiFeedback.strengths}
          confidenceLevel={aiFeedback.confidenceLevel}
          criterionScores={criterionScores}
          alreadyReleased={submission.status === 'RELEASED'}
        />
      )}
    </div>
  );
}
