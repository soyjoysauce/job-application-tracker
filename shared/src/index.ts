// Shared zod schemas and types used by both client/ and server/.
// The server validates Claude's output against these schemas before saving it.
import { z } from 'zod';

// STUB — posting extraction schema (roadmap step 8). Saved to job_postings.extracted.
// Facts from the posting text only. Refine types and constraints when implementing.
export const postingExtractionSchema = z.object({
  title: z.string(),
  company: z.string(),
  requiredSkills: z.array(z.string()),
  niceToHaveSkills: z.array(z.string()),
  stack: z.array(z.string()),
  seniority: z.string(),
  // Only present if the posting lists a salary; never inferred.
  salaryRange: z
    .object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      currency: z.string().nullable(),
    })
    .nullable(),
});

export type PostingExtraction = z.infer<typeof postingExtractionSchema>;

// STUB — gap analysis schema (roadmap step 8). Saved to job_postings.gap_analysis.
// Compares the posting against the user's profile.
// TODO(step 8): define the shape (e.g. matched / missing skills, summary).
export const gapAnalysisSchema = z.unknown();

export type GapAnalysis = z.infer<typeof gapAnalysisSchema>;

// Claude returns both parts in one response; the server saves them to separate columns.
export const postingAnalysisSchema = z.object({
  extraction: postingExtractionSchema,
  gapAnalysis: gapAnalysisSchema,
});

export type PostingAnalysis = z.infer<typeof postingAnalysisSchema>;

// Status values mirror the CHECK constraint in supabase/migrations.
export const analysisStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

// Consistent error shape returned by the server's central error middleware.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
