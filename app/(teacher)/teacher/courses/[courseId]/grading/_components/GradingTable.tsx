'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export interface GradingRow {
  submissionId: string;
  studentName: string;
  assignmentTitle: string;
  assignmentId: string;
  aiScore: number | null;
  confidenceLevel: number | null;
  aiFeedbackCreatedAt: string | null; // ISO string
  submittedAt: string | null;
  status: string;
}

type Tab = 'needs-review' | 'auto-releasable' | 'released';

const AUTO_RELEASE_MIN_CONFIDENCE = 0.8;
const AUTO_RELEASE_MIN_AGE_MS = 24 * 60 * 60 * 1000;

function ConfidenceDot({ level }: { level: number | null }) {
  if (level === null) return <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />;
  const color =
    level >= 0.8 ? 'bg-green-500' : level >= 0.6 ? 'bg-yellow-400' : 'bg-red-500';
  return <span className={`w-2.5 h-2.5 rounded-full inline-block ${color}`} title={`${Math.round(level * 100)}%`} />;
}

function statusLabel(status: string) {
  return (
    {
      AI_GRADED: 'AI graded',
      TEACHER_REVIEWED: 'Reviewed',
      RELEASED: 'Released',
    }[status] ?? status
  );
}

function isAutoReleasable(row: GradingRow): boolean {
  if (row.status !== 'AI_GRADED') return false;
  if ((row.confidenceLevel ?? 0) < AUTO_RELEASE_MIN_CONFIDENCE) return false;
  if (!row.aiFeedbackCreatedAt) return false;
  return Date.now() - new Date(row.aiFeedbackCreatedAt).getTime() >= AUTO_RELEASE_MIN_AGE_MS;
}

export function GradingTable({
  rows,
  courseId,
}: {
  rows: GradingRow[];
  courseId: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('needs-review');
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  const needsReview = rows.filter(
    (r) => (r.status === 'AI_GRADED' || r.status === 'TEACHER_REVIEWED') && !isAutoReleasable(r),
  );
  const autoReleasable = rows.filter(isAutoReleasable);
  const released = rows.filter((r) => r.status === 'RELEASED');

  const tabRows: Record<Tab, GradingRow[]> = {
    'needs-review': needsReview,
    'auto-releasable': autoReleasable,
    released,
  };
  const visible = tabRows[activeTab];

  async function handleReleaseAll() {
    setReleaseError('');
    setReleasing(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/grading/release`, { method: 'POST' });
      if (!res.ok) {
        setReleaseError('Release failed. Please try again.');
        return;
      }
      router.refresh();
    } finally {
      setReleasing(false);
    }
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'needs-review', label: 'Needs Review', count: needsReview.length },
    { key: 'auto-releasable', label: 'Auto-releasable', count: autoReleasable.length },
    { key: 'released', label: 'Released', count: released.length },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-xs text-gray-500 tabular-nums">
              {tab.count}
            </span>
          </button>
        ))}

        {activeTab === 'auto-releasable' && autoReleasable.length > 0 && (
          <div className="ml-auto flex items-center gap-2 pb-1">
            {releaseError && <span className="text-xs text-red-500">{releaseError}</span>}
            <button
              onClick={handleReleaseAll}
              disabled={releasing}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {releasing ? 'Releasing…' : `Release All (${autoReleasable.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No submissions in this category.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Student</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Assignment</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">AI Score</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Confidence</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Submitted</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {visible.map((row) => (
                <tr
                  key={row.submissionId}
                  onClick={() =>
                    router.push(
                      `/teacher/courses/${courseId}/grading/${row.submissionId}`,
                    )
                  }
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{row.studentName}</td>
                  <td className="px-4 py-3 text-gray-600">{row.assignmentTitle}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">
                    {row.aiScore !== null ? `${Math.round(row.aiScore)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ConfidenceDot level={row.confidenceLevel} />
                      <span className="text-xs text-gray-500 tabular-nums">
                        {row.confidenceLevel !== null
                          ? `${Math.round(row.confidenceLevel * 100)}%`
                          : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {row.submittedAt ? format(new Date(row.submittedAt), 'MMM d, HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {statusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
