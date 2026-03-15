import { formatDistanceToNow } from 'date-fns';

type SubmissionStatus =
  | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED'
  | 'UNDER_REVIEW' | 'AI_GRADED' | 'TEACHER_REVIEWED' | 'RELEASED';

interface Student {
  id:    string;
  name:  string | null;
  email: string;
}

interface AssignmentCol {
  id:      string;
  title:   string;
  dueDate: Date;
}

interface SubmissionCell {
  studentId:    string;
  assignmentId: string;
  status:       SubmissionStatus;
  progressPct:  number;
}

interface Props {
  students:    Student[];
  assignments: AssignmentCol[];
  submissions: SubmissionCell[];
}

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  NOT_STARTED:      'bg-gray-100 text-gray-400',
  IN_PROGRESS:      'bg-blue-50 text-blue-700',
  SUBMITTED:        'bg-yellow-50 text-yellow-700',
  UNDER_REVIEW:     'bg-orange-50 text-orange-700',
  AI_GRADED:        'bg-purple-50 text-purple-700',
  TEACHER_REVIEWED: 'bg-violet-50 text-violet-700',
  RELEASED:         'bg-green-50 text-green-700',
};

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  NOT_STARTED:      '—',
  IN_PROGRESS:      'In progress',
  SUBMITTED:        'Submitted',
  UNDER_REVIEW:     'In review',
  AI_GRADED:        'AI graded',
  TEACHER_REVIEWED: 'Reviewed',
  RELEASED:         'Released',
};

export function SubmissionTable({ students, assignments, submissions }: Props) {
  // Build lookup: `${studentId}:${assignmentId}` → cell
  const cellMap = new Map(
    submissions.map((s) => [`${s.studentId}:${s.assignmentId}`, s]),
  );

  if (students.length === 0) {
    return <p className="text-sm text-gray-400">No students enrolled yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 w-44">
              Student
            </th>
            {assignments.map((a) => (
              <th key={a.id} className="px-3 py-3 text-left text-xs font-medium text-gray-500 min-w-36">
                <span className="block truncate max-w-36">{a.title}</span>
                <span className="block text-gray-400 font-normal">
                  {formatDistanceToNow(a.dueDate, { addSuffix: true })}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {students.map((student) => (
            <tr key={student.id} className="hover:bg-gray-50 transition-colors">
              <td className="sticky left-0 bg-white hover:bg-gray-50 px-4 py-3 font-medium text-gray-900 w-44">
                <span className="block truncate max-w-40">
                  {student.name ?? student.email.split('@')[0]}
                </span>
                <span className="block text-xs text-gray-400 truncate max-w-40">
                  {student.email}
                </span>
              </td>
              {assignments.map((a) => {
                const cell = cellMap.get(`${student.id}:${a.id}`);
                const status: SubmissionStatus = cell?.status ?? 'NOT_STARTED';
                return (
                  <td key={a.id} className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
                      {STATUS_LABELS[status]}
                      {cell && status === 'IN_PROGRESS' && (
                        <span className="tabular-nums">{Math.round(cell.progressPct)}%</span>
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
