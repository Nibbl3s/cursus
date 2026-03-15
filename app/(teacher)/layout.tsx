import Link from 'next/link';
import { requireRole } from '@/lib/auth/requireRole';

const navLinks = [
  { href: '/teacher/dashboard', label: 'Dashboard' },
  { href: '/teacher/courses',   label: 'Courses'   },
  { href: '/teacher/settings',  label: 'Settings'  },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole('TEACHER');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-900 tracking-tight">Cursus</span>
          <span className="ml-2 text-xs text-gray-400 font-medium">Teacher</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
