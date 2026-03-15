import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  id: string;
  name: string;
  code: string;
  color: string;
  enrollmentCount: number;
  activeAssignmentCount: number;
  nextDeadline: { title: string; dueDate: Date } | null;
}

export function CourseCard({
  id,
  name,
  code,
  color,
  enrollmentCount,
  activeAssignmentCount,
  nextDeadline,
}: Props) {
  return (
    <Link
      href={`/teacher/courses/${id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{code}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        <span>
          <span className="font-medium text-gray-700">{enrollmentCount}</span>{' '}
          {enrollmentCount === 1 ? 'student' : 'students'}
        </span>
        <span>
          <span className="font-medium text-gray-700">{activeAssignmentCount}</span>{' '}
          {activeAssignmentCount === 1 ? 'assignment' : 'assignments'}
        </span>
      </div>

      {nextDeadline ? (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 truncate">
          Next:{' '}
          <span className="text-gray-700 font-medium">{nextDeadline.title}</span>
          {' · '}
          {formatDistanceToNow(nextDeadline.dueDate, { addSuffix: true })}
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
          No upcoming deadlines
        </div>
      )}
    </Link>
  );
}
