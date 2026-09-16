import { z } from 'zod';

// A list of short labels (e.g. "React"): trimmed, non-empty, and de-duplicated case-insensitively
// (the first spelling wins).
const labelListSchema = z
  .array(z.string().trim().min(1).max(50))
  .max(100)
  .transform((labels) => {
    const seen = new Set<string>();
    return labels.filter((label) => {
      const key = label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

// PUT /api/profile — replaces both lists.
export const updateProfileSchema = z.strictObject({
  skills: labelListSchema,
  stack: labelListSchema,
});

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export interface Profile {
  skills: string[];
  stack: string[];
  /** null until the profile is saved for the first time. */
  updatedAt: string | null;
}
