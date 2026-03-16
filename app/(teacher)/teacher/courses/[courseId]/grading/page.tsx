import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { GradingTable, type GradingRow } from './_components/GradingTable';

export default async function GradingPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireRole('TEACHER');
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, code: true, color: true, teacherId: true },
  });
  if (!course || course.teacherId !== session.user.id) notFound();

  const submissions = await prisma.submission.findMany({
    where: {
      status: { in: ['AI_GRADED', 'TEACHER_REVIEWED', 'RELEASED'] },
      assignment: { courseId },
    },
    include: {
      user: { select: { name: true, email: true } },
      assignment: { select: { id: true, title: true } },
      aiFeedback: {
        select: { overallScore: true, confidenceLevel: true, generatedAt: true },
      },
    },
  });

  // Sort low-confidence first (null treated as 0), then by submittedAt desc
  submissions.sort((a, b) => {
    const ca = a.aiFeedback?.confidenceLevel ?? 0;
    const cb = b.aiFeedback?.confidenceLevel ?? 0;
    if (ca !== cb) return ca - cb;
    return (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0);
  });

  const rows: GradingRow[] = submissions.map((s) => ({
    submissionId: s.id,
    studentName: s.user.name ?? s.user.email.split('@')[0],
    assignmentTitle: s.assignment.title,
    assignmentId: s.assignment.id,
    aiScore: s.aiFeedback?.overallScore ?? null,
    confidenceLevel: s.aiFeedback?.confidenceLevel ?? null,
    aiFeedbackCreatedAt: s.aiFeedback?.generatedAt?.toISOString() ?? null,
    submittedAt: s.submittedAt?.toISOString() ?? null,
    status: s.status,
  }));

  return (
    <div className="p-8 space-y-8 max-w-5xl">
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
            style={{ backgroundColor: course.color }}
          />
          {course.name}
        </Link>
        <span>/</span>
        <span className="text-gray-600">Grading</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Grading</h1>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{course.code}</p>
        </div>
        <Link
          href={`/teacher/courses/${courseId}`}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Course
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No graded submissions yet.</p>
      ) : (
        <GradingTable rows={rows} courseId={courseId} />
      )}
    </div>
  );
}
