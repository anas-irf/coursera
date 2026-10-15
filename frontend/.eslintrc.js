// Create React App lint rules plus the module boundaries of the project:
//
//   shared/    knows nothing about features or the app shell
//   features/  never import the app shell, and one feature reaches another only
//              through its index.js (the public surface), in the directions below
//   app/       wires the features together
//
// and one rule about what a screen may touch:
//
//   pages/ and components/ read and write through the hooks of their feature
//   (features/<name>/hooks), never through api.js.  The hooks own the query keys,
//   what is refreshed after a change and how a failure is reported, so a screen
//   cannot forget them.
//
// The directions mirror the backend slices: a feature may use the ones listed
// for it and nothing else.
const FEATURE_DEPENDENCIES = {
  accounts: [],
  admin: [],
  assessments: [],
  billing: [],
  certificates: [],
  courses: [],
  insights: ['learning', 'billing'],
  learning: ['assessments'],
  messaging: [],
  notifications: [],
};

const features = Object.keys(FEATURE_DEPENDENCIES);

const featureZones = [];
features.forEach((target) => {
  features
    .filter((other) => other !== target)
    .forEach((other) => {
      const zone = {
        target: `./src/features/${target}`,
        from: `./src/features/${other}`,
      };
      if (FEATURE_DEPENDENCIES[target].includes(other)) {
        zone.except = ['./index.js'];
        zone.message = `Import ${other} through features/${other}/index.js`;
      } else {
        zone.message = `features/${target} must not depend on features/${other}`;
      }
      featureZones.push(zone);
    });
});

const appShellZone = {
  target: './src/features',
  from: './src/app',
  message: 'features must not know the app shell',
};

module.exports = {
  root: true,
  extends: ['react-app', 'react-app/jest'],
  settings: {
    'import/resolver': { node: { extensions: ['.js', '.jsx'] } },
  },
  rules: {
    // errors are shown to the user or reported by the error boundary, not logged and forgotten
    'no-console': 'error',
  },
  overrides: [
    {
      files: ['src/shared/**/*.{js,jsx}'],
      rules: {
        'import/no-restricted-paths': [
          'error',
          {
            zones: [
              { target: './src/shared', from: './src/features', message: 'shared/ must not know features' },
              { target: './src/shared', from: './src/app', message: 'shared/ must not know the app shell' },
            ],
          },
        ],
      },
    },
    {
      files: ['src/features/**/*.{js,jsx}'],
      rules: {
        'import/no-restricted-paths': ['error', { zones: [appShellZone, ...featureZones] }],
      },
    },
    {
      // screens: the zones above (a rule's options are replaced, not merged) plus the api.js rule
      files: ['src/features/*/pages/**/*.{js,jsx}', 'src/features/*/components/**/*.{js,jsx}'],
      excludedFiles: ['**/*.test.{js,jsx}'],
      rules: {
        'import/no-restricted-paths': [
          'error',
          {
            zones: [
              appShellZone,
              ...featureZones,
              {
                target: './src/features',
                from: './src/features/*/api.js',
                message: 'Screens go through the hooks of their feature (hooks/), not through api.js',
              },
            ],
          },
        ],
      },
    },
  ],
};
