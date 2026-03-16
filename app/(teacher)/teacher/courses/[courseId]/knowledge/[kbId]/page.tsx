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
    <div className="p-8 max-w-3xl space-y-6">
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
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-4 py-2 border-b border-gray-100">
          <p className="text-xs text-gray-400">Student preview</p>
        </div>
        <div className="p-6">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{kb.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
