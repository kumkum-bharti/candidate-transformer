import { z } from 'zod';

export const FieldProjectionSchema = z.object({
  from: z.string(),
  type: z.enum(['string', 'array', 'number', 'boolean', 'object']),
  required: z.boolean(),
  normalizeOverride: z.enum(['phone', 'date', 'country', 'skill']).optional()
});

export const ProjectionConfigSchema = z.object({
  fields: z.record(FieldProjectionSchema),
  include_provenance: z.boolean().default(true),
  include_confidence: z.boolean().default(true),
  on_missing: z.enum(['null', 'omit', 'error']).default('null')
});

export type FieldProjection = z.infer<typeof FieldProjectionSchema>;
export type ProjectionConfig = z.infer<typeof ProjectionConfigSchema>;