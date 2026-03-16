'use client';

import { useState } from 'react';

const ROLES = ['STUDENT', 'TEACHER', 'ADMIN'] as const;
type Role = (typeof ROLES)[number];

export function RoleSelector({
  userId,
  initialRole,
}: {
  userId: string;
  initialRole: Role;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const [saving, setSaving] = useState(false);

  async function handleChange(newRole: Role) {
    if (newRole === role || saving) return;
    setSaving(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) setRole(newRole);
    setSaving(false);
  }

  return (
    <select
      value={role}
      onChange={(e) => handleChange(e.target.value as Role)}
      disabled={saving}
      className="text-xs rounded border border-gray-200 bg-white px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r.charAt(0) + r.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  );
}
