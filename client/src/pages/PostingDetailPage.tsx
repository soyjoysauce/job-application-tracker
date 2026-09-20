// One job posting: analysis (once step 8 exists), its application, the pasted text, and delete.
import type { JobPosting, PostingExtraction } from '@jat/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApplicationSection } from '../components/ApplicationSection';
import { Badge, Button, Card, ErrorText } from '../components/ui';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../lib/api';
import { analysisStatusLabel, analysisStatusTone, formatTimestamp } from '../lib/format';

export default function PostingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: posting, loading, error, reload } = useApiQuery<JobPosting>(`/api/postings/${id}`);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(undefined);
    try {
      await api.delete(`/api/postings/${id}`);
      void navigate('/postings', { replace: true });
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : 'Failed to delete posting');
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error || !posting) {
    return (
      <div className="space-y-3">
        <ErrorText>{error ?? 'Posting not found'}</ErrorText>
        <Link to="/postings" className="text-sm font-medium text-slate-900 underline">
          Back to postings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/postings" className="text-sm text-slate-600 underline">
          ← All postings
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              {posting.extracted?.title ?? 'Untitled posting'}
            </h1>
            {posting.extracted?.company && (
              <p className="text-sm text-slate-600">{posting.extracted.company}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Added {formatTimestamp(posting.createdAt)}
            </p>
          </div>
          <Badge tone={analysisStatusTone[posting.analysisStatus]}>
            {analysisStatusLabel[posting.analysisStatus]}
          </Badge>
        </div>
      </div>

      <AnalysisCard posting={posting} />

      <ApplicationSection posting={posting} onChanged={reload} />

      <Card>
        <h2 className="font-medium">Posting text</h2>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-sans text-sm text-slate-700">
          {posting.rawText}
        </pre>
      </Card>

      <Card className="border-red-200">
        <h2 className="text-sm font-medium text-red-700">Delete posting</h2>
        <p className="mt-1 text-sm text-slate-600">
          {posting.application
            ? 'This also deletes the application you are tracking for it.'
            : 'This cannot be undone.'}
        </p>
        <ErrorText>{deleteError}</ErrorText>
        <div className="mt-3 flex items-center gap-3">
          {confirmingDelete ? (
            <>
              <Button variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
                {deleting ? 'Deleting…' : 'Yes, delete it'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete posting
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function AnalysisCard({ posting }: { posting: JobPosting }) {
  const { extracted, gapAnalysis, analysisStatus } = posting;

  if (!extracted) {
    return (
      <Card>
        <h2 className="font-medium">Analysis</h2>
        <p className="mt-1 text-sm text-slate-600">
          {analysisStatus === 'failed'
            ? 'Claude could not read this posting. Try deleting it and pasting the text again.'
            : 'Claude will extract the role details and compare them with your profile. (Coming in step 8.)'}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-medium">Analysis</h2>
      <dl className="mt-3 space-y-3 text-sm">
        <SkillRow label="Required skills" values={extracted.requiredSkills} />
        <SkillRow label="Nice to have" values={extracted.niceToHaveSkills} />
        <SkillRow label="Stack" values={extracted.stack} />
        <div>
          <dt className="text-slate-500">Seniority</dt>
          <dd className="text-slate-900">{extracted.seniority}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Salary</dt>
          <dd className="text-slate-900">{formatSalary(extracted.salaryRange)}</dd>
        </div>
      </dl>

      {/* The gap analysis shape is defined in step 8; show it raw until then. */}
      {gapAnalysis != null && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-slate-700">Gap analysis</h3>
          <pre className="mt-1 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(gapAnalysis, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}

function SkillRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1">
        {values.length === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          values.map((value) => (
            <Badge key={value} tone="gray">
              {value}
            </Badge>
          ))
        )}
      </dd>
    </div>
  );
}

function formatSalary(range: PostingExtraction['salaryRange']): string {
  // Only shown when the posting itself listed a salary; never inferred.
  if (!range || (range.min === null && range.max === null)) return 'Not listed';
  const currency = range.currency ? `${range.currency} ` : '';
  if (range.min !== null && range.max !== null) {
    return `${currency}${range.min.toLocaleString()} – ${range.max.toLocaleString()}`;
  }
  return `${currency}${(range.min ?? range.max)?.toLocaleString() ?? ''}`;
}
