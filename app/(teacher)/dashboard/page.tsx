import { requireRole } from '@/lib/auth/requireRole'

export default async function TeacherDashboard() {
  await requireRole('TEACHER')
  return <main className="p-8"><h1 className="text-2xl font-semibold">Teacher Dashboard</h1></main>
}
