import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';

const SOURCE_LABELS: Record<string, string> = {
  MANUAL:      'Manual',
  AI_ASSISTED: 'AI assisted',
  IMPORT:      'Imported',
};

const SOURCE_COLORS: Record<string, string> = {
  MANUAL:      'bg-gray-100 text-gray-600',
  AI_ASSISTED: 'bg-purple-100 text-purple-700',
  IMPORT:      'bg-blue-100 text-blue-700',
};

export default async function KnowledgeBasePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireRole('TEACHER');
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      knowledgeBases: { orderBy: { updatedAt: 'desc' } },
    },
  });

  if (!course || course.teacherId !== session.user.id) notFound();

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{course.name}</p>
          <h1 className="text-xl font-semibold text-gray-900">Knowledge base</h1>
        </div>
        <Link
          href={`/teacher/courses/${courseId}/knowledge/new`}
          className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shrink-0"
        >
          + New article
        </Link>
      </div>

      {/* List */}
      {course.knowledgeBases.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">
          <p>No knowledge base articles yet.</p>
          <p className="mt-1 text-xs">Create one to give students reference material.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {course.knowledgeBases.map((kb) => (
            <div
              key={kb.id}
              className="flex items-center justify-between gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg"
            >
              <div className="min-w-0 flex items-center gap-3">
                <span
                  className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${SOURCE_COLORS[kb.sourceType] ?? SOURCE_COLORS.MANUAL}`}
                >
                  {SOURCE_LABELS[kb.sourceType] ?? kb.sourceType}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{kb.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Updated {formatDistanceToNow(kb.updatedAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
              <Link
                href={`/teacher/courses/${courseId}/knowledge/${kb.id}/edit`}
                className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Edit →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
