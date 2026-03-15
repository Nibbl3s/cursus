'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { z } from 'zod';
import { RubricBuilder, type Criterion } from './RubricBuilder';
import { TaskBuilder, type TaskDraft } from './TaskBuilder';

// MDEditor is ESM-only — load client-side only
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

// ---- Zod schema ----
const assignmentSchema = z.object({
  title:          z.string().min(1, 'Title is required'),
  brief:          z.string().optional(),
  dueDate:        z.string().min(1, 'Due date is required'),
  weight:         z.number().min(0).max(100),
  difficulty:     z.enum(['EASY', 'MEDIUM', 'HARD', 'BOSS']),
  pointValue:     z.number().int().positive(),
  assessmentMode: z.enum(['SELF_ASSESSED', 'PEER_REVIEW', 'SOCRATIC', 'TEACHER_GRADED', 'HYBRID']),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

// ---- Props ----
interface Props {
  courseId: string;
  /** When provided the form PATCHes instead of POSTing */
  assignmentId?: string;
  defaultValues?: Partial<AssignmentFormValues>;
  defaultCriteria?: Criterion[];
  defaultTasks?: TaskDraft[];
}

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'BOSS'] as const;
const ASSESSMENT_MODES = ['SELF_ASSESSED', 'PEER_REVIEW', 'SOCRATIC', 'TEACHER_GRADED', 'HYBRID'] as const;

const MODE_LABELS: Record<typeof ASSESSMENT_MODES[number], string> = {
  SELF_ASSESSED:   'Self-assessed',
  PEER_REVIEW:     'Peer review',
  SOCRATIC:        'Socratic',
  TEACHER_GRADED:  'Teacher graded',
  HYBRID:          'Hybrid',
};

// ---- Component ----
export function AssignmentForm({ courseId, assignmentId, defaultValues, defaultCriteria, defaultTasks }: Props) {
  const router = useRouter();

  const [title,          setTitle]          = useState(defaultValues?.title          ?? '');
  const [brief,          setBrief]          = useState(defaultValues?.brief          ?? '');
  const [dueDate,        setDueDate]        = useState(defaultValues?.dueDate        ?? '');
  const [weight,         setWeight]         = useState<string>(String(defaultValues?.weight         ?? 0));
  const [difficulty,     setDifficulty]     = useState<typeof DIFFICULTIES[number]>(defaultValues?.difficulty     ?? 'MEDIUM');
  const [pointValue,     setPointValue]     = useState<string>(String(defaultValues?.pointValue     ?? 100));
  const [assessmentMode, setAssessmentMode] = useState<typeof ASSESSMENT_MODES[number]>(defaultValues?.assessmentMode ?? 'SELF_ASSESSED');

  const [criteria,    setCriteria]    = useState<Criterion[]>(defaultCriteria ?? []);
  const [tasks,       setTasks]       = useState<TaskDraft[]>(defaultTasks    ?? []);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AssignmentFormValues, string>>>({});
  const [serverError, setServerError] = useState('');
  const [saving,      setSaving]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setServerError('');

    const parsed = assignmentSchema.safeParse({
      title,
      brief:          brief || undefined,
      dueDate,
      weight:         parseFloat(weight),
      difficulty,
      pointValue:     parseInt(pointValue, 10),
      assessmentMode,
    });

    if (!parsed.success) {
      const errs: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof AssignmentFormValues;
        errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setSaving(true);

    const url    = assignmentId ? `/api/assignments/${assignmentId}` : '/api/assignments';
    const method = assignmentId ? 'PATCH' : 'POST';
    const body   = assignmentId ? parsed.data : { ...parsed.data, courseId };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(data.error?.formErrors?.[0] ?? 'Something went wrong.');
      setSaving(false);
      return;
    }

    const saved = await res.json();

    // Save rubric if any criteria were defined
    if (criteria.length > 0) {
      const rubricRes = await fetch('/api/rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: saved.id, criteria }),
      });
      if (!rubricRes.ok) {
        const data = await rubricRes.json().catch(() => ({}));
        setServerError(data.error?.formErrors?.[0] ?? 'Assignment saved but rubric failed to save.');
        setSaving(false);
        return;
      }
    }

    // Save tasks if any were defined
    if (tasks.length > 0) {
      const tasksRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: saved.id, tasks }),
      });
      if (!tasksRes.ok) {
        const data = await tasksRes.json().catch(() => ({}));
        setServerError(data.error?.formErrors?.[0] ?? 'Assignment saved but tasks failed to save.');
        setSaving(false);
        return;
      }
    }

    router.push(`/teacher/courses/${courseId}/assignments/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Market Analysis Report"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
      </div>

      {/* Brief — markdown editor */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Brief</label>
        <div data-color-mode="light">
          <MDEditor value={brief} onChange={(v) => setBrief(v ?? '')} height={240} />
        </div>
        {fieldErrors.brief && <p className="mt-1 text-xs text-red-600">{fieldErrors.brief}</p>}
      </div>

      {/* Due date + Weight */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Due date <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {fieldErrors.dueDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.dueDate}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Weight (%) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {fieldErrors.weight && <p className="mt-1 text-xs text-red-600">{fieldErrors.weight}</p>}
        </div>
      </div>

      {/* Difficulty + Point value */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof DIFFICULTIES[number])}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            XP value <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            value={pointValue}
            onChange={(e) => setPointValue(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {fieldErrors.pointValue && <p className="mt-1 text-xs text-red-600">{fieldErrors.pointValue}</p>}
        </div>
      </div>

      {/* Assessment mode */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Assessment mode</label>
        <select
          value={assessmentMode}
          onChange={(e) => setAssessmentMode(e.target.value as typeof ASSESSMENT_MODES[number])}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          {ASSESSMENT_MODES.map((m) => (
            <option key={m} value={m}>{MODE_LABELS[m]}</option>
          ))}
        </select>
      </div>

      {/* Task chain */}
      <div className="pt-2 border-t border-gray-100">
        <TaskBuilder tasks={tasks} onChange={setTasks} />
      </div>

      {/* Rubric */}
      <div className="pt-2 border-t border-gray-100">
        <RubricBuilder criteria={criteria} onChange={setCriteria} />
      </div>

      {serverError && <p className="text-xs text-red-600">{serverError}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : assignmentId ? 'Save changes' : 'Create assignment'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
