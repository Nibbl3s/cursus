import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { InviteStudentForm } from '@/components/teacher/InviteStudentForm';
import { CopyButton } from '@/components/teacher/CopyButton';

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireRole('TEACHER');
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id:        true,
      name:      true,
      code:      true,
      color:     true,
      teacherId: true,
      enrollments: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { enrolledAt: 'asc' },
      },
    },
  });

  if (!course || course.teacherId !== session.user.id) notFound();

  const enrollmentLink =
    `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/enroll?code=${courseId}`;

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
            style={{ backgroundColor: course.color }}
          />
          {course.name}
        </Link>
        <span>/</span>
        <span className="text-gray-600">Students</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Students</h1>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{course.code}</p>
        </div>
        <Link
          href={`/teacher/courses/${courseId}`}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Course
        </Link>
      </div>

      {/* Invite by email */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Invite by email</h2>
        <p className="text-xs text-gray-400 mb-3">
          The student receives a magic-link sign-in email. New accounts are created automatically.
        </p>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <InviteStudentForm courseId={courseId} />
        </div>
      </section>

      {/* Enrollment link */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Enrollment link</h2>
        <p className="text-xs text-gray-400 mb-3">
          Share with students who already have an account — they self-enroll on click.
        </p>
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
          <code className="flex-1 text-xs text-gray-700 font-mono truncate">
            {enrollmentLink}
          </code>
          <CopyButton text={enrollmentLink} />
        </div>
      </section>

      {/* Enrolled students */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Enrolled{' '}
          <span className="font-normal text-gray-400">({course.enrollments.length})</span>
        </h2>

        {course.enrollments.length === 0 ? (
          <p className="text-sm text-gray-400">No students enrolled yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                    Enrolled
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {course.enrollments.map(({ user, enrolledAt }) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {user.name ?? user.email.split('@')[0]}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {format(enrolledAt, 'MMM d, yyyy')}
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
