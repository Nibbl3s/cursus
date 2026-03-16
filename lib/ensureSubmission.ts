import { prisma } from '@/lib/prisma';
import { Submission } from '@prisma/client';

export async function ensureSubmission(
  userId: string,
  assignmentId: string,
): Promise<Submission> {
  return prisma.submission.upsert({
    where: { assignmentId_userId: { assignmentId, userId } },
    create: { userId, assignmentId, status: 'NOT_STARTED', progressPct: 0 },
    update: {},
  });
}
