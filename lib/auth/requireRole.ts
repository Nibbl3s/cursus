import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { $Enums } from '@prisma/client'

type Role = $Enums.Role

const hierarchy: Record<Role, number> = {
  STUDENT: 0,
  TEACHER: 1,
  ADMIN: 2,
}

export async function requireRole(minRole: Role) {
  const session = await auth()
  if (!session) redirect('/login')

  const userLevel = hierarchy[session.user.role] ?? 0
  const requiredLevel = hierarchy[minRole]

  if (userLevel < requiredLevel) redirect('/unauthorized')
  return session
}
