import Link from 'next/link';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';

export default async function AdminCoursesPage() {
  await requireRole('ADMIN');

  const courses = await prisma.course.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      teacher: {
        select: {
          email: true,
          profile: { select: { displayName: true } },
        },
      },
      _count: { select: { enrollments: true } },
      assignments: {
        where: { dueDate: { gte: new Date() } },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Courses</h1>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Course
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Teacher
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Students
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Active Assignments
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {courses.map((course) => {
              const teacherName =
                course.teacher.profile?.displayName ?? course.teacher.email;
              return (
                <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: course.color }}
                      />
                      <span className="font-medium text-gray-900">{course.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{course.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{teacherName}</td>
                  <td className="px-4 py-3 text-gray-500">{course._count.enrollments}</td>
                  <td className="px-4 py-3 text-gray-500">{course.assignments.length}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {courses.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No courses found.</p>
        )}
      </div>
    </div>
  );
}
