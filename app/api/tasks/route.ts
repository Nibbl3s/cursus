import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const taskDraftSchema = z.object({
  title:             z.string().min(1),
  taskType:          z.enum([
    'STUDY', 'RESEARCH', 'WRITING', 'REVIEW', 'QUIZ',
    'PRACTICE', 'REFLECTION', 'PEER_REVIEW', 'SOCRATIC',
    'GUIDED_QUESTIONS', 'FILE_UPLOAD', 'PEER_BOARD',
  ]),
  estimatedMins:     z.number().min(1),
  pointValue:        z.number().min(1),
  unlocksAfterIndex: z.number().nullable(),
  prompt:            z.string().optional(),
  isOptional:        z.boolean().optional(),
  learningObjective: z.string().optional(),
  guidedQuestions:   z.array(z.object({ question: z.string(), hint: z.string() })).optional(),
  starterFileUrl:    z.string().optional(),
});

const bodySchema = z.object({
  assignmentId: z.string().min(1),
  tasks:        z.array(taskDraftSchema),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { assignmentId, tasks } = parsed.data;

  // Verify teacher owns the parent course
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { id: true, teacherId: true } } },
  });
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (assignment.course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Replace existing tasks — delete completions first (no cascade in schema)
  await prisma.taskCompletion.deleteMany({ where: { task: { assignmentId } } });
  await prisma.task.deleteMany({ where: { assignmentId } });

  // Create tasks without unlocksAfter first to get real IDs
  const created = await prisma.$transaction(
    tasks.map((t, order) =>
      prisma.task.create({
        data: {
          title:             t.title,
          taskType:          t.taskType,
          estimatedMins:     t.estimatedMins,
          pointValue:        t.pointValue,
          order,
          assignmentId,
          courseId:          assignment.course.id,
          prompt:            t.prompt            || null,
          isOptional:        t.isOptional        ?? false,
          learningObjective: t.learningObjective || null,
          guidedQuestions:   t.guidedQuestions   ?? [],
          starterFileUrl:    t.starterFileUrl    || null,
          resourceLinks:     [],
        },
      }),
    ),
  );

  // Resolve unlocksAfterIndex → real task IDs and patch
  const updates = tasks
    .map((t, i) => ({ i, ref: t.unlocksAfterIndex }))
    .filter(({ ref }) => ref !== null) as { i: number; ref: number }[];

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map(({ i, ref }) =>
        prisma.task.update({
          where: { id: created[i].id },
          data:  { unlocksAfter: created[ref].id },
        }),
      ),
    );
  }

  return NextResponse.json(created, { status: 201 });
}
