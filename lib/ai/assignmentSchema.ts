import { z } from 'zod';

export const TaskImportSchema = z.object({
  title: z.string(),
  taskType: z.enum(['STUDY', 'RESEARCH', 'WRITING', 'REVIEW', 'QUIZ', 'PRACTICE', 'REFLECTION', 'PEER_REVIEW', 'SOCRATIC', 'GUIDED_QUESTIONS', 'FILE_UPLOAD', 'PEER_BOARD']),
  estimatedMins: z.number().int().positive(),
  pointValue: z.number().int().positive(),
  unlocksAfterIndex: z.number().int().nullable(), // index into tasks array, null = unlocked
});

export const AssignmentImportSchema = z.object({
  title: z.string(),
  brief: z.string(),           // markdown
  dueDate: z.string(),         // ISO 8601
  weight: z.number().min(0).max(100),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'BOSS']),
  pointValue: z.number().int().positive(),
  tasks: z.array(TaskImportSchema).min(1),
});

export type TaskImport = z.infer<typeof TaskImportSchema>;
export type AssignmentImport = z.infer<typeof AssignmentImportSchema>;
