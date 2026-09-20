// Formatting helpers shared by the posting and application pages.
import type { AnalysisStatus, ApplicationStatus } from '@jat/shared';

import type { BadgeTone } from '../components/ui';

const DATE_FORMAT = { day: 'numeric', month: 'short', year: 'numeric' } as const;

/**
 * A real moment in time (createdAt, updatedAt) shown in the viewer's local timezone.
 * "2026-09-16T10:30:00Z" -> "Sep 16, 2026" locally.
 */
export function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, DATE_FORMAT);
}

/**
 * A calendar date (appliedAt: "the day I applied"), stored as midnight UTC.
 * Formatted in UTC so it always shows the day that was picked — using local time
 * would show the previous day for viewers behind UTC.
 */
export function formatCalendarDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, { ...DATE_FORMAT, timeZone: 'UTC' });
}

/**
 * API timestamp -> value for <input type="date">.
 * Takes the date part of the text as-is: converting via Date() could shift the
 * day by one in timezones behind/ahead of UTC.
 */
export function toDateInputValue(isoString: string | null): string {
  return isoString ? isoString.slice(0, 10) : '';
}

/** <input type="date"> value -> API timestamp (midnight UTC), or null when cleared. */
export function fromDateInputValue(value: string): string | null {
  return value ? `${value}T00:00:00Z` : null;
}

/** "interviewing" -> "Interviewing" */
export function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const applicationStatusTone: Record<ApplicationStatus, BadgeTone> = {
  saved: 'gray',
  applied: 'blue',
  interviewing: 'amber',
  offer: 'green',
  rejected: 'red',
  withdrawn: 'gray',
};

export const analysisStatusTone: Record<AnalysisStatus, BadgeTone> = {
  pending: 'gray',
  processing: 'blue',
  completed: 'green',
  failed: 'red',
};

/** Wording for the analysis badge; the analyzer itself arrives in step 8. */
export const analysisStatusLabel: Record<AnalysisStatus, string> = {
  pending: 'Not analyzed yet',
  processing: 'Analyzing…',
  completed: 'Analyzed',
  failed: 'Analysis failed',
};
