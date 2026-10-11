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
