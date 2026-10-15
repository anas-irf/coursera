/**
 * What a date helper is given: an API timestamp, normally.  A missing one is not rejected (it
 * reads as the epoch or "Invalid Date", as ``new Date(...)`` does), so the nullable fields of a
 * record can be passed as they are.
 */
export type DateInput = string | number | Date | null | undefined;

const toDate = (value: DateInput): Date => new Date(value as string | number | Date);

/** "Just now", "5m ago", "3h ago", "2d ago", else the date. */
export function timeAgo(dateString: DateInput, now: Date = new Date()): string {
  const date = toDate(dateString);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/** "Oct 12, 2026". */
export function formatDate(dateString: DateInput): string {
  return toDate(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "Oct 12, 2026, 09:30 AM". */
export function formatDateTime(dateString: DateInput): string {
  return toDate(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A length of time as a clock: 272 -> "4:32", 3723 -> "1:02:03" (negative and missing count as 0). */
export function formatClock(totalSeconds: unknown): string {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
