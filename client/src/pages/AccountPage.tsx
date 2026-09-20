// Account details and permanent deletion.
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button, Card, ErrorText, Input, Label } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

const CONFIRM_WORD = 'DELETE';

export default function AccountPage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  async function handleDelete() {
    setDeleting(true);
    setError(undefined);
    try {
      await api.delete('/api/account');
      // The account is gone; drop the local session so no stale token is kept.
      await signOut();
      void navigate('/signin', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete account');
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Account</h1>

      <Card>
        <h2 className="text-sm font-medium text-slate-700">Signed in as</h2>
        <p className="mt-1 text-slate-900">{session?.user.email}</p>
      </Card>

      <Card className="border-red-200">
        <h2 className="text-sm font-medium text-red-700">Delete account</h2>
        <p className="mt-1 text-sm text-slate-600">
          This permanently deletes your account and all of your data: profile, job postings, and
          applications. This cannot be undone.
        </p>

        <div className="mt-4 space-y-2">
          <Label htmlFor="confirm">
            Type <span className="font-mono">{CONFIRM_WORD}</span> to confirm
          </Label>
          <Input
            id="confirm"
            value={confirmation}
            autoComplete="off"
            onChange={(event) => setConfirmation(event.target.value)}
            className="max-w-xs"
          />
          <ErrorText>{error}</ErrorText>
          <Button
            variant="danger"
            disabled={confirmation !== CONFIRM_WORD || deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
