import { ZodError } from 'zod';
import { AssignmentImportSchema, type AssignmentImport } from './assignmentSchema';
import { KnowledgeBaseImportSchema, type KnowledgeBaseImport } from './knowledgeBaseSchema';

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; errors: ZodError };

export function parseAssignmentImport(json: string): ParseSuccess<AssignmentImport> | ParseFailure {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    const error = new ZodError([{ code: 'custom', message: 'Invalid JSON', path: [] }]);
    return { success: false, errors: error };
  }

  const result = AssignmentImportSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function parseKnowledgeBaseImport(json: string): ParseSuccess<KnowledgeBaseImport> | ParseFailure {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    const error = new ZodError([{ code: 'custom', message: 'Invalid JSON', path: [] }]);
    return { success: false, errors: error };
  }

  const result = KnowledgeBaseImportSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
