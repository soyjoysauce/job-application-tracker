// Sign in / sign up. One form; a link switches between the two modes.
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { Button, Card, ErrorText, Input, Label } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

export default function SignInPage() {
  const { session, loading, signIn, signUp } = useAuth();
  const location = useLocation();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Where to go after signing in: back where the user was headed, or the profile.
  const from = (location.state as { from?: string } | null)?.from ?? '/profile';

  if (loading) return null;
  if (session) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setInfo(undefined);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        // No redirect needed: the session updates, and the <Navigate> above takes over.
      } else {
        const { needsEmailConfirmation } = await signUp(email, password);
        if (needsEmailConfirmation) {
          setInfo(`Account created. Check ${email} for a confirmation link, then sign in.`);
          setMode('signin');
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-slate-900">
          Job Application Tracker
        </h1>
        <Card>
          <h2 className="mb-4 text-lg font-medium">
            {mode === 'signin' ? 'Sign in' : 'Create an account'}
          </h2>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <ErrorText>{error}</ErrorText>
            {info && <p className="text-sm text-slate-600">{info}</p>}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              className="font-medium text-slate-900 underline"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(undefined);
                setInfo(undefined);
              }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
