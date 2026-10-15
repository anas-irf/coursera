// The build-time settings the app reads (see `.env.example`).  `NODE_ENV` and `PUBLIC_URL` are
// declared by react-scripts; both of these are optional because `shared/config.ts` has defaults.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_API_URL?: string;
    readonly REACT_APP_WS_URL?: string;
  }
}
