// Loads data from the API and tracks loading/error state.
// Plain useState + useEffect (no query library) — the same pattern pages would write by hand.
import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';

export interface ApiQuery<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  /** Fetches again — call after creating, updating, or deleting something. */
  reload: () => void;
}

interface Result<T> {
  /** Which request this result belongs to (path + reload count). */
  key: string;
  data?: T;
  error?: string;
}

export function useApiQuery<T>(path: string): ApiQuery<T> {
  // Bumping this number changes the key below, which re-runs the fetch.
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T>>();

  const key = `${path}#${attempt}`;
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false; // Ignore the response if the path changes or the page unmounts.

    api
      .get<T>(path)
      .then((data) => {
        if (!cancelled) setResult({ key, data });
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setResult({ key, error: caught instanceof Error ? caught.message : 'Failed to load' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, key]);

  // Derived, not stored: we're loading until the stored result matches the current key.
  // (Deriving avoids calling setState inside the effect, which causes an extra render.)
  const settled = result?.key === key ? result : undefined;

  return {
    data: settled?.data,
    loading: settled === undefined,
    error: settled?.error,
    reload,
  };
}
