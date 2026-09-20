// Skills profile: what the analyzer compares job postings against (step 8).
import type { Profile } from '@jat/shared';
import { useEffect, useState, type FormEvent } from 'react';

import { Button, Card, ErrorText, Input, Label } from '../components/ui';
import { api } from '../lib/api';

/** "React, TypeScript ,, node" -> ["React", "TypeScript", "node"] */
function toList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const [skills, setSkills] = useState('');
  const [stack, setStack] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  // Load the profile once, when the page opens.
  useEffect(() => {
    let cancelled = false; // Ignore the response if the user navigates away first.
    api
      .get<Profile>('/api/profile')
      .then((profile) => {
        if (cancelled) return;
        setSkills(profile.skills.join(', '));
        setStack(profile.stack.join(', '));
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      // The server trims and de-duplicates, so show what it actually stored.
      const profile = await api.put<Profile>('/api/profile', {
        skills: toList(skills),
        stack: toList(stack),
      });
      setSkills(profile.skills.join(', '));
      setStack(profile.stack.join(', '));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Your profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Job postings you paste are compared against these lists.
        </p>
      </div>

      <Card>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="skills">Skills</Label>
            <Input
              id="skills"
              value={skills}
              placeholder="React, TypeScript, SQL"
              onChange={(event) => {
                setSkills(event.target.value);
                setSaved(false);
              }}
            />
            <p className="text-xs text-slate-500">Separate with commas.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="stack">Stack</Label>
            <Input
              id="stack"
              value={stack}
              placeholder="Node, Postgres, Docker"
              onChange={(event) => {
                setStack(event.target.value);
                setSaved(false);
              }}
            />
            <p className="text-xs text-slate-500">Tools and technologies you work with.</p>
          </div>

          <ErrorText>{error}</ErrorText>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
            {saved && <span className="text-sm text-green-700">Saved</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
