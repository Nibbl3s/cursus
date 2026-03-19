'use client';

import { useState } from 'react';
import { parseAssignmentImport } from '@/lib/ai/parseImport';
import type { AssignmentImport } from '@/lib/ai/assignmentSchema';
import type { TaskDraft } from './TaskBuilder';

interface Props {
  onImport: (data: {
    title: string;
    brief: string;
    dueDate: string;
    weight: number;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'BOSS';
    pointValue: number;
    tasks: TaskDraft[];
  }) => void;
}

export function ImportPastePanel({ onImport }: Props) {
  const [json, setJson]     = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function handleValidate() {
    setErrors([]);
    const result = parseAssignmentImport(json);

    if (!result.success) {
      setErrors(result.errors.issues.map((i) => {
        const path = i.path.length > 0 ? `${i.path.join('.')}: ` : '';
        return `${path}${i.message}`;
      }));
      return;
    }

    const data: AssignmentImport = result.data;
    onImport({
      title:      data.title,
      brief:      data.brief,
      dueDate:    data.dueDate,
      weight:     data.weight,
      difficulty: data.difficulty,
      pointValue: data.pointValue,
      tasks:      data.tasks.map((t) => ({
        title:             t.title,
        taskType:          t.taskType,
        estimatedMins:     t.estimatedMins,
        pointValue:        t.pointValue,
        unlocksAfterIndex: t.unlocksAfterIndex,
        prompt:            '',
        isOptional:        false,
        learningObjective: '',
        guidedQuestions:   [],
        starterFileUrl:    '',
      })),
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Paste the JSON output from your external LLM below, then click &ldquo;Validate &amp; Import&rdquo; to pre-fill the form.
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='{ "title": "...", "tasks": [...] }'
        rows={8}
        className="w-full px-3 py-2 text-xs font-mono text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
      />
      {errors.length > 0 && (
        <ul className="space-y-0.5">
          {errors.map((err, i) => (
            <li key={i} className="text-xs text-red-600">{err}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={handleValidate}
        className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
      >
        Validate &amp; Import
      </button>
    </div>
  );
}
