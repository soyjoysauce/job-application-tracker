// Client test setup: unmount React trees between tests, and provide the env vars
// that lib/supabase.ts reads at import time.
// jest-dom adds DOM matchers such as toHaveValue and toHaveTextContent.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('VITE_API_URL', 'http://localhost:3001');

afterEach(() => {
  cleanup();
});
