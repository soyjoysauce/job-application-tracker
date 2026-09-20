// Date and label formatting. The calendar-date test is a regression guard: an applied
// date of the 18th once displayed as the 17th for viewers behind UTC (fixed in step 5b).
import { describe, expect, it } from 'vitest';

import {
  formatCalendarDate,
  fromDateInputValue,
  toDateInputValue,
  toTitleCase,
} from '../src/lib/format';

describe('calendar dates (appliedAt)', () => {
  it('shows the day that was picked, whatever the viewer’s timezone', () => {
    // Stored as midnight UTC; local formatting would roll this back to the 17th
    // anywhere behind UTC.
    expect(formatCalendarDate('2026-09-18T00:00:00Z')).toContain('18');
    expect(formatCalendarDate('2026-01-01T00:00:00Z')).toContain('1');
  });

  it('round-trips through the date input without shifting the day', () => {
    const stored = '2026-09-18T00:00:00Z';

    const forInput = toDateInputValue(stored);
    expect(forInput).toBe('2026-09-18');

    expect(fromDateInputValue(forInput)).toBe('2026-09-18T00:00:00Z');
  });

  it('treats an empty date input as "no date"', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(fromDateInputValue('')).toBeNull();
  });
});

describe('toTitleCase', () => {
  it('capitalises a status for display', () => {
    expect(toTitleCase('interviewing')).toBe('Interviewing');
    expect(toTitleCase('')).toBe('');
  });
});
