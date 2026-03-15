import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import prisma from '@/lib/prisma'

type Role = 'ADMIN' | 'TEACHER' | 'STUDENT'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  pages: {
    verifyRequest: '/verify',
  },
  callbacks: {
    async session({ session, user }) {
      session.user.role = (user as { role: Role }).role
      return session
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
