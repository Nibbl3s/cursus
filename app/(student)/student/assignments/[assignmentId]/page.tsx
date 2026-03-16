import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { ensureSubmission } from '@/lib/ensureSubmission';

interface Props {
  params: Promise<{ assignmentId: string }>;
}

export default async function StudentAssignmentPage({ params }: Props) {
  const session = await requireRole('STUDENT');
  const { assignmentId } = await params;

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { tasks: { orderBy: { order: 'asc' } } },
  });
  if (!assignment) notFound();

  const submission = await ensureSubmission(session.user.id, assignmentId);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{assignment.title}</h1>
      <p className="text-sm text-gray-500 mt-1">Status: {submission.status}</p>
    </main>
  );
}
