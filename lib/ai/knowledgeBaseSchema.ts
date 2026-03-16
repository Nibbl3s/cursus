import { z } from 'zod';

export const KnowledgeBaseImportSchema = z.object({
  title: z.string(),
  content: z.string(),         // markdown
});

export type KnowledgeBaseImport = z.infer<typeof KnowledgeBaseImportSchema>;
