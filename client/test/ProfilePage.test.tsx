// Profile page: loads, saves, and shows what the server stored.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const put = vi.fn();
vi.mock('../src/lib/api', () => ({ api: { get, put } }));

const { default: ProfilePage } = await import('../src/pages/ProfilePage');

beforeEach(() => {
  get.mockReset();
  put.mockReset();
});

describe('ProfilePage', () => {
  it('shows the saved skills and stack once loaded', async () => {
    get.mockResolvedValue({ skills: ['React', 'TypeScript'], stack: ['Node'], updatedAt: null });

    render(<ProfilePage />);

    expect(await screen.findByLabelText('Skills')).toHaveValue('React, TypeScript');
    expect(screen.getByLabelText('Stack')).toHaveValue('Node');
  });

  it('sends comma-separated text as a trimmed list, and shows what came back', async () => {
    get.mockResolvedValue({ skills: [], stack: [], updatedAt: null });
    put.mockResolvedValue({
      skills: ['React'],
      stack: ['Node'],
      updatedAt: '2026-09-20T00:00:00Z',
    });
    const user = userEvent.setup();

    render(<ProfilePage />);
    await user.type(await screen.findByLabelText('Skills'), '  React , react ');
    await user.type(screen.getByLabelText('Stack'), 'Node');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    // Blank entries removed and whitespace trimmed before sending.
    expect(put).toHaveBeenCalledWith('/api/profile', {
      skills: ['React', 'react'],
      stack: ['Node'],
    });
    // The server de-duplicates, so the form shows the stored result.
    expect(await screen.findByText('Saved')).toBeDefined();
    expect(screen.getByLabelText('Skills')).toHaveValue('React');
  });

  it('shows an error when saving fails, and keeps what you typed', async () => {
    get.mockResolvedValue({ skills: [], stack: [], updatedAt: null });
    put.mockRejectedValue(new Error('Request failed (500)'));
    const user = userEvent.setup();

    render(<ProfilePage />);
    await user.type(await screen.findByLabelText('Skills'), 'React');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)');
    expect(screen.getByLabelText('Skills')).toHaveValue('React');
  });

  it('shows the load error instead of an empty form', async () => {
    get.mockRejectedValue(new Error('You are signed out. Please sign in again.'));

    render(<ProfilePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('signed out');
  });
});
