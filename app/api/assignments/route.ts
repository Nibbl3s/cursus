import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  courseId:       z.string().min(1),
  title:          z.string().min(1),
  brief:          z.string().optional(),
  scenarioText:   z.string().optional(),
  dueDate:        z.string().min(1),
  weight:         z.number().min(0).max(100),
  difficulty:     z.enum(['EASY', 'MEDIUM', 'HARD', 'BOSS']),
  pointValue:     z.number().min(1),
  assessmentMode: z.enum(['SELF_ASSESSED', 'PEER_REVIEW', 'SOCRATIC', 'TEACHER_GRADED', 'HYBRID']),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Verify teacher owns the course
  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  if (course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { courseId, dueDate, ...rest } = parsed.data;

  const assignment = await prisma.assignment.create({
    data: { ...rest, dueDate: new Date(dueDate), courseId },
  });

  return NextResponse.json(assignment, { status: 201 });
}
