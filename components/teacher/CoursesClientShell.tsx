'use client';

import { useState } from 'react';
import { NewCourseForm } from './NewCourseForm';

export function CoursesClientShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Courses</h1>
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          + New Course
        </button>
      </div>

      {children}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">New course</h2>
            <NewCourseForm onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
