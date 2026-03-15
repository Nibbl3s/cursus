import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function RootPage() {
  const session = await auth()

  if (!session) redirect('/login')

  const routes = {
    ADMIN: '/admin/dashboard',
    TEACHER: '/teacher/dashboard',
    STUDENT: '/student/dashboard',
  }

  redirect(routes[session.user.role] ?? '/student/dashboard')
}
