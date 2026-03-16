import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  courseId:   z.string().min(1),
  title:      z.string().min(1),
  content:    z.string().min(1),
  sourceType: z.enum(['MANUAL', 'AI_ASSISTED', 'IMPORT']).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  if (course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { courseId, ...rest } = parsed.data;
  const kb = await prisma.knowledgeBase.create({
    data: { ...rest, courseId },
  });

  return NextResponse.json(kb, { status: 201 });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 });

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const kbs = await prisma.knowledgeBase.findMany({
    where: { courseId },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(kbs);
}
