// List of saved job postings, newest first.
import type { JobPostingSummary } from '@jat/shared';
import { Link } from 'react-router';

import { Badge, Button, Card, ErrorText } from '../components/ui';
import { useApiQuery } from '../hooks/useApiQuery';
import {
  analysisStatusLabel,
  analysisStatusTone,
  applicationStatusTone,
  formatTimestamp,
  toTitleCase,
} from '../lib/format';

export default function PostingsPage() {
  const { data: postings, loading, error } = useApiQuery<JobPostingSummary[]>('/api/postings');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Job postings</h1>
        <Link to="/postings/new">
          <Button>Paste a posting</Button>
        </Link>
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}
      <ErrorText>{error}</ErrorText>

      {postings?.length === 0 && (
        <Card>
          <p className="text-sm text-slate-600">
            No postings yet.{' '}
            <Link to="/postings/new" className="font-medium text-slate-900 underline">
              Paste your first job posting
            </Link>{' '}
            to track it.
          </p>
        </Card>
      )}

      <ul className="space-y-3">
        {postings?.map((posting) => (
          <li key={posting.id}>
            <Link to={`/postings/${posting.id}`} className="block">
              <Card className="transition-colors hover:border-slate-400">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-medium text-slate-900">
                      {posting.title ?? 'Untitled posting'}
                    </h2>
                    {posting.company && <p className="text-sm text-slate-600">{posting.company}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {posting.application && (
                      <Badge tone={applicationStatusTone[posting.application.status]}>
                        {toTitleCase(posting.application.status)}
                      </Badge>
                    )}
                    <Badge tone={analysisStatusTone[posting.analysisStatus]}>
                      {analysisStatusLabel[posting.analysisStatus]}
                    </Badge>
                  </div>
                </div>

                {/* Before analysis there's no title, so show the start of the pasted text. */}
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{posting.preview}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Added {formatTimestamp(posting.createdAt)}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
