import { z } from 'zod';

import type { ApplicationStatus } from './application.js';

// Matches the CHECK constraint on job_postings.raw_text.
export const RAW_TEXT_MAX_LENGTH = 50_000;

// POST /api/postings — postings are read-only after creation (ADR-009).
export const createPostingSchema = z.strictObject({
  rawText: z.string().trim().min(1).max(RAW_TEXT_MAX_LENGTH),
});
export type CreatePostingInput = z.input<typeof createPostingSchema>;

// Facts taken from the posting text only. Saved to job_postings.extracted.
// Claude returns this shape; unknown values are returned as the strings below rather than
// invented, so the UI can show "Not stated" instead of a guess.
export const postingExtractionSchema = z.object({
  /** "Not stated" when the posting has no clear title. */
  title: z.string(),
  /** "Not stated" when the company is not named. */
  company: z.string(),
  requiredSkills: z.array(z.string()),
  niceToHaveSkills: z.array(z.string()),
  stack: z.array(z.string()),
  /** e.g. "Junior", "Mid", "Senior", "Staff", or "Not stated". */
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

// Gap analysis: how the user's profile compares with the posting.
// Saved to job_postings.gap_analysis. Claude produces it; this schema both tells Claude
// the exact shape to return and validates the reply before it is saved.
export const gapAnalysisSchema = z.object({
  /** Required skills the user already has (matched by meaning, e.g. "Node" ≈ "Node.js"). */
  matchedSkills: z.array(z.string()),
  /** Required skills missing from the profile. */
  missingSkills: z.array(z.string()),
  /** Nice-to-have skills the user has — worth mentioning in an application. */
  matchedNiceToHave: z.array(z.string()),
  overallFit: z.enum(['strong', 'moderate', 'weak']),
  /** Two or three sentences: strengths, main gaps, what to emphasise. */
  summary: z.string(),
});
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
