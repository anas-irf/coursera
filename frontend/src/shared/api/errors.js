// Turn an axios error into a message for the user.
//
// The backend answers with {"error": "..."} for domain errors, DRF with
// {"detail": "..."} and serializers with {"field": ["message", ...]}.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error && error.response && error.response.data;

  if (!error || !error.response) {
    return error && error.message === 'Network Error'
      ? 'Network error. Please check your connection.'
      : fallback;
  }
  if (typeof data === 'string' && data && !data.startsWith('<')) return data;
  if (data && typeof data === 'object') {
    if (typeof data.error === 'string') return data.error;
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.message === 'string') return data.message;
    const first = Object.values(data).find((value) => value);
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    if (typeof first === 'string') return first;
  }
  return fallback;
}

/**
 * Every problem of a form response in one sentence ("title: This field is required. slug: ..."),
 * for forms whose fields the user cannot all see at once; other errors read like errorMessage.
 */
export function errorSummary(error, fallback) {
  const data = error && error.response && error.response.data;
  const isFieldMap =
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    typeof data.error !== 'string' &&
    typeof data.detail !== 'string' &&
    typeof data.message !== 'string';

  if (isFieldMap) {
    const parts = Object.entries(data)
      .filter(([, value]) => Array.isArray(value) ? value.length > 0 : typeof value === 'string')
      .map(([field, value]) => {
        const text = `${field}: ${[].concat(value).join(', ')}`;
        return /[.!?]$/.test(text) ? text : `${text}.`;
      });
    if (parts.length > 0) return parts.join(' ');
  }
  return errorMessage(error, fallback);
}

/** The stable machine-readable `code` of an error response ("time_limit_exceeded"), else `null`. */
export function errorCode(error) {
  const data = error && error.response && error.response.data;
  return data && typeof data === 'object' && typeof data.code === 'string' ? data.code : null;
}

/** Field errors of a serializer response: {email: "..."} (first message per field). */
export function fieldErrors(error) {
  const data = error && error.response && error.response.data;
  const out = {};
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.entries(data).forEach(([field, value]) => {
      if (Array.isArray(value) && typeof value[0] === 'string') out[field] = value[0];
    });
  }
  return out;
}
