import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PRESET_COLORS } from '@/lib/course-colors';

const courseSchema = z.object({
  name:        z.string().min(1),
  code:        z.string().min(1),
  description: z.string().optional(),
  color:       z.enum(PRESET_COLORS),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const courses = await prisma.course.findMany({
    where: { teacherId: session.user.id },
    include: {
      _count: { select: { enrollments: true, assignments: true } },
      assignments: {
        where: { dueDate: { gte: new Date() } },
        orderBy: { dueDate: 'asc' },
        take: 1,
        select: { title: true, dueDate: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(courses);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const course = await prisma.course.create({
    data: { ...parsed.data, teacherId: session.user.id },
  });

  return NextResponse.json(course, { status: 201 });
}
