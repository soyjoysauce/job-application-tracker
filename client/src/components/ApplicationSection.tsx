// The application (tracker entry) attached to a posting: create it, or edit and delete it.
// At most one application per posting (ADR-005).
import {
  applicationStatusSchema,
  type ApplicationStatus,
  type ApplicationWithPosting,
  type JobPosting,
} from '@jat/shared';
import { useState } from 'react';

import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../lib/api';
import { fromDateInputValue, toDateInputValue, toTitleCase } from '../lib/format';
import { Button, Card, ErrorText, Input, Label, Select, Textarea } from './ui';

// The same list the server validates against, so the dropdown can't drift.
const STATUS_OPTIONS = applicationStatusSchema.options;

export function ApplicationSection({
  posting,
  onChanged,
}: {
  posting: JobPosting;
  onChanged: () => void;
}) {
  if (!posting.application) {
    return <CreateApplication postingId={posting.id} onCreated={onChanged} />;
  }
  return <ApplicationEditor applicationId={posting.application.id} onDeleted={onChanged} />;
}

function CreateApplication({ postingId, onCreated }: { postingId: string; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function handleCreate() {
    setBusy(true);
    setError(undefined);
    try {
      await api.post('/api/applications', { postingId });
      onCreated(); // Reload the posting so it now includes the application.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to start tracking');
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-medium">Application</h2>
      <p className="mt-1 text-sm text-slate-600">
        You are not tracking an application for this posting yet.
      </p>
      <ErrorText>{error}</ErrorText>
      <Button className="mt-3" disabled={busy} onClick={() => void handleCreate()}>
        {busy ? 'Starting…' : 'Track this application'}
      </Button>
    </Card>
  );
}

/** Loads the application, then hands it to the form below. */
function ApplicationEditor({
  applicationId,
  onDeleted,
}: {
  applicationId: string;
  onDeleted: () => void;
}) {
  const { data, loading, error } = useApiQuery<ApplicationWithPosting>(
    `/api/applications/${applicationId}`,
  );

  if (loading) return <Card>Loading application…</Card>;
  if (error || !data) {
    return (
      <Card>
        <ErrorText>{error ?? 'Application not found'}</ErrorText>
      </Card>
    );
  }

  // `key` gives a different application a fresh form, so the fields can be
  // initialised straight from props instead of copied in with an effect.
  return <ApplicationForm key={data.id} application={data} onDeleted={onDeleted} />;
}

function ApplicationForm({
  application,
  onDeleted,
}: {
  application: ApplicationWithPosting;
  onDeleted: () => void;
}) {
  const path = `/api/applications/${application.id}`;
  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [appliedAt, setAppliedAt] = useState(toDateInputValue(application.appliedAt));
  const [notes, setNotes] = useState(application.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(undefined);
    try {
      await api.patch(path, {
        status,
        appliedAt: fromDateInputValue(appliedAt),
        notes: notes.trim() === '' ? null : notes,
      });
      setSaved(true);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setSaveError(undefined);
    try {
      await api.delete(path);
      onDeleted(); // Reload the posting; it no longer has an application.
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Failed to delete');
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="font-medium">Application</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            className="w-full"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ApplicationStatus);
              setSaved(false);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {toTitleCase(option)}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="appliedAt">Applied on</Label>
          <Input
            id="appliedAt"
            type="date"
            value={appliedAt}
            onChange={(event) => {
              setAppliedAt(event.target.value);
              setSaved(false);
            }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={4}
          value={notes}
          placeholder="Recruiter name, interview dates, follow-ups…"
          onChange={(event) => {
            setNotes(event.target.value);
            setSaved(false);
          }}
        />
      </div>

      <ErrorText>{saveError}</ErrorText>

      <div className="mt-4 flex items-center gap-3">
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save application'}
        </Button>
        {saved && <span className="text-sm text-green-700">Saved</span>}
        <Button
          variant="secondary"
          className="ml-auto"
          disabled={saving}
          onClick={() => void handleDelete()}
        >
          Stop tracking
        </Button>
      </div>
    </Card>
  );
}
