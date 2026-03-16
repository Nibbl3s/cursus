import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const rubricSchema = z.object({
  assignmentId: z.string().min(1),
  criteria: z.array(z.object({
    label:       z.string().min(1),
    description: z.string().min(1),
    maxScore:    z.number().min(1),
  })).min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = rubricSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { assignmentId, criteria } = parsed.data;

  // Verify teacher owns the assignment's course
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { teacherId: true } } },
  });
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (assignment.course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Replace existing rubric if present — delete criteria first to satisfy FK constraint
  await prisma.$transaction([
    prisma.rubricCriterion.deleteMany({ where: { rubric: { assignmentId } } }),
    prisma.rubric.deleteMany({ where: { assignmentId } }),
  ]);

  const rubric = await prisma.rubric.create({
    data: {
      assignmentId,
      criteria: {
        create: criteria.map((c, order) => ({ ...c, order })),
      },
    },
    include: { criteria: { orderBy: { order: 'asc' } } },
  });

  return NextResponse.json(rubric, { status: 201 });
}
