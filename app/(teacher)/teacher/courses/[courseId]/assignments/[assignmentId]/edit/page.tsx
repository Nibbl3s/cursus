import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/prisma';
import { AssignmentForm } from '@/components/teacher/AssignmentForm';

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const session = await requireRole('TEACHER');
  const { courseId, assignmentId } = await params;

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: { select: { name: true, teacherId: true } },
      rubric: { include: { criteria: { orderBy: { order: 'asc' } } } },
      tasks:  { orderBy: { order: 'asc' } },
    },
  });

  if (!assignment || assignment.courseId !== courseId || assignment.course.teacherId !== session.user.id) {
    notFound();
  }

  // Convert DateTime → datetime-local string (trim seconds+Z)
  const dueDateLocal = assignment.dueDate.toISOString().slice(0, 16);

  // Convert DB tasks: unlocksAfter (task ID) → unlocksAfterIndex (array index)
  const taskIdToIndex = new Map(assignment.tasks.map((t, i) => [t.id, i]));
  const defaultTasks = assignment.tasks.map((t) => ({
    title:             t.title,
    taskType:          t.taskType,
    estimatedMins:     t.estimatedMins,
    pointValue:        t.pointValue,
    unlocksAfterIndex: t.unlocksAfter ? (taskIdToIndex.get(t.unlocksAfter) ?? null) : null,
    prompt:            t.prompt            ?? '',
    isOptional:        t.isOptional        ?? false,
    learningObjective: t.learningObjective ?? '',
    guidedQuestions:   Array.isArray(t.guidedQuestions) ? (t.guidedQuestions as { question: string; hint: string }[]) : [],
    starterFileUrl:    t.starterFileUrl    ?? '',
  }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-0.5">{assignment.course.name}</p>
        <h1 className="text-xl font-semibold text-gray-900">Edit assignment</h1>
      </div>
      <AssignmentForm
        courseId={courseId}
        assignmentId={assignmentId}
        defaultCriteria={assignment.rubric?.criteria.map(({ label, description, maxScore }) => ({ label, description, maxScore })) ?? []}
        defaultTasks={defaultTasks}
        defaultValues={{
          title:          assignment.title,
          brief:          assignment.brief          ?? '',
          dueDate:        dueDateLocal,
          weight:         assignment.weight,
          difficulty:     assignment.difficulty,
          pointValue:     assignment.pointValue,
          assessmentMode: assignment.assessmentMode,
        }}
      />
    </div>
  );
}
