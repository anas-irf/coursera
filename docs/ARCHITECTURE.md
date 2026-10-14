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
| Insight | `insights` | `analytics` | read models across slices: dashboards, earnings, student statistics, achievements, admin user directory | `features/insights`, `features/admin` |
| Tooling | `seeding` | `seeding` | no models: `seed_demo`, `seed_dev` (development data), `create_dev_database`; installed by the dev and test settings only | |

The database app labels are pinned in each `AppConfig.label`: the packages were renamed after the slices, the tables and migrations were not. `db_table` is set on every model.

## Dependency rules

Backend, enforced by `lint-imports` (`backend/.importlinter`, CI):

```
seeding                    development tooling: may import anything, nothing imports it
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

**Domain events** (`apps/core/events.py`). A slice announces that something happened with `emit(signal, **payload)` after it saved the change. `emit` never raises: a failing receiver is logged. Today only `notifications/receivers.py` subscribes (course submitted / approved / rejected, enrolled, assignment graded, subscription activated / renewed, payment failed) and writes the notification texts, so none of the emitting slices imports `notifications`. `course_completed` (the last lecture of a course was completed) is announced as well and has no subscriber yet.

**Lecture content registry** (`apps/courses/extensions.py`). `courses` owns the lecture, but video, reading, quiz and assignment content belong to other slices. They register a `LectureContentHandler` (create, update, instructor view, student view, duration, grade weight) from their `AppConfig.ready()`; `courses` asks the registry. The same module lets higher slices add a column to the instructor's course list (`billing`: revenue), a key to the lecture payload (`learning`: completion rate) and a guard that blocks deleting a course (`learning`: enrollments exist).

## Progress and the learning log

`learning.services` owns the rules. `complete_lecture` (a student ticks off a video or a reading) and `complete_lecture_once` (a quiz taken or an assignment handed in completes its own lecture) mark a lecture done; `refresh_progress` recomputes the percentage and completes the course when every lecture is, exactly once, announcing `course_completed`. A finished course stays open (`selectors.enrollment_for_access`): the player, its lectures and its quizzes keep working, while gradebooks list running enrolments only. A read never writes: the player returns a lecture that has no progress row yet as not started, and the row is created when the student acts.

The player's heartbeat (`POST /learning/courses/<c>/lectures/<l>/progress/`) stores the resume position and credits the time spent, bounded by the distance the position moved, the real time since the previous beat and 60 s per beat. Everything that is about time (hours, streak, ranks, the monthly chart, the date of a badge) is derived from the daily log, `LearningStreak`: one row per student and day, in seconds. `StudentProfile.learning_streak` and `total_learning_hours` are refreshed from it the first time a student is active each day.

## Database notes

* Subscription models moved from `accounts` to `billing` with state-only migrations (`accounts.0004`, `payments.0002`): no DDL runs, rows and tables stay, content types are re-labelled.
* `search` and `reviews` were removed; their tables (`course_reviews`, `review_helpful_votes`, `instructor_ratings`, `search_history`, `saved_searches`, `course_recommendations`, `trending_topics`) are orphaned. Before applying the migrations to a database that held real data, check that they are empty; if one has rows, keep that app registered instead.
* Models without a live code path were removed, with the columns nothing read: `insights` analytics (the slice owns no tables now), `messaging` discussion threads / replies / votes, `learning` notes, `certificates` templates and verification, `assessments` rubrics, `notifications` preferences and e-mail templates, `content` video qualities and encoding columns, `courses` prerequisites / announcements / resources (the lecture payload keeps its `resources` key, always empty). Their migrations are named `*_drop_*` and use `apps.core.migration_ops`: they stop before dropping a table that holds rows or a column that holds a value, so a database that did use one of them is never emptied silently (`tests/test_migration_ops.py`). `learning.LearningStreak` is kept: it becomes the daily activity log.

## Configuration

`backend/config/settings/` has one module per environment on top of `base.py`: `dev.py` (local defaults),
`test.py` (the suite) and `prod.py` (what a deployment must supply). `manage.py` selects `dev`; `wsgi.py` and
`asgi.py` select `prod`. `base.py` carries no development convenience (no secret key, no localhost origins,
`DEBUG` off). Variables are read through `env.py` (typed helpers over python-decouple; a `.env` next to
`manage.py` is read too and real variables win) and listed in `backend/.env.example`, which
`tests/test_env_example.py` keeps in step with the code.

`prod.py` raises `ImproperlyConfigured` naming every missing variable and refuses a placeholder `SECRET_KEY`,
`CORS_ALLOW_ALL_ORIGINS` and a Stripe key without its webhook secret; it turns on HTTPS redirect, HSTS and
secure cookies. `tests/test_settings_prod.py` imports it in a subprocess on a copy of the package, and CI runs
`manage.py check --deploy` against it. The frontend's `npm run build` stops without `REACT_APP_API_URL`
(`frontend/scripts/require-env.js`).

## HTTP and WebSocket surface

Every slice is mounted at `/api/v1/<slice>/`: `auth`, `courses`, `learning`, `assessments`, `billing`, `insights`, `certificates`, `messaging`, `notifications`. The unversioned `/api/<slice>/` paths of the first release stay as aliases while `API_LEGACY_ALIASES` is on: they reach the same views and answer with `Deprecation` and `Link` headers (and `Sunset` when `API_LEGACY_SUNSET` is set), and every use is logged so the day to switch them off is chosen from data. **v1 is frozen**: paths, methods, JSON keys and value types, the `{error}` / `{detail}` / field-map error shapes and the status codes of working flows do not change inside it; endpoints, keys and optional parameters may be added. The one path outside the scheme is Stripe's webhook, `/api/payments/stripe/webhook/`, which is configured in the Stripe dashboard and is neither versioned nor aliased.

**What every endpoint inherits** (`REST_FRAMEWORK` in `config/settings/base.py`):

* **Closed by default.** `DEFAULT_PERMISSION_CLASSES` is `IsAuthenticated`, so a view that forgets to declare its permissions is closed. The anonymous routes are exactly the five in `tests/test_public_surface.py` (login, signup, token refresh, the public catalogue and Stripe's webhook); opening another is a change to that list. Role checks are permission classes (`IsStudent`, `IsInstructor`, `IsAdmin`), not `if user.user_type` lines in a view.
* **Throttled.** Scoped DRF throttles on a shared cache (Redis when `REDIS_URL` is set): `login`, `signup` and `refresh` per client address, `messages` and `uploads` per user, plus broad `anon` / `user` rates, all from `THROTTLE_*` variables. `NUM_PROXIES` says how many reverse proxies sit in front, so the client address is the right hop of `X-Forwarded-For`. A scope ignores the path, so `/api/v1/` and its alias share one bucket; a throttled call is a 429 with `Retry-After`.
* **One error contract.** A service raises `ServiceError` (`NotFound` and `PermissionDenied` are its subclasses) and the handler in `apps/core/api/errors.py` answers `{"error": ...}`; DRF's own exceptions keep their `{"detail": ...}` and field-map shapes. Anything else is a bug: the traceback is logged and the client gets `{"error": "Something went wrong on our side. ...", "code": "server_error"}` with status 500, never the exception text. Views therefore do not wrap themselves in `except Exception`; one that must translate a specific failure catches that one (`StripeError`). Bad input is a 400, not a 500: `int_param()` and `object_body()` (`apps/core/api/params.py`) read query parameters and JSON bodies defensively.
* **Pagination is opt-in.** The bare array is the v1 contract, so `?page=2&page_size=20` (at most 100) selects a page and nothing else changes. Every list answers `X-Total-Count`; a paged answer carries `Link` with `rel="next"` / `"prev"`; both are exposed to browsers through `CORS_EXPOSE_HEADERS`. The public catalogue has always answered its first 20 courses, so that is its default page (`apps/core/api/pagination.py`).

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

## Development data

`apps/seeding` is tooling, not a slice: it has no models, sits on top of every slice and is installed by the dev and test settings only. `python manage.py seed_dev` builds a cast of 32 people, 18 courses and months of activity; `--reset` removes exactly the people listed in `data/people.py` (and what cascades from them), `--list` prints the cast.

```
data/      the seed files: people, catalogue, courses (curricula), stories (what students do), messages
steps/     one module per phase, run in order: people, catalogue, courses, subscriptions, learning,
           engagement, earnings, finishing
```

Rules the seed follows:

* **Through the services.** Enrolling, finishing a lecture, attempting a quiz, handing in and grading, submitting and approving a course all call the application's own use-cases, so counters, grades and notifications are the real ones. A rule change that makes a story impossible fails `tests/test_seed_dev.py` instead of leaving stale demo data.
* **Directly only where nothing writes the row**: certificates (explicit numbers), instructor earnings and revenue pools, ratings, subscriptions and their payments, the notification kinds no event emits, `StudentProfile` hours, `last_login`. Direct writes live in the steps named for them.
* **Then back-dated.** A service stamps "now"; `clock.py` moves the dates of what a step created into the past with queryset updates.
* **Units are idempotent.** A course, an enrolment, a conversation is skipped when it exists, so a second run creates nothing and keeps passwords.
* **Stories are validated.** A student cannot enrol before the course was published or before the account existed; a finished quiz needs an outcome; retakes of the last lecture of a completed course cannot happen. Authoring mistakes raise while seeding.

To add a person, a course or a story edit the data files and run `seed_dev`; to add an activity that has a service, call it from a step.

What the seed cannot show, because the application cannot (see *Known gaps*): the rejection reason on the instructor's course card, instructor analytics and the admin revenue / reports / settings screens (static sample data). Hours, streaks, ranks and the monthly chart come from the learning log, which the seed fills through the same service the player's heartbeat uses (and tops up to each student's story hours).

## Testing

* `cd backend && python -m pytest` (SQLite by default; `TEST_DB_ENGINE=postgres` plus the `DB_*` variables runs the same suite on PostgreSQL, which CI does). Uploads go to a temporary `MEDIA_ROOT`.
* `cd frontend && npm test` (Jest through react-scripts; `package.json` maps axios and react-router for Jest 27).
* `tests/` pins current behaviour, including known bugs marked `pinned_bug`, so a refactor shows up as a failing test instead of a silent change.
* `e2e/` holds Playwright specs that run against the seeded stack (`seed_dev`); they cover what only a browser proves. The pipeline, its gates and how to run every check locally are in [CI.md](CI.md).

## Known gaps

Documented, not fixed in the restructuring:

* **Security**: the Stripe webhook accepts unsigned bodies when `STRIPE_WEBHOOK_SECRET` is empty; quiz options are not checked to belong to the answered question and the quiz time limit is not enforced on the server; reading HTML is rendered unsanitised; tokens live in `localStorage` and the WebSocket token is in the query string; `/api/messaging/users/` lists every user.
* **Logic**: editing a quiz or assignment recreates it and cascades to attempts / submissions; the subscription end date is not moved on renewal; certificates are never issued and `Certificate.save()` cannot build its number; nothing creates `InstructorEarning` rows (the seed writes them).
* **Product**: instructor analytics, instructor settings, admin revenue / reports / settings have no backend.
