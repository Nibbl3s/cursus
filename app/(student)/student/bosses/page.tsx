import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { BossesView } from './_components/BossesView';

export default async function BossesPage() {
  const session = await requireRole('STUDENT');
  const userId = session.user.id;

  const assignments = await prisma.assignment.findMany({
    where: {
      dueDate: { gt: new Date() },
      course: { enrollments: { some: { userId } } },
    },
    select: {
      id: true,
      title: true,
      difficulty: true,
      dueDate: true,
      courseId: true,
      course: { select: { name: true, code: true, color: true } },
      submissions: {
        where: { userId },
        select: { progressPct: true },
      },
    },
    orderBy: [{ courseId: 'asc' }, { dueDate: 'asc' }],
  });

  // Group by course, preserving per-course dueDate-ascending order
  const courseMap = new Map<
    string,
    { courseName: string; courseCode: string; courseColor: string; assignments: typeof assignments }
  >();

  for (const a of assignments) {
    if (!courseMap.has(a.courseId)) {
      courseMap.set(a.courseId, {
        courseName: a.course.name,
        courseCode: a.course.code,
        courseColor: a.course.color,
        assignments: [],
      });
    }
    courseMap.get(a.courseId)!.assignments.push(a);
  }

  // Serialise for the client component (Dates → ISO strings)
  const groups = Array.from(courseMap.entries()).map(
    ([courseId, { courseName, courseCode, courseColor, assignments: asgns }]) => ({
      courseId,
      courseName,
      courseCode,
      courseColor,
      assignments: asgns.map((a) => ({
        id: a.id,
        title: a.title,
        difficulty: a.difficulty,
        dueDate: a.dueDate.toISOString(),
        progressPct: a.submissions[0]?.progressPct ?? 0,
      })),
    }),
  );

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Bosses</h1>
      <BossesView groups={groups} />
    </main>
  );
}
