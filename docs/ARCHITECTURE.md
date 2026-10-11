# Architecture

The platform is split into **slices**: each product phase owns its models, rules, API and screens, on both sides of the repository. A slice depends on the slices below it and never on the ones above; where something above has to react, it listens to an event or registers an extension instead of being imported.

```
backend/    Django 5 + DRF + Channels     python manage.py ...
frontend/   React 19 (Create React App)   npm start
docs/       this file
```

## Slices

| Phase | Backend package | DB app label | Owns | Frontend feature |
|---|---|---|---|---|
| Platform | `core`, `config` | `core` | `BaseModel`, categories/tags/languages, error handling, domain events, security middleware | `shared/` |
| Identity | `accounts` | `accounts` | users and profiles, JWT login, e-mail verification, role permissions | `features/accounts`, `shared/auth` |
| Authoring and moderation | `courses`, `content` | `courses`, `content` | courses, sections, lectures; video / reading content; instructor CRUD, curriculum, submit / approve / reject | `features/courses`, `features/admin` |
| Monetisation | `billing` | `payments` | plans, Plus subscription and payments, Stripe checkout and webhook, instructor earnings | `features/billing` |
| Learning | `learning` | `enrollments` | enrollments, progress, bookmarks; catalogue, enrol, player, learner rosters | `features/learning` |
| Assessment | `assessments` | `assessments` | quizzes, attempts, assignments, submissions, grading, gradebooks | `features/assessments` |
| Engagement | `messaging`, `notifications` | `discussions`, `notifications` | direct messages (REST and WebSocket), notifications | `features/messaging`, `features/notifications` |
| Recognition | `certificates` | `certificates` | certificates (listing) | `features/certificates` |
| Insight | `insights` | `analytics` | read models across slices: dashboards, earnings, student statistics, achievements, admin user directory; `seed_demo` | `features/insights`, `features/admin` |

The database app labels are pinned in each `AppConfig.label`: the packages were renamed after the slices, the tables and migrations were not. `db_table` is set on every model.

## Dependency rules

Backend, enforced by `lint-imports` (`backend/.importlinter`, CI):

```
insights | notifications
assessments | certificates
learning
billing | messaging | content
courses
accounts
core
```

* A slice may import the slices below it. Slices on the same line do not import each other.
* Inside a slice: `api` (views, serializers, urls) → `services` (use-cases, writes) → `selectors` (reads) → `models`. Views stay thin; rules live in services; services raise `ServiceError` and the DRF exception handler turns it into `{"error": ...}`.
* Cross-slice reads that must not create an upward import go through the two mechanisms below.

Frontend, enforced by ESLint (`frontend/.eslintrc.js`, `import/no-restricted-paths`, CI and every build):

* `shared/` imports neither features nor the app shell.
* A feature never imports the app shell, and reaches another feature only through that feature's `index.js` and only in the allowed direction: `insights → learning, billing`; `learning → assessments`.
* `app/` wires features into layouts and routes.

## Talking upwards

**Domain events** (`apps/core/events.py`). A slice announces that something happened with `emit(signal, **payload)` after it saved the change. `emit` never raises: a failing receiver is logged. Today only `notifications/receivers.py` subscribes (course submitted / approved / rejected, enrolled, assignment graded, subscription activated / renewed, payment failed) and writes the notification texts, so none of the emitting slices imports `notifications`.

**Lecture content registry** (`apps/courses/extensions.py`). `courses` owns the lecture, but video, reading, quiz and assignment content belong to other slices. They register a `LectureContentHandler` (create, update, instructor view, student view, duration, grade weight) from their `AppConfig.ready()`; `courses` asks the registry. The same module lets higher slices add a column to the instructor's course list (`billing`: revenue), a key to the lecture payload (`learning`: completion rate) and a guard that blocks deleting a course (`learning`: enrollments exist).

## Database notes

* Subscription models moved from `accounts` to `billing` with state-only migrations (`accounts.0004`, `payments.0002`): no DDL runs, rows and tables stay, content types are re-labelled.
* `search` and `reviews` were removed; their tables (`course_reviews`, `review_helpful_votes`, `instructor_ratings`, `search_history`, `saved_searches`, `course_recommendations`, `trending_topics`) are orphaned. Before applying the migrations to a database that held real data, check that they are empty; if one has rows, keep that app registered instead.
* Models without a live code path are kept and marked here as planned: `insights` analytics models, `messaging` discussion threads / replies / votes, `learning` notes and streaks, `certificates` templates and verification, `assessments` rubrics, `notifications` preferences and e-mail templates, `content` video qualities.

## HTTP and WebSocket surface

Every slice is mounted at `/api/<slice>/`: `auth`, `courses`, `learning`, `assessments`, `billing`, `insights`, `certificates`, `messaging`, `notifications`. The one exception is Stripe's webhook, `/api/payments/stripe/webhook/`, which is configured in the Stripe dashboard.

WebSockets: `/ws/user/` (everything addressed to the user) and `/ws/chat/<conversation_id>/` (typing indicators of one conversation), authenticated with `?token=<access token>`.

`backend/tests/routes.expected.txt` is the route table; `tests/test_url_contract.py` resolves every request in the frontend's `api.js` modules against it.

## Frontend

```
src/
  app/        App.jsx (providers, route table), guards, layouts (student / instructor / admin)
  shared/     api/client.js (the one HTTP client), auth/, lib/ (session, media, time, download), ui/ (Toast, ConfirmDialog, Spinner)
  features/<slice>/
              api.js  pages/  components/  hooks/  index.js
```

* **One client.** `shared/api/client.js` adds the token, refreshes it once on a 401 (concurrent requests share the refresh) and stores the rotated refresh token. If the session cannot be refreshed it is cleared and `AuthProvider` sends the user to the login page.
* **One session.** `shared/lib/session.js` is the only reader and writer of the tokens; components read it through `useAuth()`.
* **Real URLs.** `/student/...`, `/instructor/...`, `/admin/...` and `/courses/:id/learn`. The backend's notification links (`/instructor/courses`, `/admin/courses/approvals`, ...) are routes; `/student/dashboard`, `/instructor/dashboard`, `/admin/dashboard` and `/admindashboard` redirect.
* **Media** is loaded from the API host through `mediaUrl()`; the WebSocket base comes from `REACT_APP_WS_URL` or the API URL.

Screens without a backend (instructor analytics, instructor settings, admin revenue / reports / platform settings) say so on the page; their sample data lives in `features/admin/sampleData.js`.

## Adding a feature

1. Models and migration in the owning slice (set `db_table`; never alter another slice's tables).
2. Rules in `services/`, reads in `selectors/`, thin views in `api/`, a route in the slice's `urls.py`.
3. Something another slice must react to: add a signal to `core/events.py` and a receiver; something that plugs into lectures: register a handler.
4. Tests next to the behaviour: API tests in `backend/tests` use literal URLs and the factories; update `tests/routes.expected.txt` (`UPDATE_ROUTES=1 pytest tests/test_routes.py`).
5. Frontend: `features/<slice>/api.js` for the requests, pages and components beside it, export the public parts from `index.js`, add the route in `app/App.jsx`.
6. `lint-imports`, `eslint`, `pytest`, `npm test` must pass; CI runs all of them.

## Testing

* `cd backend && python -m pytest` (SQLite by default; `TEST_DB_ENGINE=postgres` plus the `DB_*` variables runs the same suite on PostgreSQL, which CI does). Uploads go to a temporary `MEDIA_ROOT`.
* `cd frontend && npm test` (Jest through react-scripts; `package.json` maps axios and react-router for Jest 27).
* `tests/` pins current behaviour, including known bugs marked `pinned_bug`, so a refactor shows up as a failing test instead of a silent change.

## Known gaps

Documented, not fixed in the restructuring:

* **Security**: the Stripe webhook accepts unsigned bodies when `STRIPE_WEBHOOK_SECRET` is empty; some default secrets / keys exist in settings; quiz options are not checked to belong to the answered question and the quiz time limit is not enforced on the server; reading HTML is rendered unsanitised; tokens live in `localStorage` and the WebSocket token is in the query string; `/api/messaging/users/` lists every user; the rate limiter's path prefixes never match.
* **Logic**: editing a quiz or assignment recreates it and cascades to attempts / submissions; a completed enrolment can no longer open the player; the subscription end date is not moved on renewal; certificates are never issued and `Certificate.save()` cannot build its number; nothing creates `InstructorEarning` rows; watch time is not recorded so the weekly chart is a placeholder.
* **Product**: instructor analytics, instructor settings, admin revenue / reports / settings have no backend.
