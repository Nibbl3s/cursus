import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { CourseCard } from '@/components/teacher/CourseCard';

export default async function TeacherDashboard() {
  const session = await requireRole('TEACHER');

  const courses = await prisma.course.findMany({
    where: { teacherId: session.user.id },
    include: {
      _count: {
        select: { enrollments: true, assignments: true },
      },
      assignments: {
        where: { dueDate: { gte: new Date() } },
        orderBy: { dueDate: 'asc' },
        take: 1,
        select: { title: true, dueDate: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {courses.length} {courses.length === 1 ? 'course' : 'courses'}
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-gray-400">
          No courses yet.{' '}
          <a href="/teacher/courses" className="text-indigo-600 hover:underline">
            Create your first course.
          </a>
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              id={course.id}
              name={course.name}
              code={course.code}
              color={course.color}
              enrollmentCount={course._count.enrollments}
              activeAssignmentCount={course._count.assignments}
              nextDeadline={course.assignments[0] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
