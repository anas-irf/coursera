// Runtime configuration. Create React App inlines REACT_APP_* variables at build time.
const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const originOf = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch (error) {
    return '';
  }
};

// A production build must say where its API is: scripts/require-env.js stops
// `npm run build` otherwise.  Only development and the tests fall back to a
// local backend.
const LOCAL_API_URL = 'http://localhost:8000/api/v1';
const configured = process.env.REACT_APP_API_URL;

// REST API, e.g. http://localhost:8000/api/v1
export const API_URL: string = trimTrailingSlash(
  configured || (process.env.NODE_ENV === 'production' ? '' : LOCAL_API_URL)
);

// Where the backend serves media files and WebSockets from
export const API_ORIGIN: string = originOf(API_URL);

// WebSocket base, e.g. ws://localhost:8000
export const WS_URL: string = trimTrailingSlash(
  process.env.REACT_APP_WS_URL || API_ORIGIN.replace(/^http/, 'ws')
);
