import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { CourseFilterBar } from '@/components/student/CourseFilterBar';
import { AssignmentCard } from '@/components/student/AssignmentCard';

interface Props {
  searchParams: Promise<{ course?: string }>;
}

export default async function QuestBoardPage({ searchParams }: Props) {
  const session = await requireRole('STUDENT');
  const userId = session.user.id;
  const { course: selectedCourseId = null } = await searchParams;

  // Fetch enrolled courses (for the filter bar)
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: {
      course: { select: { id: true, code: true, color: true } },
    },
    orderBy: { enrolledAt: 'asc' },
  });
  const courses = enrollments.map((e) => e.course);
  const courseIds = courses.map((c) => c.id);

  // Fetch all assignments across enrolled courses, optionally filtered by course
  const assignments = await prisma.assignment.findMany({
    where: {
      courseId: selectedCourseId
        ? { equals: selectedCourseId }
        : { in: courseIds },
    },
    select: {
      id: true,
      title: true,
      difficulty: true,
      dueDate: true,
      pointValue: true,
      courseId: true,
      course: { select: { code: true, color: true } },
      submissions: {
        where: { userId },
        select: { progressPct: true },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Quest Board</h1>

      <CourseFilterBar
        courses={courses}
        selectedCourseId={selectedCourseId}
        baseHref="/student/quests"
      />

      <div className="mt-6 flex flex-col gap-3">
        {assignments.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-12">
            No quests found. Enroll in a course to get started.
          </p>
        ) : (
          assignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignmentId={a.id}
              title={a.title}
              difficulty={a.difficulty}
              dueDate={a.dueDate}
              pointValue={a.pointValue}
              progressPct={a.submissions[0]?.progressPct ?? 0}
              courseColor={a.course.color}
              courseCode={a.course.code}
            />
          ))
        )}
      </div>
    </main>
  );
}
