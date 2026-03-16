import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import ReactMarkdown from 'react-markdown';

export default async function StudentArticlePage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const session = await requireRole('STUDENT');
  const userId = session.user.id;
  const { kbId } = await params;

  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          enrollments: { where: { userId }, select: { userId: true } },
        },
      },
    },
  });

  // 404 if not found or student is not enrolled in the course
  if (!kb || kb.course.enrollments.length === 0) notFound();

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/student/library"
        className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-6"
      >
        ← Library
      </Link>

      {/* Course badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: kb.course.color }}
        />
        <span className="text-xs font-semibold" style={{ color: kb.course.color }}>
          {kb.course.code}
        </span>
      </div>

      {/* Article */}
      <article>
        <div className="prose prose-invert lg:prose-lg max-w-none
          prose-headings:font-bold
          prose-h1:text-3xl prose-h1:mb-6 prose-h1:pb-4 prose-h1:border-b prose-h1:border-white/10
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-white/80 prose-p:leading-relaxed
          prose-li:text-white/80
          prose-strong:text-white
          prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
          prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-white/5 prose-blockquote:rounded-r-lg prose-blockquote:px-6 prose-blockquote:py-1 prose-blockquote:not-italic
          prose-code:text-indigo-300 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal
          prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
          prose-hr:border-white/10
          prose-img:rounded-xl">
          <ReactMarkdown>{kb.content}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
