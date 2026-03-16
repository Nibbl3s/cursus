import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const patchSchema = z.object({
  title:          z.string().min(1).optional(),
  brief:          z.string().optional(),
  dueDate:        z.string().optional(),
  weight:         z.number().min(0).max(100).optional(),
  difficulty:     z.enum(['EASY', 'MEDIUM', 'HARD', 'BOSS']).optional(),
  pointValue:     z.number().min(1).optional(),
  assessmentMode: z.enum(['SELF_ASSESSED', 'PEER_REVIEW', 'SOCRATIC', 'TEACHER_GRADED', 'HYBRID']).optional(),
});

async function resolveAssignment(assignmentId: string, userId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { teacherId: true } } },
  });
  if (!assignment) return { assignment: null, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (assignment.course.teacherId !== userId) return { assignment: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { assignment, error: null };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assignmentId } = await params;
  const { assignment, error } = await resolveAssignment(assignmentId, session.user.id);
  if (error) return error;

  return NextResponse.json(assignment);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assignmentId } = await params;
  const { error } = await resolveAssignment(assignmentId, session.user.id);
  if (error) return error;

  // No cascade deletes on assignment relations — clean up in dependency order.
  await prisma.$transaction([
    // Submission children (SocraticDialogue before SelfAssessment)
    prisma.socraticDialogue.deleteMany({
      where: { submission: { assignmentId } },
    }),
    prisma.aIFeedback.deleteMany({
      where: { submission: { assignmentId } },
    }),
    prisma.peerReview.deleteMany({
      where: { submission: { assignmentId } },
    }),
    prisma.selfAssessment.deleteMany({
      where: { submission: { assignmentId } },
    }),
    prisma.submission.deleteMany({ where: { assignmentId } }),
    // Task children
    prisma.taskCompletion.deleteMany({
      where: { task: { assignmentId } },
    }),
    prisma.task.deleteMany({ where: { assignmentId } }),
    // Rubric
    prisma.rubricCriterion.deleteMany({
      where: { rubric: { assignmentId } },
    }),
    prisma.rubric.deleteMany({ where: { assignmentId } }),
    // Other assignment-level records
    prisma.anchorSubmission.deleteMany({ where: { assignmentId } }),
    prisma.peerReviewConfig.deleteMany({ where: { assignmentId } }),
    // Finally the assignment itself
    prisma.assignment.delete({ where: { id: assignmentId } }),
  ]);

  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assignmentId } = await params;
  const { error } = await resolveAssignment(assignmentId, session.user.id);
  if (error) return error;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { dueDate, ...rest } = parsed.data;

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { ...rest, ...(dueDate ? { dueDate: new Date(dueDate) } : {}) },
  });

  return NextResponse.json(updated);
}
