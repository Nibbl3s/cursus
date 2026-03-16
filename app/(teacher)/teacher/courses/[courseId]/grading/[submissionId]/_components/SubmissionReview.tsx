'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });
const MDPreview = dynamic(
  () => import('@uiw/react-md-editor').then((m) => m.default.Markdown),
  { ssr: false },
);

export interface CriterionScore {
  id: string;
  label: string;
  maxScore: number;
  score: number | null;
}

export interface SubmissionReviewProps {
  submissionId: string;
  courseId: string;
  studentName: string;
  assignmentBrief: string | null;
  submittedContent: string;
  aiFeedbackMarkdown: string;
  aiOverallScore: number;
  quickWins: string[];
  strengths: string[];
  confidenceLevel: number;
  criterionScores: CriterionScore[];
  alreadyReleased: boolean;
}

export function SubmissionReview({
  submissionId,
  courseId,
  studentName,
  assignmentBrief,
  submittedContent,
  aiFeedbackMarkdown,
  aiOverallScore,
  quickWins,
  strengths,
  confidenceLevel,
  criterionScores,
  alreadyReleased,
}: SubmissionReviewProps) {
  const router = useRouter();
  const [score, setScore] = useState(String(Math.round(aiOverallScore)));
  const [feedback, setFeedback] = useState(aiFeedbackMarkdown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [released, setReleased] = useState(alreadyReleased);

  const scoreNum = parseFloat(score);
  const scoreChanged = !isNaN(scoreNum) && scoreNum !== aiOverallScore;

  async function handleRelease() {
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      setError('Score must be between 0 and 100.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/release`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalScore: scoreNum, feedbackMarkdown: feedback }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong.');
        return;
      }
      setReleased(true);
      router.refresh();
      router.push(`/teacher/courses/${courseId}/grading`);
    } finally {
      setSaving(false);
    }
  }

  const confidencePct = Math.round(confidenceLevel * 100);
  const confidenceColor =
    confidenceLevel >= 0.8
      ? 'text-green-600 bg-green-50'
      : confidenceLevel >= 0.6
        ? 'text-yellow-700 bg-yellow-50'
        : 'text-red-600 bg-red-50';

  return (
    <div className="space-y-8">
      {/* Assignment brief */}
      {assignmentBrief && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Assignment Brief</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div data-color-mode="light" className="prose prose-sm max-w-none">
              <MDPreview source={assignmentBrief} />
            </div>
          </div>
        </section>
      )}

      {/* Student submission */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          {studentName}&apos;s Submission
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div data-color-mode="light" className="prose prose-sm max-w-none">
            <MDPreview source={submittedContent} />
          </div>
        </div>
      </section>

      {/* AI Feedback */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">AI Feedback</h2>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColor}`}>
            {confidencePct}% confidence
          </span>
        </div>

        <div className="space-y-4">
          {/* Criterion scores */}
          {criterionScores.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                      Criterion
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 w-28">
                      Score / Max
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {criterionScores.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-gray-700">{c.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {c.score !== null ? c.score : '—'}
                        <span className="text-gray-400"> / {c.maxScore}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">
                Strengths
              </p>
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="text-sm text-green-800">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick wins */}
          {quickWins.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
                Quick Wins
              </p>
              <ul className="space-y-1">
                {quickWins.map((w, i) => (
                  <li key={i} className="text-sm text-blue-800">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Teacher review */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Teacher Review</h2>
        <div className="space-y-4">
          {/* Overall score */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Overall Score (0–100)
              {scoreChanged && (
                <span className="ml-2 text-amber-600 font-normal">
                  · override (AI: {Math.round(aiOverallScore)})
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
            />
          </div>

          {/* Feedback editor */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Feedback (editable before release)
            </label>
            <div data-color-mode="light">
              <MDEditor
                value={feedback}
                onChange={(v) => setFeedback(v ?? '')}
                preview="edit"
                height={280}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleRelease}
              disabled={saving || released}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
            >
              {saving ? 'Releasing…' : released ? 'Released' : 'Release to Student'}
            </button>
            {released && (
              <span className="text-sm text-green-600 font-medium">Released successfully.</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
