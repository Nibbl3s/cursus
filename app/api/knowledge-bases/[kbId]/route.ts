import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({
  title:      z.string().min(1).optional(),
  content:    z.string().min(1).optional(),
  sourceType: z.enum(['MANUAL', 'AI_ASSISTED', 'IMPORT']).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ kbId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kbId } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    include: { course: { select: { teacherId: true } } },
  });
  if (!kb || kb.course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await prisma.knowledgeBase.update({
    where: { id: kbId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ kbId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kbId } = await params;

  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    include: { course: { select: { teacherId: true } } },
  });
  if (!kb || kb.course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.knowledgeBase.delete({ where: { id: kbId } });

  return new NextResponse(null, { status: 204 });
}
