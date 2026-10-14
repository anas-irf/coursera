// Runtime configuration. Create React App inlines REACT_APP_* variables at build time.
const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch (error) {
    return '';
  }
};

// A production build must say where its API is: scripts/require-env.js stops
// `npm run build` otherwise.  Only development and the tests fall back to a
// local backend.
const LOCAL_API_URL = 'http://localhost:8000/api';
const configured = process.env.REACT_APP_API_URL;

// REST API, e.g. http://localhost:8000/api
export const API_URL = trimTrailingSlash(
  configured || (process.env.NODE_ENV === 'production' ? '' : LOCAL_API_URL)
);

// Where the backend serves media files and WebSockets from
export const API_ORIGIN = originOf(API_URL);

// WebSocket base, e.g. ws://localhost:8000
export const WS_URL = trimTrailingSlash(
  process.env.REACT_APP_WS_URL || API_ORIGIN.replace(/^http/, 'ws')
);
