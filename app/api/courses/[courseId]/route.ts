import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PRESET_COLORS } from '@/lib/course-colors';

const patchSchema = z.object({
  name:        z.string().min(1).optional(),
  code:        z.string().min(1).optional(),
  description: z.string().optional(),
  color:       z.enum(PRESET_COLORS).optional(),
});

async function ownsOrForbid(courseId: string, userId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { course: null, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (course.teacherId !== userId) return { course: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { course, error: null };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId } = await params;
  const { course, error } = await ownsOrForbid(courseId, session.user.id);
  if (error) return error;

  return NextResponse.json(course);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId } = await params;
  const { error } = await ownsOrForbid(courseId, session.user.id);
  if (error) return error;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}
