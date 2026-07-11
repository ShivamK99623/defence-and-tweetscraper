export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 100;
export const SEARCH_DEBOUNCE_MS = 400;

/** Trim and cap length — no minimum length (used by API/SQL). */
export function sanitizeSearchQuery(
  value: string | undefined | null
): string | undefined {
  if (value === null || value === undefined) return undefined;

  const trimmed = value.trim().slice(0, MAX_SEARCH_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Frontend gate: only fire API calls after debounce when query is long enough. */
export function isSearchReadyForQuery(
  value: string | undefined | null
): boolean {
  const sanitized = sanitizeSearchQuery(value);
  return Boolean(sanitized && sanitized.length >= MIN_SEARCH_LENGTH);
}

/** Escape LIKE wildcards and wrap for SQLite `... LIKE ? ESCAPE '\\'`. */
export function toSqlLikePattern(query: string): string {
  const escaped = query.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  return `%${escaped.toLowerCase()}%`;
}

export function matchesSearchQuery(
  record: {
    heading?: string;
    summary?: string;
    content?: string;
    publication?: string;
    author?: string;
    website?: string;
    channelName?: string;
    handleName?: string;
  },
  query: string
): boolean {
  const q = query.toLowerCase();
  return (
    record.heading?.toLowerCase().includes(q) ||
    record.summary?.toLowerCase().includes(q) ||
    record.content?.toLowerCase().includes(q) ||
    record.publication?.toLowerCase().includes(q) ||
    record.author?.toLowerCase().includes(q) ||
    record.website?.toLowerCase().includes(q) ||
    record.channelName?.toLowerCase().includes(q) ||
    record.handleName?.toLowerCase().includes(q) ||
    false
  );
}
