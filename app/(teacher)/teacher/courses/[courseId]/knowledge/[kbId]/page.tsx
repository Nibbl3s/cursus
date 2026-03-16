import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import ReactMarkdown from 'react-markdown';
import { DeleteKBButton } from './_components/DeleteKBButton';

export default async function KnowledgeBasePreviewPage({
  params,
}: {
  params: Promise<{ courseId: string; kbId: string }>;
}) {
  const session = await requireRole('TEACHER');
  const { courseId, kbId } = await params;

  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    include: { course: { select: { name: true, teacherId: true } } },
  });

  if (!kb || kb.courseId !== courseId || kb.course.teacherId !== session.user.id) {
    notFound();
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">
            <Link href={`/teacher/courses/${courseId}/knowledge`} className="hover:text-gray-600 transition-colors">
              {kb.course.name} / Knowledge base
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-gray-900">{kb.title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/teacher/courses/${courseId}/knowledge/${kbId}/edit`}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          <DeleteKBButton kbId={kbId} courseId={courseId} />
        </div>
      </div>

      {/* Student preview */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Student preview</p>
        </div>
        <article className="px-8 py-10 lg:px-16 xl:px-24">
          <div className="prose prose-gray lg:prose-lg max-w-none
            prose-headings:font-bold prose-headings:text-gray-900
            prose-h1:text-3xl prose-h1:mb-6 prose-h1:pb-4 prose-h1:border-b prose-h1:border-gray-200
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-4
            prose-li:text-gray-700 prose-li:my-1
            prose-strong:text-gray-900
            prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-l-4 prose-blockquote:border-indigo-300 prose-blockquote:bg-indigo-50 prose-blockquote:rounded-r-lg prose-blockquote:px-6 prose-blockquote:py-1 prose-blockquote:not-italic prose-blockquote:text-gray-700
            prose-code:text-indigo-700 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal
            prose-pre:bg-gray-900 prose-pre:rounded-xl
            prose-hr:border-gray-200 prose-hr:my-8
            prose-img:rounded-xl prose-img:shadow-md">
            <ReactMarkdown>{kb.content}</ReactMarkdown>
          </div>
        </article>
      </div>
    </div>
  );
}
