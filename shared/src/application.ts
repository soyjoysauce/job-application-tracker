import { z } from 'zod';

import { idSchema } from './common.js';

// Mirrors the CHECK constraint on applications.status.
export const applicationStatusSchema = z.enum([
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

const notesSchema = z.string().max(10_000).nullable();
// ISO 8601 with a time zone offset, e.g. "2026-09-16T00:00:00Z".
const appliedAtSchema = z.iso.datetime({ offset: true }).nullable();

// POST /api/applications
export const createApplicationSchema = z.strictObject({
  postingId: idSchema,
  status: applicationStatusSchema.optional(),
  notes: notesSchema.optional(),
  appliedAt: appliedAtSchema.optional(),
});
export type CreateApplicationInput = z.input<typeof createApplicationSchema>;

// PATCH /api/applications/:id — only the fields sent are changed.
export const updateApplicationSchema = z
  .strictObject({
    status: applicationStatusSchema.optional(),
    notes: notesSchema.optional(),
    appliedAt: appliedAtSchema.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });
export type UpdateApplicationInput = z.input<typeof updateApplicationSchema>;

// GET /api/applications?status=applied
export const listApplicationsQuerySchema = z.object({
  status: applicationStatusSchema.optional(),
});

export interface Application {
  id: string;
  postingId: string;
  status: ApplicationStatus;
  notes: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationWithPosting extends Application {
  posting: {
    id: string;
    /** null until the posting has been analyzed. */
    title: string | null;
    company: string | null;
  };
}
