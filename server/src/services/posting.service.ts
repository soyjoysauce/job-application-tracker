// Job posting data access. Postings are read-only after creation (ADR-009):
// create, read, and delete only. Analysis fields are written by the analyzer (step 8).
import {
  analysisStatusSchema,
  applicationStatusSchema,
  postingExtractionSchema,
  type JobPosting,
  type JobPostingSummary,
  type PostingApplicationRef,
  type PostingExtraction,
} from '@jat/shared';

import { notFound, toHttpError } from '../lib/dbError.js';
import type { Db } from '../lib/supabase.js';
import type { Json } from '../types/database.types.js';

const PREVIEW_LENGTH = 160;

// `application:applications(...)` embeds the posting's application (one-to-one) as an object or null.
const SUMMARY_COLUMNS =
  'id, raw_text, extracted, analysis_status, created_at, application:applications(id, status)';
const DETAIL_COLUMNS =
  'id, raw_text, extracted, gap_analysis, analysis_status, created_at, updated_at, application:applications(id, status)';

interface ApplicationRefRow {
  id: string;
  status: string;
}

interface PostingSummaryRow {
  id: string;
  raw_text: string;
  extracted: Json | null;
  analysis_status: string;
  created_at: string;
  application: ApplicationRefRow | null;
}

interface PostingDetailRow extends PostingSummaryRow {
  gap_analysis: Json | null;
  updated_at: string;
}

// Stored JSON is validated before saving (step 8); parsing again keeps the API types honest.
function parseExtraction(value: Json | null): PostingExtraction | null {
  if (value === null) return null;
  const result = postingExtractionSchema.safeParse(value);
  return result.success ? result.data : null;
}

function toApplicationRef(row: ApplicationRefRow | null): PostingApplicationRef | null {
  return row ? { id: row.id, status: applicationStatusSchema.parse(row.status) } : null;
}

function toSummary(row: PostingSummaryRow): JobPostingSummary {
  const extracted = parseExtraction(row.extracted);
  return {
    id: row.id,
    title: extracted?.title ?? null,
    company: extracted?.company ?? null,
    preview: row.raw_text.slice(0, PREVIEW_LENGTH),
    analysisStatus: analysisStatusSchema.parse(row.analysis_status),
    createdAt: row.created_at,
    application: toApplicationRef(row.application),
  };
}

function toPosting(row: PostingDetailRow): JobPosting {
  return {
    id: row.id,
    rawText: row.raw_text,
    extracted: parseExtraction(row.extracted),
    gapAnalysis: row.gap_analysis,
    analysisStatus: analysisStatusSchema.parse(row.analysis_status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    application: toApplicationRef(row.application),
  };
}

/** Newest first. */
export async function listPostings(db: Db, userId: string): Promise<JobPostingSummary[]> {
  const { data, error } = await db
    .from('job_postings')
    .select(SUMMARY_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw toHttpError(error);

  return data.map(toSummary);
}

export async function getPosting(db: Db, userId: string, postingId: string): Promise<JobPosting> {
  const { data, error } = await db
    .from('job_postings')
    .select(DETAIL_COLUMNS)
    .eq('user_id', userId)
    .eq('id', postingId)
    .maybeSingle();
  if (error) throw toHttpError(error);
  if (!data) throw notFound('Posting');

  return toPosting(data);
}

/** Saves the pasted text with analysis_status 'pending'. */
export async function createPosting(db: Db, userId: string, rawText: string): Promise<JobPosting> {
  const { data, error } = await db
    .from('job_postings')
    .insert({ user_id: userId, raw_text: rawText })
    .select(DETAIL_COLUMNS)
    .single();
  if (error) throw toHttpError(error);

  return toPosting(data);
}

/** Deleting a posting also deletes its application (on delete cascade). */
export async function deletePosting(db: Db, userId: string, postingId: string): Promise<void> {
  // RLS hides other users' rows, so "0 rows deleted" means not found (or not yours).
  const { data, error } = await db
    .from('job_postings')
    .delete()
    .eq('user_id', userId)
    .eq('id', postingId)
    .select('id');
  if (error) throw toHttpError(error);
  if (data.length === 0) throw notFound('Posting');
}
