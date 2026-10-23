# Frontend

React 19 single page application (Create React App, TypeScript) for the platform in the repository root.

```bash
cp .env.example .env     # REACT_APP_API_URL
corepack enable          # once: pnpm in the version package.json names (or: npm install -g pnpm@10)
pnpm install
pnpm start               # http://localhost:3000
pnpm run typecheck       # tsc --noEmit: strict, the tests included
pnpm test --watchAll=false
REACT_APP_API_URL=http://localhost:8000/api/v1 pnpm run build   # a production build needs the API address
```

Layout and rules are described in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#frontend) and
[`../docs/CONVENTIONS.md`](../docs/CONVENTIONS.md):
`src/app` wires the features into layouts and routes, `src/shared` holds the HTTP client, the
session, the query cache and the UI kit, `src/features/<slice>` holds the `api.ts` of one slice, its
`types.ts`, its `hooks/` (TanStack Query), `lib/` (pure rules), pages and components. Module boundaries and
"screens use hooks, not `api.ts`" are checked by ESLint (`.eslintrc.js`); the types by `pnpm run typecheck`.

The look is one design system ([`../docs/DESIGN.md`](../docs/DESIGN.md)): colour tokens in `src/index.css`
(a light and a dark set) mapped to class names in `tailwind.config.js`, the components of `src/shared/ui`, the
Inter typeface (`@fontsource-variable/inter`, bundled: no request to a font service), and a theme the user picks
(light, dark or the system's). `public/` holds the icons and the manifest of the brand.

Dependencies are installed with pnpm (`pnpm-lock.yaml`); the version is the `packageManager` field of
`package.json`. Everything a module imports is declared in `package.json` (pnpm does not let a package see
what only a dependency of a dependency brings), which is why `eslint`, `eslint-config-react-app` and
`react-router` are listed although `react-scripts` pulls them in.
