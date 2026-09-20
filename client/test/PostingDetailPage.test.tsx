// Posting detail: the Analyze button, the results it shows, and the delete warning.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('../src/lib/api', () => ({ api: { get, post, delete: vi.fn() } }));

const { default: PostingDetailPage } = await import('../src/pages/PostingDetailPage');

const POSTING_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

const unanalyzed = {
  id: POSTING_ID,
  rawText: 'Senior Frontend Engineer at Northwind',
  extracted: null,
  gapAnalysis: null,
  analysisStatus: 'pending',
  createdAt: '2026-09-20T10:00:00Z',
  updatedAt: '2026-09-20T10:00:00Z',
  application: null,
};

const analyzed = {
  ...unanalyzed,
  analysisStatus: 'completed',
  extracted: {
    title: 'Senior Frontend Engineer',
    company: 'Northwind',
    requiredSkills: ['React', 'TypeScript'],
    niceToHaveSkills: ['GraphQL'],
    stack: ['React'],
    seniority: 'Senior',
    salaryRange: { min: 95000, max: 120000, currency: 'EUR' },
  },
  gapAnalysis: {
    matchedSkills: ['React'],
    missingSkills: ['TypeScript'],
    matchedNiceToHave: [],
    overallFit: 'moderate',
    summary: 'Strong on React; TypeScript is the main gap.',
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/postings/${POSTING_ID}`]}>
      <Routes>
        <Route path="/postings/:id" element={<PostingDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('PostingDetailPage', () => {
  it('offers analysis and shows how much quota is left', async () => {
    get.mockImplementation((path: string) =>
      path === '/api/usage'
        ? Promise.resolve({ used: 3, limit: 20, remaining: 17, resetAt: '2026-09-21T00:00:00Z' })
        : Promise.resolve(unanalyzed),
    );

    renderPage();

    expect(await screen.findByRole('button', { name: 'Analyze with Claude' })).toBeInTheDocument();
    expect(await screen.findByText('17 of 20 analyses left today')).toBeInTheDocument();
  });

  it('runs the analysis and shows the results', async () => {
    let posting: unknown = unanalyzed;
    get.mockImplementation((path: string) =>
      path === '/api/usage'
        ? Promise.resolve({ used: 3, limit: 20, remaining: 17, resetAt: '2026-09-21T00:00:00Z' })
        : Promise.resolve(posting),
    );
    post.mockImplementation(() => {
      posting = analyzed; // the server saved the analysis
      return Promise.resolve(analyzed);
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Analyze with Claude' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/api/postings/${POSTING_ID}/analyze`, {}),
    );
    expect(await screen.findByText('How you compare')).toBeInTheDocument();
    expect(screen.getByText('Strong on React; TypeScript is the main gap.')).toBeInTheDocument();
    expect(screen.getByText('Partial match')).toBeInTheDocument();
    // Salary is shown only because the posting stated one.
    expect(screen.getByText('EUR 95,000 – 120,000')).toBeInTheDocument();
  });

  it('shows the daily limit message when the quota is used up', async () => {
    get.mockImplementation((path: string) =>
      path === '/api/usage'
        ? Promise.resolve({ used: 20, limit: 20, remaining: 0, resetAt: '2026-09-21T00:00:00Z' })
        : Promise.resolve(unanalyzed),
    );
    post.mockRejectedValue(
      new Error('Daily limit of 20 requests reached. Try again after the reset.'),
    );
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Analyze with Claude' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Daily limit of 20 requests');
  });

  it('says a posting with no stated salary is "Not listed"', async () => {
    get.mockResolvedValue({
      ...analyzed,
      extracted: { ...analyzed.extracted, salaryRange: null },
    });

    renderPage();

    expect(await screen.findByText('Not listed')).toBeInTheDocument();
  });

  it('warns that deleting the posting also deletes its application', async () => {
    get.mockResolvedValue({ ...analyzed, application: { id: 'app-1', status: 'applied' } });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete posting' }));

    expect(
      screen.getByText('This also deletes the application you are tracking for it.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, delete it' })).toBeInTheDocument();
  });
});
