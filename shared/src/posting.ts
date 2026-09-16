import { z } from 'zod';

import type { ApplicationStatus } from './application.js';

// Matches the CHECK constraint on job_postings.raw_text.
export const RAW_TEXT_MAX_LENGTH = 50_000;

// POST /api/postings — postings are read-only after creation (ADR-009).
export const createPostingSchema = z.strictObject({
  rawText: z.string().trim().min(1).max(RAW_TEXT_MAX_LENGTH),
});
export type CreatePostingInput = z.input<typeof createPostingSchema>;

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

// Mirrors the CHECK constraint on job_postings.analysis_status.
export const analysisStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

/** The posting's application, if one exists (at most one per posting). */
export interface PostingApplicationRef {
  id: string;
  status: ApplicationStatus;
}

// GET /api/postings — list item (no full text).
export interface JobPostingSummary {
  id: string;
  /** null until analyzed. */
  title: string | null;
  company: string | null;
  /** First characters of the pasted text, for display before analysis. */
  preview: string;
  analysisStatus: AnalysisStatus;
  createdAt: string;
  application: PostingApplicationRef | null;
}

// GET /api/postings/:id and POST /api/postings
export interface JobPosting {
  id: string;
  rawText: string;
  extracted: PostingExtraction | null;
  gapAnalysis: GapAnalysis | null;
  analysisStatus: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
  application: PostingApplicationRef | null;
}
