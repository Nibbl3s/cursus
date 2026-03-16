import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  jobType: z.enum(['ASSIGNMENT_GENERATION', 'KNOWLEDGE_BASE_GENERATION']),
  messages: z.array(z.any()),
});

const updateSchema = z.object({
  jobId:     z.string().min(1),
  messages:  z.array(z.any()).optional(),
  outputData: z.any().optional(),
  status:    z.enum(['IN_PROGRESS', 'COMPLETE', 'FAILED']).optional(),
});

/** POST — create a new AIGenerationJob */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const job = await prisma.aIGenerationJob.create({
    data: {
      userId:    session.user.id,
      jobType:   parsed.data.jobType,
      status:    'IN_PROGRESS',
      inputData: { messages: parsed.data.messages },
    },
  });

  return NextResponse.json(job, { status: 201 });
}

/** PATCH — update messages, outputData, or status on an existing job */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { jobId, messages, outputData, status } = parsed.data;

  const existing = await prisma.aIGenerationJob.findUnique({ where: { id: jobId } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await prisma.aIGenerationJob.update({
    where: { id: jobId },
    data: {
      ...(messages   !== undefined && { inputData:  { messages } }),
      ...(outputData !== undefined && { outputData }),
      ...(status     !== undefined && { status }),
    },
  });

  return NextResponse.json(updated);
}
