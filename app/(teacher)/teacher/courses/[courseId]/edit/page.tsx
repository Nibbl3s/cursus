import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { EditCourseForm } from '@/components/teacher/EditCourseForm';

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireRole('TEACHER');
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, code: true, description: true, color: true, teacherId: true },
  });

  if (!course || course.teacherId !== session.user.id) notFound();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Edit course</h1>
      <EditCourseForm course={course} />
    </div>
  );
}
