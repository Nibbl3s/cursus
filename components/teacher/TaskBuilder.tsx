'use client';

import { useRef } from 'react';

export interface TaskDraft {
  title:              string;
  taskType:           TaskType;
  estimatedMins:      number;
  pointValue:         number;
  unlocksAfterIndex:  number | null; // index into this tasks array; null = always unlocked
  prompt:             string;
  isOptional:         boolean;
  learningObjective:  string;
  guidedQuestions:    { question: string; hint: string }[];
  starterFileUrl:     string;
}

type TaskType =
  | 'STUDY' | 'RESEARCH' | 'WRITING' | 'REVIEW'
  | 'QUIZ'  | 'PRACTICE' | 'REFLECTION' | 'PEER_REVIEW' | 'SOCRATIC'
  | 'GUIDED_QUESTIONS' | 'FILE_UPLOAD' | 'PEER_BOARD';

const TASK_TYPES: TaskType[] = [
  'STUDY', 'RESEARCH', 'WRITING', 'REVIEW',
  'QUIZ',  'PRACTICE', 'REFLECTION', 'PEER_REVIEW', 'SOCRATIC',
  'GUIDED_QUESTIONS', 'FILE_UPLOAD', 'PEER_BOARD',
];

const TYPE_LABELS: Record<TaskType, string> = {
  STUDY:            'Study',
  RESEARCH:         'Research',
  WRITING:          'Writing',
  REVIEW:           'Review',
  QUIZ:             'Quiz',
  PRACTICE:         'Practice',
  REFLECTION:       'Reflection',
  PEER_REVIEW:      'Peer review',
  SOCRATIC:         'Socratic',
  GUIDED_QUESTIONS: 'Guided questions',
  FILE_UPLOAD:      'File upload',
  PEER_BOARD:       'Peer board',
};

const EMPTY_TASK: TaskDraft = {
  title:             '',
  taskType:          'STUDY',
  estimatedMins:     30,
  pointValue:        20,
  unlocksAfterIndex: null,
  prompt:            '',
  isOptional:        false,
  learningObjective: '',
  guidedQuestions:   [],
  starterFileUrl:    '',
};

interface Props {
  tasks:    TaskDraft[];
  onChange: (tasks: TaskDraft[]) => void;
}

export function TaskBuilder({ tasks, onChange }: Props) {
  const dragIndex = useRef<number | null>(null);

  function add() {
    onChange([...tasks, { ...EMPTY_TASK }]);
  }

  function remove(index: number) {
    const next = tasks.filter((_, i) => i !== index);
    // Fix any unlocksAfterIndex references that pointed at or past the removed item
    onChange(next.map((t) => ({
      ...t,
      unlocksAfterIndex:
        t.unlocksAfterIndex === null ? null
        : t.unlocksAfterIndex === index ? null               // pointed at removed task
        : t.unlocksAfterIndex > index  ? t.unlocksAfterIndex - 1
        : t.unlocksAfterIndex,
    })));
  }

  function update<K extends keyof TaskDraft>(index: number, field: K, value: TaskDraft[K]) {
    onChange(tasks.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  // ---- Drag-and-drop (HTML5 API, no library) ----
  function onDragStart(index: number) {
    dragIndex.current = index;
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault(); // required to allow drop
  }

  function onDrop(targetIndex: number) {
    const from = dragIndex.current;
    if (from === null || from === targetIndex) return;
    dragIndex.current = null;

    const next = [...tasks];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);

    // Remap unlocksAfterIndex references after reorder
    onChange(next.map((t) => {
      if (t.unlocksAfterIndex === null) return t;
      // The reference is stored as the OLD index — find the task it pointed to
      // and find its NEW index.
      const oldRef = t.unlocksAfterIndex;
      let newRef: number | null;
      if (oldRef === from) {
        newRef = targetIndex;
      } else if (from < targetIndex) {
        newRef = oldRef > from && oldRef <= targetIndex ? oldRef - 1 : oldRef;
      } else {
        newRef = oldRef >= targetIndex && oldRef < from ? oldRef + 1 : oldRef;
      }
      return { ...t, unlocksAfterIndex: newRef };
    }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Task chain</h3>
        <button
          type="button"
          onClick={add}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          + Add task
        </button>
      </div>

      {tasks.length === 0 && (
        <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
          No tasks yet. Add one above.
        </p>
      )}

      <div className="space-y-2">
        {tasks.map((task, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(i)}
            className="flex gap-2 items-start bg-gray-50 border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing"
          >
            {/* Drag handle */}
            <span
              className="shrink-0 text-gray-300 select-none pt-2 text-xs leading-none"
              aria-hidden="true"
            >
              ⠿
            </span>

            {/* Fields */}
            <div className="flex-1 grid grid-cols-1 gap-2">
              {/* Row 1: title */}
              <input
                value={task.title}
                onChange={(e) => update(i, 'title', e.target.value)}
                placeholder="Task title (e.g. Read chapter 3)"
                className="w-full px-2.5 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {/* Row 2: type / mins / points / unlocks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Type</label>
                  <select
                    value={task.taskType}
                    onChange={(e) => update(i, 'taskType', e.target.value as TaskType)}
                    className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Est. mins</label>
                  <input
                    type="number"
                    min={1}
                    value={task.estimatedMins}
                    onChange={(e) => update(i, 'estimatedMins', parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">XP</label>
                  <input
                    type="number"
                    min={1}
                    value={task.pointValue}
                    onChange={(e) => update(i, 'pointValue', parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Unlocks after</label>
                  <select
                    value={task.unlocksAfterIndex ?? ''}
                    onChange={(e) =>
                      update(i, 'unlocksAfterIndex', e.target.value === '' ? null : parseInt(e.target.value, 10))
                    }
                    className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None</option>
                    {tasks.slice(0, i).map((prev, j) => (
                      <option key={j} value={j}>
                        {j + 1}. {prev.title || '(untitled)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Prompt */}
              <textarea
                value={task.prompt}
                onChange={(e) => update(i, 'prompt', e.target.value)}
                placeholder="Challenge description shown to the student..."
                rows={2}
                className="w-full px-2.5 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />

              {/* Optional toggle */}
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={task.isOptional}
                  onChange={(e) => update(i, 'isOptional', e.target.checked)}
                  className="rounded"
                />
                Optional (exploration branch)
              </label>

              {/* Type-specific: SOCRATIC */}
              {task.taskType === 'SOCRATIC' && (
                <input
                  value={task.learningObjective}
                  onChange={(e) => update(i, 'learningObjective', e.target.value)}
                  placeholder="Learning objective (guides AI dialogue)..."
                  className="w-full px-2.5 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}

              {/* Type-specific: FILE_UPLOAD */}
              {task.taskType === 'FILE_UPLOAD' && (
                <input
                  value={task.starterFileUrl}
                  onChange={(e) => update(i, 'starterFileUrl', e.target.value)}
                  placeholder="Starter file URL (optional)..."
                  className="w-full px-2.5 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}

              {/* Type-specific: GUIDED_QUESTIONS */}
              {task.taskType === 'GUIDED_QUESTIONS' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">Questions</p>
                  {task.guidedQuestions.map((q, qi) => (
                    <div key={qi} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <input
                          value={q.question}
                          onChange={(e) => {
                            const next = [...task.guidedQuestions];
                            next[qi] = { ...next[qi], question: e.target.value };
                            update(i, 'guidedQuestions', next);
                          }}
                          placeholder={`Question ${qi + 1}...`}
                          className="w-full px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                          value={q.hint}
                          onChange={(e) => {
                            const next = [...task.guidedQuestions];
                            next[qi] = { ...next[qi], hint: e.target.value };
                            update(i, 'guidedQuestions', next);
                          }}
                          placeholder="Hint (optional)..."
                          className="w-full px-2 py-1 text-xs text-gray-400 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => update(i, 'guidedQuestions', task.guidedQuestions.filter((_, j) => j !== qi))}
                        className="text-gray-300 hover:text-red-500 text-lg leading-none mt-0.5"
                      >×</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => update(i, 'guidedQuestions', [...task.guidedQuestions, { question: '', hint: '' }])}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >+ Add question</button>
                </div>
              )}
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-lg leading-none pt-1"
              aria-label="Remove task"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
