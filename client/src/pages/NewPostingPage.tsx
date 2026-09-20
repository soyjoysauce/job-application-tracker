// Paste a job posting's text. Postings are read-only afterwards (ADR-009).
import { RAW_TEXT_MAX_LENGTH, type JobPosting } from '@jat/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button, Card, ErrorText, Label, Textarea } from '../components/ui';
import { api } from '../lib/api';

export default function NewPostingPage() {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const posting = await api.post<JobPosting>('/api/postings', { rawText });
      void navigate(`/postings/${posting.id}`, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save posting');
      setSaving(false);
    }
  }

  const tooLong = rawText.length > RAW_TEXT_MAX_LENGTH;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Paste a job posting</h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste the posting text. It can't be edited afterwards — delete and paste again to change
          it.
        </p>
      </div>

      <Card>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="rawText">Posting text</Label>
            <Textarea
              id="rawText"
              rows={14}
              required
              value={rawText}
              placeholder="Senior Frontend Engineer at…"
              onChange={(event) => setRawText(event.target.value)}
            />
            <p className={`text-xs ${tooLong ? 'text-red-600' : 'text-slate-500'}`}>
              {rawText.length.toLocaleString()} / {RAW_TEXT_MAX_LENGTH.toLocaleString()} characters
            </p>
          </div>

          <ErrorText>{error}</ErrorText>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving || tooLong || rawText.trim().length === 0}>
              {saving ? 'Saving…' : 'Save posting'}
            </Button>
            <Link to="/postings" className="text-sm text-slate-600 underline">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
