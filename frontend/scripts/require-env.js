// Runs before `npm run build` (the npm "prebuild" script).
//
// A production build bakes the API address into the bundle, so a build without
// REACT_APP_API_URL would ship an app that talks to localhost.  The variable
// may come from the environment or from frontend/.env.production (or .env).
process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'production';

// loads the .env files exactly like Create React App does for a build
require('react-scripts/config/env');

if (!process.env.REACT_APP_API_URL) {
  console.error(
    '\nREACT_APP_API_URL is not set.\n' +
      'A production build bakes the API address into the bundle. Set it in the environment or in\n' +
      'frontend/.env.production, for example: REACT_APP_API_URL=https://api.example.com/api\n'
  );
  process.exit(1);
}
