// Create React App lint rules plus the module boundaries of the project:
//
//   shared/    knows nothing about features or the app shell
//   features/  never import the app shell, and one feature reaches another only
//              through its index.js (the public surface), in the directions below
//   app/       wires the features together
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

module.exports = {
  root: true,
  extends: ['react-app', 'react-app/jest'],
  settings: {
    'import/resolver': { node: { extensions: ['.js', '.jsx'] } },
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
        'import/no-restricted-paths': [
          'error',
          {
            zones: [
              { target: './src/features', from: './src/app', message: 'features must not know the app shell' },
              ...featureZones,
            ],
          },
        ],
      },
    },
  ],
};
