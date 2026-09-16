// Application (tracker entry) data access. At most one application per posting (ADR-005).
import {
  applicationStatusSchema,
  postingExtractionSchema,
  type Application,
  type ApplicationStatus,
  type ApplicationWithPosting,
} from '@jat/shared';

import { notFound, toHttpError } from '../lib/dbError.js';
import { HttpError } from '../lib/httpError.js';
import type { Db } from '../lib/supabase.js';
import type { Json } from '../types/database.types.js';

const COLUMNS =
  'id, posting_id, status, notes, applied_at, created_at, updated_at, posting:job_postings(id, extracted)';

interface ApplicationRow {
  id: string;
  posting_id: string;
  status: string;
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  posting: { id: string; extracted: Json | null };
}

export interface ApplicationChanges {
  status?: ApplicationStatus;
  notes?: string | null;
  appliedAt?: string | null;
}

function toApplication(row: ApplicationRow): ApplicationWithPosting {
  const extracted = postingExtractionSchema.safeParse(row.posting.extracted);
  const application: Application = {
    id: row.id,
    postingId: row.posting_id,
    status: applicationStatusSchema.parse(row.status),
    notes: row.notes,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return {
    ...application,
    posting: {
      id: row.posting.id,
      title: extracted.success ? extracted.data.title : null,
      company: extracted.success ? extracted.data.company : null,
    },
  };
}

/** Maps API field names to column names, skipping fields that weren't sent. */
function toColumns(changes: ApplicationChanges) {
  return {
    ...(changes.status !== undefined && { status: changes.status }),
    ...(changes.notes !== undefined && { notes: changes.notes }),
    ...(changes.appliedAt !== undefined && { applied_at: changes.appliedAt }),
  };
}

/** Most recently updated first. Optionally filtered by status. */
export async function listApplications(
  db: Db,
  userId: string,
  status?: ApplicationStatus,
): Promise<ApplicationWithPosting[]> {
  let query = db.from('applications').select(COLUMNS).eq('user_id', userId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw toHttpError(error);

  return data.map(toApplication);
}

export async function getApplication(
  db: Db,
  userId: string,
  applicationId: string,
): Promise<ApplicationWithPosting> {
  const { data, error } = await db
    .from('applications')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('id', applicationId)
    .maybeSingle();
  if (error) throw toHttpError(error);
  if (!data) throw notFound('Application');

  return toApplication(data);
}

export async function createApplication(
  db: Db,
  userId: string,
  postingId: string,
  changes: ApplicationChanges,
): Promise<ApplicationWithPosting> {
  // Check the posting first for a clear 404. RLS would also block another user's posting,
  // but with a less helpful error.
  const posting = await db
    .from('job_postings')
    .select('id')
    .eq('user_id', userId)
    .eq('id', postingId)
    .maybeSingle();
  if (posting.error) throw toHttpError(posting.error);
  if (!posting.data) throw notFound('Posting');

  const { data, error } = await db
    .from('applications')
    .insert({ user_id: userId, posting_id: postingId, ...toColumns(changes) })
    .select(COLUMNS)
    .single();
  if (error?.code === '23505') {
    throw new HttpError(409, 'CONFLICT', 'This posting already has an application');
  }
  if (error) throw toHttpError(error);

  return toApplication(data);
}

export async function updateApplication(
  db: Db,
  userId: string,
  applicationId: string,
  changes: ApplicationChanges,
): Promise<ApplicationWithPosting> {
  const { data, error } = await db
    .from('applications')
    .update(toColumns(changes))
    .eq('user_id', userId)
    .eq('id', applicationId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw toHttpError(error);
  if (!data) throw notFound('Application');

  return toApplication(data);
}

export async function deleteApplication(
  db: Db,
  userId: string,
  applicationId: string,
): Promise<void> {
  const { data, error } = await db
    .from('applications')
    .delete()
    .eq('user_id', userId)
    .eq('id', applicationId)
    .select('id');
  if (error) throw toHttpError(error);
  if (data.length === 0) throw notFound('Application');
}
