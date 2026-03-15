import { requireRole } from '@/lib/auth/requireRole'

export default async function AdminDashboard() {
  await requireRole('ADMIN')
  return <main className="p-8"><h1 className="text-2xl font-semibold">Admin Dashboard</h1></main>
}
