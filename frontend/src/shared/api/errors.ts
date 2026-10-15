// Turn an axios error into a message for the user.
//
// The backend answers with {"error": "..."} for domain errors, DRF with
// {"detail": "..."} and serializers with {"field": ["message", ...]}.
//
// Everything here takes ``unknown``: a failure reaches these helpers from a ``catch`` block, from
// a query's ``error`` or from a test double, and what they read of it is only ``response`` and
// ``message``.
import type { ApiErrorBody } from '../types';

/** What the helpers read of a failure: an axios error, or anything shaped like one. */
interface FailureLike {
  message?: unknown;
  response?: { status?: number; data?: unknown } | null;
}

const failureOf = (error: unknown): FailureLike | null =>
  typeof error === 'object' && error !== null ? (error as FailureLike) : null;

const dataOf = (error: unknown): unknown => failureOf(error)?.response?.data;

/** The body of an answer when it is an object (``null`` for text, nothing or no answer). */
const objectBodyOf = (error: unknown): ApiErrorBody | null => {
  const data = dataOf(error);
  return data && typeof data === 'object' ? (data as ApiErrorBody) : null;
};

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const failure = failureOf(error);
  const data = dataOf(error);

  if (!failure || !failure.response) {
    return failure?.message === 'Network Error'
      ? 'Network error. Please check your connection.'
      : fallback;
  }
  if (typeof data === 'string' && data && !data.startsWith('<')) return data;
  const body = objectBodyOf(error);
  if (body) {
    if (typeof body.error === 'string') return body.error;
    if (typeof body.detail === 'string') return body.detail;
    if (typeof body.message === 'string') return body.message;
    const first: unknown = Object.values(body).find((value) => value);
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    if (typeof first === 'string') return first;
  }
  return fallback;
}

/**
 * Every problem of a form response in one sentence ("title: This field is required. slug: ..."),
 * for forms whose fields the user cannot all see at once; other errors read like errorMessage.
 */
export function errorSummary(error: unknown, fallback?: string): string {
  const body = objectBodyOf(error);
  const isFieldMap =
    body &&
    !Array.isArray(body) &&
    typeof body.error !== 'string' &&
    typeof body.detail !== 'string' &&
    typeof body.message !== 'string';

  if (body && isFieldMap) {
    const parts = Object.entries(body)
      .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : typeof value === 'string'))
      .map(([field, value]) => {
        const text = `${field}: ${Array.isArray(value) ? value.join(', ') : String(value)}`;
        return /[.!?]$/.test(text) ? text : `${text}.`;
      });
    if (parts.length > 0) return parts.join(' ');
  }
  return errorMessage(error, fallback);
}

/** The stable machine-readable `code` of an error response ("time_limit_exceeded"), else `null`. */
export function errorCode(error: unknown): string | null {
  const body = objectBodyOf(error);
  return body && typeof body.code === 'string' ? body.code : null;
}

/** The HTTP status of an error response; ``undefined`` when there was no answer at all. */
export function errorStatus(error: unknown): number | undefined {
  return failureOf(error)?.response?.status;
}

/** Field errors of a serializer response: {email: "..."} (first message per field). */
export function fieldErrors(error: unknown): Record<string, string> {
  const body = objectBodyOf(error);
  const out: Record<string, string> = {};
  if (body && !Array.isArray(body)) {
    Object.entries(body).forEach(([field, value]) => {
      if (Array.isArray(value) && typeof value[0] === 'string') out[field] = value[0];
    });
  }
  return out;
}
