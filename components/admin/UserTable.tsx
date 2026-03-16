'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { RoleSelector } from './RoleSelector';

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

export type UserRow = {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  enrollmentCount: number;
  lastActiveAt: string | null;
};

type SortKey = Exclude<keyof UserRow, 'id'>;
type SortDir = 'asc' | 'desc';

export function UserTable({ users }: { users: UserRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('displayName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...users].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function Th({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
        onClick={() => handleSort(col)}
      >
        {label}
        <span className="ml-1 text-gray-300">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100">
          <tr>
            <Th col="displayName" label="Name" />
            <Th col="email" label="Email" />
            <Th col="role" label="Role" />
            <Th col="enrollmentCount" label="Courses" />
            <Th col="lastActiveAt" label="Last Active" />
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{user.displayName}</td>
              <td className="px-4 py-3 text-gray-500">{user.email}</td>
              <td className="px-4 py-3">
                <RoleSelector userId={user.id} initialRole={user.role} />
              </td>
              <td className="px-4 py-3 text-gray-500">{user.enrollmentCount}</td>
              <td className="px-4 py-3 text-xs text-gray-400">
                {user.lastActiveAt
                  ? formatDistanceToNow(new Date(user.lastActiveAt), { addSuffix: true })
                  : 'Never'}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/users/${user.id}`}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400">No users found.</p>
      )}
    </div>
  );
}
