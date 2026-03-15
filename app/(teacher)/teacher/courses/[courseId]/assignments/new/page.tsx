import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { AssignmentCreationHub } from '@/components/teacher/AssignmentCreationHub';

export default async function NewAssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireRole('TEACHER');
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, teacherId: true },
  });

  if (!course || course.teacherId !== session.user.id) notFound();

  return (
    <div className="p-8">
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-0.5">{course.name}</p>
        <h1 className="text-xl font-semibold text-gray-900">New assignment</h1>
      </div>
      <AssignmentCreationHub courseId={courseId} />
    </div>
  );
}
