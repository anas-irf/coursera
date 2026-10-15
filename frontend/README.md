# Frontend

React 19 single page application (Create React App, JavaScript) for the platform in the repository root.

```bash
cp .env.example .env     # REACT_APP_API_URL
npm install
npm start                # http://localhost:3000
npm test -- --watchAll=false
REACT_APP_API_URL=http://localhost:8000/api/v1 npm run build   # a production build needs the API address
```

Layout and rules are described in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#frontend) and
[`../docs/CONVENTIONS.md`](../docs/CONVENTIONS.md):
`src/app` wires the features into layouts and routes, `src/shared` holds the HTTP client, the
session, the query cache and the UI kit, `src/features/<slice>` holds the `api.js` of one slice, its
`hooks/` (TanStack Query), `lib/` (pure rules), pages and components. Module boundaries and "screens use
hooks, not `api.js`" are checked by ESLint (`.eslintrc.js`).
