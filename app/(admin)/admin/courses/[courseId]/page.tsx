import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { SubmissionTable } from '@/components/teacher/SubmissionTable';

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  await requireRole('ADMIN');

  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      teacher: {
        select: {
          email: true,
          profile: { select: { displayName: true } },
        },
      },
      enrollments: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      assignments: {
        orderBy: { dueDate: 'asc' },
        include: {
          submissions: {
            select: { userId: true, status: true, progressPct: true },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const totalStudents = course.enrollments.length;
  const students = course.enrollments.map((e) => e.user);
  const teacherName =
    course.teacher.profile?.displayName ?? course.teacher.email;

  const allSubmissions = course.assignments.flatMap((a) =>
    a.submissions.map((s) => ({
      studentId: s.userId,
      assignmentId: a.id,
      status: s.status,
      progressPct: s.progressPct,
    })),
  );

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: course.color }}
          />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{course.name}</h1>
            <p className="text-sm text-gray-400 font-mono">{course.code}</p>
            <p className="text-xs text-gray-400 mt-0.5">Teacher: {teacherName}</p>
          </div>
        </div>
        <Link
          href="/admin/courses"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Back to Courses
        </Link>
      </div>

      {/* Assignments list */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Assignments{' '}
          <span className="font-normal text-gray-400">({course.assignments.length})</span>
        </h2>

        {course.assignments.length === 0 ? (
          <p className="text-sm text-gray-400">No assignments yet.</p>
        ) : (
          <div className="space-y-2">
            {course.assignments.map((a) => {
              const started = a.submissions.length;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Due {formatDistanceToNow(a.dueDate, { addSuffix: true })}
                      {' · '}
                      <span className="text-gray-600">
                        {started}/{totalStudents} started
                      </span>
                      {' · '}
                      {a.difficulty.charAt(0) + a.difficulty.slice(1).toLowerCase()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Submission progress table */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Student progress{' '}
          <span className="font-normal text-gray-400">({totalStudents} enrolled)</span>
        </h2>
        <SubmissionTable
          students={students}
          assignments={course.assignments.map(({ id, title, dueDate }) => ({
            id,
            title,
            dueDate,
          }))}
          submissions={allSubmissions}
        />
      </section>
    </div>
  );
}
