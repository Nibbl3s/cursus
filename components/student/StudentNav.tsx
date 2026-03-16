'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/student/ThemeProvider';

export function StudentNav() {
  const theme = useTheme();
  const pathname = usePathname();

  const navLinks = [
    { href: '/student/dashboard', label: theme.vocabulary.dashboardGreeting },
    { href: '/student/quests',    label: theme.vocabulary.questBoard },
    { href: '/student/bosses',    label: theme.vocabulary.deadlines },
  ];

  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-white/10 bg-black/20">
      <div className="h-14 flex items-center px-5 border-b border-white/10">
        <span className="text-sm font-bold text-white tracking-tight">Cursus</span>
        <span className="ml-2 text-xs font-medium" style={{ color: theme.palette.accent }}>
          {theme.name}
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navLinks.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'text-white font-semibold'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
              style={isActive ? { backgroundColor: theme.palette.primary + '33' } : {}}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
