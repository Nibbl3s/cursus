import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  email: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, teacherId: true },
  });

  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 422 });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'No Cursus account found for this email address.' },
      { status: 404 },
    );
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });

  if (existing) {
    return NextResponse.json({ error: 'This student is already enrolled.' }, { status: 409 });
  }

  await prisma.enrollment.create({
    data: { userId: user.id, courseId },
  });

  return NextResponse.json({ ok: true });
}
