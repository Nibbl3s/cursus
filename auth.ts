import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import prisma from '@/lib/prisma'
import { $Enums } from '@prisma/client'
type Role = $Enums.Role

const ROLE_REDIRECTS: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.role = (user as { role: Role }).role
      return session
    },
    async redirect({ url, baseUrl }) {
      // After magic-link verification, redirect based on the user's role.
      // We look up the role directly from the DB using the active session.
      try {
        const session = await auth()
        const role = (session?.user as { role?: Role } | null)?.role
        if (role && role in ROLE_REDIRECTS) {
          return `${baseUrl}${ROLE_REDIRECTS[role]}`
        }
      } catch (_) {}
      if (url.startsWith(baseUrl)) return url
      return `${baseUrl}/student/dashboard`
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return
      const exists = await prisma.profile.findUnique({
        where: { userId: user.id },
      })
      if (!exists) {
        await prisma.profile.create({
          data: {
            userId: user.id,
            displayName: user.email?.split('@')[0] ?? 'User',
            themeId: 'medieval',
            totalPoints: 0,
            level: 1,
            currentStreak: 0,
            bestStreak: 0,
          },
        })
      }
    },
  },
})
