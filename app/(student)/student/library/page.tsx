import Link from 'next/link';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { CourseFilterBar } from '@/components/student/CourseFilterBar';

interface Props {
  searchParams: Promise<{ course?: string }>;
}

export default async function StudentLibraryPage({ searchParams }: Props) {
  const session = await requireRole('STUDENT');
  const userId = session.user.id;
  const { course: selectedCourseId = null } = await searchParams;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { course: { select: { id: true, code: true, color: true } } },
    orderBy: { enrolledAt: 'asc' },
  });
  const courses = enrollments.map((e) => e.course);
  const courseIds = courses.map((c) => c.id);

  const articles = await prisma.knowledgeBase.findMany({
    where: {
      courseId: selectedCourseId ? { equals: selectedCourseId } : { in: courseIds },
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      course: { select: { code: true, color: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Library</h1>

      <CourseFilterBar
        courses={courses}
        selectedCourseId={selectedCourseId}
        baseHref="/student/library"
      />

      <div className="mt-6 flex flex-col gap-3">
        {articles.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-12">
            No articles available yet.
          </p>
        ) : (
          articles.map((article) => (
            <Link
              key={article.id}
              href={`/student/library/${article.id}`}
              className="flex items-center justify-between gap-4 rounded-xl bg-white/5 border border-white/10 px-5 py-4 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="shrink-0 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: article.course.color }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{article.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: article.course.color }}>
                    {article.course.code}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs text-white/30">
                {new Date(article.updatedAt).toLocaleDateString()}
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
