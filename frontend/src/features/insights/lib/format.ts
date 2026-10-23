/**
 * How the insights pages write their figures.  A figure that could not be loaded, or that has
 * nothing to be computed from (a rate of no enrollments, the rating of a course nobody rated), is
 * a dash: never a zero that nothing measured.
 */
export const NOT_LOADED = '-';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Hours with one decimal ("0.3", "12.5", "5"): twenty minutes of study must not read as zero. */
export const hours = (value: number | null | undefined): number => Number((Number(value) || 0).toFixed(1));

/** "40%", "16.7%", or the dash for nothing to compute. */
export const percent = (value: number | null | undefined): string =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? NOT_LOADED : `${Number(Number(value).toFixed(1))}%`;

/** "4.6", or the dash while nothing is rated (reviews do not exist yet, so a rating may be 0). */
export const rating = (value: number | null | undefined): string =>
  value && value > 0 ? Number(value).toFixed(1) : NOT_LOADED;

/** "2026-10-01" -> "Oct 1", read from the text so that no time zone moves the day. */
export function shortDay(isoDate: string): string {
  const [, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return month && day ? `${MONTHS[month - 1]} ${day}` : isoDate;
}

/** The share of ``part`` in ``total`` as a whole percentage (0 for an empty total). */
export const shareOf = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

/** "$1.2k" for a chart axis: money without cents, thousands shortened. */
export function compactMoney(value: number): string {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1000) return `$${Number((amount / 1000).toFixed(1))}k`;
  return `$${Math.round(amount)}`;
}
