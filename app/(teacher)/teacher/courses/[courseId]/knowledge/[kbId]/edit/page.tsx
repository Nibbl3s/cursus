import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { KnowledgeBaseForm } from '@/components/teacher/KnowledgeBaseForm';
import { DeleteKBButton } from './_components/DeleteKBButton';

export default async function EditKnowledgeBasePage({
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
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{kb.course.name}</p>
          <h1 className="text-xl font-semibold text-gray-900">Edit article</h1>
        </div>
        <DeleteKBButton kbId={kbId} courseId={courseId} />
      </div>
      <KnowledgeBaseForm
        courseId={courseId}
        kbId={kbId}
        defaultValues={{ title: kb.title, content: kb.content }}
      />
    </div>
  );
}
