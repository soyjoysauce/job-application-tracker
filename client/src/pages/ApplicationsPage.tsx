// Application tracker: every application, filterable by status, with inline status changes.
import {
  applicationStatusSchema,
  type ApplicationStatus,
  type ApplicationWithPosting,
} from '@jat/shared';
import { useState } from 'react';
import { Link } from 'react-router';

import { Badge, Button, Card, ErrorText, Label, Select } from '../components/ui';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../lib/api';
import { applicationStatusTone, formatCalendarDate, toTitleCase } from '../lib/format';

const STATUS_OPTIONS = applicationStatusSchema.options;

export default function ApplicationsPage() {
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  // Changing the path makes useApiQuery fetch again with the filter applied.
  const path = filter === 'all' ? '/api/applications' : `/api/applications?status=${filter}`;
  const {
    data: applications,
    loading,
    error,
    reload,
  } = useApiQuery<ApplicationWithPosting[]>(path);

  const [rowError, setRowError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  async function changeStatus(id: string, status: ApplicationStatus) {
    setBusyId(id);
    setRowError(undefined);
    try {
      await api.patch(`/api/applications/${id}`, { status });
      reload();
    } catch (caught) {
      setRowError(caught instanceof Error ? caught.message : 'Failed to update');
    } finally {
      setBusyId(undefined);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    setRowError(undefined);
    try {
      await api.delete(`/api/applications/${id}`);
      reload();
    } catch (caught) {
      setRowError(caught instanceof Error ? caught.message : 'Failed to delete');
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold">Applications</h1>
        <div className="space-y-1">
          <Label htmlFor="filter">Filter by status</Label>
          <Select
            id="filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as ApplicationStatus | 'all')}
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {toTitleCase(option)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}
      <ErrorText>{error ?? rowError}</ErrorText>

      {applications?.length === 0 && (
        <Card>
          <p className="text-sm text-slate-600">
            {filter === 'all' ? (
              <>
                No applications yet. Open a{' '}
                <Link to="/postings" className="font-medium text-slate-900 underline">
                  job posting
                </Link>{' '}
                and choose “Track this application”.
              </>
            ) : (
              `No applications with status “${toTitleCase(filter)}”.`
            )}
          </p>
        </Card>
      )}

      <ul className="space-y-3">
        {applications?.map((application) => (
          <li key={application.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/postings/${application.postingId}`}
                    className="font-medium text-slate-900 underline"
                  >
                    {application.posting.title ?? 'Untitled posting'}
                  </Link>
                  {application.posting.company && (
                    <p className="text-sm text-slate-600">{application.posting.company}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {application.appliedAt
                      ? `Applied ${formatCalendarDate(application.appliedAt)}`
                      : 'No applied date'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={applicationStatusTone[application.status]}>
                    {toTitleCase(application.status)}
                  </Badge>
                  <Select
                    aria-label={`Status for ${application.posting.title ?? 'posting'}`}
                    value={application.status}
                    disabled={busyId === application.id}
                    onChange={(event) =>
                      void changeStatus(application.id, event.target.value as ApplicationStatus)
                    }
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {toTitleCase(option)}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    disabled={busyId === application.id}
                    onClick={() => void remove(application.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {application.notes && (
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">
                  {application.notes}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
