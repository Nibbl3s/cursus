import { requireRole } from '@/lib/auth/requireRole'

export default async function StudentDashboard() {
  await requireRole('STUDENT')
  return <main className="p-8"><h1 className="text-2xl font-semibold">Student Dashboard</h1></main>
}
