import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { CourseCard } from '@/components/teacher/CourseCard';
import { CoursesClientShell } from '@/components/teacher/CoursesClientShell';

export default async function CoursesPage() {
  const session = await requireRole('TEACHER');

  const courses = await prisma.course.findMany({
    where: { teacherId: session.user.id },
    include: {
      _count: { select: { enrollments: true, assignments: true } },
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
      <CoursesClientShell>
        {courses.length === 0 ? (
          <p className="text-sm text-gray-400 mt-4">No courses yet. Create your first one above.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
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
      </CoursesClientShell>
    </div>
  );
}
