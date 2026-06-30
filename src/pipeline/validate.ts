import { z } from 'zod';

export const DefaultOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  current_headline: z.string().nullable(),
  location_summary: z.string().nullable(),
  total_years_exp: z.number().nullable(),
  skill_tags: z.array(z.string()),
  work_history: z.array(z.any())
});

export function validate(projected: unknown, schema: z.ZodSchema = DefaultOutputSchema): { valid: boolean; errors?: string[] } {
  const result = schema.safeParse(projected);
  
  if (result.success) {
    return { valid: true };
  }
  
  const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
  return { valid: false, errors };
}