// One job posting: Claude analysis, its application, the pasted text, and delete.
import type { GapAnalysis, JobPosting, PostingExtraction, UsageStatus } from '@jat/shared';
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

      <AnalysisCard posting={posting} onAnalyzed={reload} />

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

function AnalysisCard({ posting, onAnalyzed }: { posting: JobPosting; onAnalyzed: () => void }) {
  const { extracted, gapAnalysis, analysisStatus } = posting;
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string>();

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(undefined);
    try {
      await api.post(`/api/postings/${posting.id}/analyze`, {});
      onAnalyzed(); // Reload the posting, which now has the results.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  if (!extracted) {
    return (
      <Card>
        <h2 className="font-medium">Analysis</h2>
        <p className="mt-1 text-sm text-slate-600">
          {analysisStatus === 'failed'
            ? 'Claude could not analyse this posting last time. You can try again.'
            : 'Claude reads the posting and compares it with the skills in your profile.'}
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="mt-3 flex items-center gap-3">
          <Button disabled={analyzing} onClick={() => void handleAnalyze()}>
            {analyzing ? 'Analyzing…' : 'Analyze with Claude'}
          </Button>
          <RemainingToday />
        </div>
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

      {gapAnalysis && <GapAnalysisSection gap={gapAnalysis} />}
    </Card>
  );
}

const fitTone = { strong: 'green', moderate: 'amber', weak: 'red' } as const;
const fitLabel = { strong: 'Strong match', moderate: 'Partial match', weak: 'Weak match' };

function GapAnalysisSection({ gap }: { gap: GapAnalysis }) {
  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-slate-700">How you compare</h3>
        <Badge tone={fitTone[gap.overallFit]}>{fitLabel[gap.overallFit]}</Badge>
      </div>

      <p className="mt-2 text-sm text-slate-700">{gap.summary}</p>

      <dl className="mt-3 space-y-3 text-sm">
        <SkillRow label="You have" values={gap.matchedSkills} />
        <SkillRow label="Missing" values={gap.missingSkills} />
        <SkillRow label="Nice-to-haves you have" values={gap.matchedNiceToHave} />
      </dl>
    </div>
  );
}

/** "3 of 20 analyses left today" — so the daily limit is visible before it's hit. */
function RemainingToday() {
  const { data: usage } = useApiQuery<UsageStatus>('/api/usage');
  if (!usage) return null;
  return (
    <span className="text-xs text-slate-500">
      {usage.remaining} of {usage.limit} analyses left today
    </span>
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
