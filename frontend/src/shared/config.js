// Runtime configuration. Create React App inlines REACT_APP_* variables at build time.
const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch (error) {
    return '';
  }
};

// REST API, e.g. http://localhost:8000/api
export const API_URL = trimTrailingSlash(process.env.REACT_APP_API_URL || 'http://localhost:8000/api');

// Where the backend serves media files and WebSockets from
export const API_ORIGIN = originOf(API_URL);

// WebSocket base, e.g. ws://localhost:8000
export const WS_URL = trimTrailingSlash(
  process.env.REACT_APP_WS_URL || API_ORIGIN.replace(/^http/, 'ws')
);
