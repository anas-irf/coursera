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
// `pnpm run build` otherwise.  Only development and the tests fall back to a
// local backend.  A path ("/api/v1") means the API is served by the same site
// as the app (one origin behind a proxy): requests, media and WebSockets then
// go to the page's own host.
const LOCAL_API_URL = 'http://localhost:8000/api/v1';
const configured = process.env.REACT_APP_API_URL;

// REST API, e.g. http://localhost:8000/api/v1, or /api/v1 on the app's own site
export const API_URL: string = trimTrailingSlash(
  configured || (process.env.NODE_ENV === 'production' ? '' : LOCAL_API_URL)
);

// Where the backend serves media files and WebSockets from ('' for the app's own site)
export const API_ORIGIN: string = originOf(API_URL);

/** The WebSocket origin of a page: ws://host or wss://host, as the page itself is served. */
export const pageSocketOrigin = (location: Pick<Location, 'protocol' | 'host'>): string =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;

// WebSocket base, e.g. ws://localhost:8000; derived from the API, or from the page when the
// API is on the same site
export const WS_URL: string = trimTrailingSlash(
  process.env.REACT_APP_WS_URL ||
    (API_ORIGIN ? API_ORIGIN.replace(/^http/, 'ws') : typeof window !== 'undefined' ? pageSocketOrigin(window.location) : '')
);
