// Daily Claude usage for the signed-in user (GET /api/usage).
export interface UsageStatus {
  /** Requests used in the current window, clamped to `limit`. */
  used: number;
  /** Requests allowed per day (server setting DAILY_CLAUDE_LIMIT). */
  limit: number;
  remaining: number;
  /** When the window resets: the next UTC midnight, as an ISO timestamp. */
  resetAt: string;
}
