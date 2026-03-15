import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export default async function EnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  // No course code → go home
  if (!code) redirect('/');

  // Require an active session
  const session = await auth();
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/enroll?code=${code}`)}`);
  }

  const course = await prisma.course.findUnique({
    where: { id: code },
    select: { id: true },
  });

  // Unknown course → go home
  if (!course) redirect('/');

  const userId = session.user.id;

  // Create enrollment (skip if already enrolled)
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: code } },
  });

  if (!existing) {
    await prisma.enrollment.create({
      data: { userId, courseId: code },
    });
  }

  redirect('/student/dashboard');
}
