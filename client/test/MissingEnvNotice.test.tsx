// A build without its environment variables must say so, not render a blank page.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MissingEnvNotice } from '../src/components/MissingEnvNotice';

describe('MissingEnvNotice', () => {
  it('names every missing variable', () => {
    render(<MissingEnvNotice missing={['VITE_SUPABASE_URL', 'VITE_API_URL']} />);

    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument();
    expect(screen.getByText('VITE_API_URL')).toBeInTheDocument();
    expect(screen.getByText('Configuration missing')).toBeInTheDocument();
  });

  it('explains that a rebuild is needed, not a restart', () => {
    render(<MissingEnvNotice missing={['VITE_API_URL']} />);

    expect(screen.getByText(/baked in at build time/)).toBeInTheDocument();
  });
});
