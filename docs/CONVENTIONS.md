# Conventions

How code is written here, so that a new module looks like the ones around it. What the tools enforce is
marked **(lint)**, **(contract)** or **(test)**; the rest is review.

## Backend

### Where things go

| What | Where | Rule |
|---|---|---|
| A route and its HTTP adapter | `<slice>/urls.py`, `<slice>/api/` | reads the request, calls a service or a selector, shapes the answer. No rules, no queries beyond fetching the object the URL names. |
| A rule, a write, a use-case | `<slice>/services/` (or `services.py`) | a module of functions named by what they do (`enroll`, `submit_attempt`, `issue_if_eligible`); several rows written together run in `transaction.atomic`; failures are `ServiceError`. |
| A read | `<slice>/selectors/` (or `selectors.py`) | functions that return querysets or plain values; they do not write. A read of another slice's data goes through that slice's selectors. |
| Data | `<slice>/models.py` | fields, constraints, small invariants. `db_table` is set on every model. |
| A reaction to something in another slice | a receiver of a domain event (`apps/core/events.py`) or a registered handler (`courses.extensions`) | never an import of the slice above. |

Services, selectors and models do not import `rest_framework` **(contract)** or `django.http` **(lint,
`TID251`)**; slices depend downwards only **(contract)**, and inside a slice `api -> services -> selectors
-> models` **(contract)**. `lint-imports` and `ruff` run in CI.

### Naming

* **Modules and slices** are nouns (`certificates`, `billing`); a services module holds verbs.
* **Functions** say what happens: `complete_lecture`, `record_watch`, `calculate_month`. A namespace class
  with static methods is a module that has not been written yet: use module-level functions.
* **Rows for the API** are built by plain functions in `api/serializers.py` (`enrolled_course_row`,
  `lecture_row`); a DRF `ModelSerializer` is used where it is also the validator of a write.
* **URL names** are the name of the endpoint (`course-sections`, `record-watch-progress`); the id kwarg of a
  nested route is `<resource>_uuid` (`course_uuid`, `lecture_uuid`). They are invisible on the wire, so a
  rename is free, but `tests/routes.expected.txt` shows it.
* **JSON keys** are `snake_case`, ids are UUID strings, dates are ISO 8601, money is a number of dollars
  with at most two decimals (kept as `Decimal` until it is serialised).

### Errors

* A rule that refuses raises `ServiceError(message, status_code=..., **extra)`; the handler in
  `apps/core/api/errors.py` answers `{"error": message, ...extra}`. A stable machine-readable value goes in
  `code` (`time_limit_exceeded`); the UI shows `error` and may branch on `code`.
* `NotFound` and `PermissionDenied` are `ServiceError`s with their status. DRF's own exceptions keep their
  `{"detail": ...}` and field-map shapes.
* **No blanket `except Exception`.** A failure nobody handles is a bug: it is logged with its traceback and
  the client gets `{"error": ..., "code": "server_error"}` and never the exception text. Catch the specific
  failure you can handle (`StripeError`, `ValidationError`).
* **Input is not trusted.** Query parameters go through `int_param()`, JSON bodies through `object_body()`;
  anything that arrives as JSON strings is parsed and validated before it is used.

### The HTTP contract

* v1 is frozen **(test)**: `tests/openapi.v1.yaml` is the OpenAPI document of `/api/v1/` and
  `tests/test_openapi.py` fails on every difference; `tests/routes.expected.txt` does the same for the route
  table. Adding a path, a method, an optional parameter or a key is a new version of those files in the
  same pull request (`UPDATE_OPENAPI=1`, `UPDATE_ROUTES=1`); removing or retyping one is v2.
* New endpoints declare their permissions explicitly (the default is "authenticated"); the anonymous ones are
  a short list in `tests/test_public_surface.py`.
* A list that can grow is paginated with the opt-in `?page=` / `?page_size=` and answers `X-Total-Count`.

### Documentation

Every module and every top-level class has a docstring **(lint, `D100`, `D101`)** that says what it is for,
not how it is written. A model's says what one row is. A non-obvious rule gets its *why* in a comment next to
it. Behaviour that other people configure is listed in `backend/.env.example` **(test)**.

### Tests

* HTTP-level tests use literal URLs and the factories in `tests/factories.py`; a bug is fixed together with the
  test that shows it.
* Time, money and randomness that a test depends on are passed in or frozen, never waited for.
* A change to a rule has a unit test of the service; a change to what the endpoint answers has a test of
  the endpoint.

## Frontend

### Where things go

```
src/features/<slice>/
  api.ts         the requests of the slice: one function per endpoint, returns the typed response data
  types.ts       the shapes the slice's API answers and its hooks hand out
  hooks/         queries and mutations (TanStack Query) and the state hooks of the slice
  lib/           pure functions: rules, formatting, validation (unit-tested)
  pages/         one component per route
  components/    what pages are made of
  index.ts       what other features and the app shell may import (types with `export type`)
```

* **Screens do not import `api.ts`** **(lint)**. `pages/` and `components/` use the hooks of their feature,
  which own the query keys, what a change refreshes and how a failure is reported.
* **Features reach each other only through `index.ts`**, in the direction the backend slices have
  **(lint)**. `shared/` knows neither features nor the app shell **(lint)**.
* **No `console`** **(lint)**: a failure is shown to the user (`ErrorState`, a toast) or handled.

### Server state

* One cache (`shared/query`). Keys are `[feature, resource, params]`; a mutation invalidates by prefix
  (`['learning']`), so every screen that shows the thing changes together. The same cache entry serves
  everybody who needs the same data (the sidebar badge and the approval queue are one query).
* A hook returns what the screen needs, not the transport: `useSubscription()` answers
  `{plan, isPlus, willRenew, accessUntil}`, "is this student a member" is defined once.
* **Best-effort writes are marked as such** (the watch heartbeat); every other failure is reported with the
  server's message (`errorMessage(err, fallback)`).

### States and copy

* **A failed request is not an empty list.** Every screen that loads data shows three states: a spinner, an
  `ErrorState` with a retry, and an `EmptyState` that says what to do. A figure that could not be loaded is
  "-", never `0`.
* **Do not show what nothing computed.** No growth percentages, ratings or "popular" labels without data
  behind them; a screen without a backend says so on the page.
* Copy that browser specs and users rely on (`Request Publish`, `No Students Yet`, `Credential ID`) does not
  change without the spec.

### UI kit (`src/shared/ui`) and the look

[DESIGN.md](DESIGN.md) is the guide. In short: every page is built from the kit (`Button`, `Card`,
`PageHeader`, `StatCard`, `Field` with `Input` / `Select` / `Textarea`, `Tabs`, `SegmentedControl`, `Table`,
`Badge`, `Callout`, `ProgressBar`, `FileDrop`, `Menu`, `Modal`, `Drawer` ...) and coloured with the design
tokens only (`bg-surface`, `text-fg-muted`, `border-line`, `bg-primary`, `text-success-fg` ...), never with raw
palette classes (`bg-white`, `text-gray-500`, `bg-indigo-600`), so the light and the dark theme both work
without a `dark:` class. Charts take their colours from `useChartTheme()`.

`Modal` (named dialog, Escape, focus trap, scroll lock) for every popup; `ConfirmDialog` through
`useConfirm()`; `Toast` through `useToast()`; `ErrorState`, `EmptyState`, `PageSpinner`; `Avatar`
(initials, drawn locally) and `CourseThumbnail` (no third-party image requests); `StatusBadge` for a
course's state. Grade weights are compared with `shared/lib/gradeWeight` (exact hundredths) and money is
shown with `formatMoney`. A control that has no handler does not exist: it is wired, linked or removed.
The product's name comes from `shared/brand.ts`, never from a literal in a page.

### Types

TypeScript runs in strict mode (`pnpm run typecheck`, CI, the tests included).

* **The shape of an answer is written once**, in the slice's `types.ts`, and the request returns it
  (`api.get<Course[]>('/...')`). Keep `const BASE = '...';` literal and the URL as the first argument of the
  call: `tests/test_url_contract.py` reads the `api.ts` modules **(test)**.
* **Unions the slices share** (`UserType`, `CourseStatus`, ...) and the error body are in `shared/types.ts`;
  `shared/` takes structural props (`{ title; thumbnail? }`), never a feature's type.
* **A failure is `unknown` in a `catch`**: read it with `shared/api/errors`. Inside a query or a mutation it is
  an axios error with the API's body.
* **No `any`, no `@ts-ignore`** **(lint)**. A cast belongs at the edge (a `<select>` hands over text: narrow it
  with a guard built from the option list) or in a test fixture; a `!` says in a comment what makes it safe.
* A component has an `interface XProps` and no `React.FC`; state that starts empty is `useState<T | null>(null)`.

### Naming and data shapes

* Components are `PascalCase`, hooks `useThing`, helpers `camelCase`; files are named after what they export.
* **The UI keeps the API's field names** (`course_type`, `total_enrolled`). There is no mapping layer:
  about 160 fields are read in about 500 places, and a second spelling of each would be a second source of
  bugs. A form keeps its own state shape only where the request is built from it (`courseBody`).

### Tests

* Pure rules are unit-tested next to the module (`lib/*.test.ts`).
* Screens are tested through their hooks and api modules with only the HTTP client replaced
  (`jest.mock('<path to shared/api/client>')`), so a test also proves the query keys and the invalidation.
* Browser specs (`e2e/`) cover what only a browser proves, against the seeded stack.
