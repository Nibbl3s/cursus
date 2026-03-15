import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth, signIn } from '@/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  email: z.string().email('Invalid email address'),
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
    select: { id: true, name: true, teacherId: true },
  });

  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (course.teacherId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors.email?.[0] ?? 'Invalid request' }, { status: 422 });
  }

  const { email } = parsed.data;

  // Find or create the student user
  let user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    // Pre-register the student; NextAuth's Prisma adapter will link the
    // Account record when the student signs in for the first time.
    user = await prisma.user.create({
      data: {
        email,
        role: 'STUDENT',
        profile: {
          create: {
            displayName: email.split('@')[0],
            themeId:     'medieval',
            totalPoints: 0,
            level:       1,
            currentStreak: 0,
            bestStreak:    0,
          },
        },
      },
      select: { id: true },
    });
  }

  // Idempotency: already enrolled
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  if (existing) {
    return NextResponse.json({ error: 'This student is already enrolled.' }, { status: 409 });
  }

  await prisma.enrollment.create({
    data: { userId: user.id, courseId },
  });

  // Trigger NextAuth's Resend provider to send a magic-link sign-in email.
  // signIn() sends the email then calls redirect() — we catch and discard
  // the NEXT_REDIRECT throw so this route can return JSON normally.
  try {
    await signIn('resend', { email, redirectTo: '/student/dashboard' });
  } catch (err) {
    const digest = (err as { digest?: string })?.digest ?? '';
    if (!digest.startsWith('NEXT_REDIRECT')) throw err;
  }

  return NextResponse.json({ ok: true });
}
