# Architecture

The platform is split into **slices**: each product phase owns its models, rules, API and screens, on both sides of the repository. A slice depends on the slices below it and never on the ones above; where something above has to react, it listens to an event or registers an extension instead of being imported.

```
backend/    Django 5 + DRF + Channels     python manage.py ...
frontend/   React 19 (Create React App)   pnpm start
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
certificates
assessments | messaging
learning
billing | content
courses
accounts
core
```

* A slice may import the slices below it. Slices on the same line do not import each other.
* Inside a slice: `api` (views, serializers, urls) → `services` (use-cases, writes) → `selectors` (reads) → `models`. Views stay thin; rules live in services; services raise `ServiceError` and the DRF exception handler turns it into `{"error": ...}`.
* The domain does not know HTTP: `services`, `selectors` and `models` import neither `rest_framework` (a third `lint-imports` contract) nor `django.http` (`ruff`, `TID251`). The client's address, for instance, is worked out by the adapter and handed to the service.
* Every module and top-level class has a docstring (`ruff`, `D100` / `D101`); [CONVENTIONS.md](CONVENTIONS.md) says what goes where and how things are named.
* Cross-slice reads that must not create an upward import go through the two mechanisms below.

Frontend, enforced by ESLint (`frontend/.eslintrc.js`, `import/no-restricted-paths`, CI and every build):

* `shared/` imports neither features nor the app shell.
* A feature never imports the app shell, and reaches another feature only through that feature's `index.ts` and only in the allowed direction: `insights → learning, billing`; `learning → assessments`.
* The screens of a feature (`pages/`, `components/`) never import its `api.ts`: they use its `hooks/`, which own the query keys, what a change refreshes and how a failure is reported. `console` is not used either.
* `app/` wires features into layouts and routes.

## Talking upwards

**Domain events** (`apps/core/events.py`). A slice announces that something happened with `emit(signal, **payload)` after it saved the change. `emit` never raises: a failing receiver is logged. Today only `notifications/receivers.py` subscribes (course submitted / approved / rejected, enrolled, assignment graded, subscription activated / renewed, payment failed) and writes the notification texts, so none of the emitting slices imports `notifications`. `course_completed` (the last lecture of a course was completed), `assignment_graded` and `quiz_attempt_finished` are what `certificates/receivers.py` subscribes to; `certificate_issued` is turned into a notification.

**Lecture content registry** (`apps/courses/extensions.py`). `courses` owns the lecture, but video, reading, quiz and assignment content belong to other slices. They register a `LectureContentHandler` (create, update, instructor view, student view, duration, grade weight) from their `AppConfig.ready()`; `courses` asks the registry. The same module lets higher slices add a column to the instructor's course list (`billing`: revenue), a key to the lecture payload (`learning`: completion rate) and a guard that blocks deleting a course (`learning`: enrollments exist).

## Progress and the learning log

`learning.services` owns the rules. `complete_lecture` (a student ticks off a video or a reading) and `complete_lecture_once` (a quiz taken or an assignment handed in completes its own lecture) mark a lecture done; `refresh_progress` recomputes the percentage and completes the course when every lecture is, exactly once, announcing `course_completed`. A finished course stays open (`selectors.enrollment_for_access`): the player, its lectures and its quizzes keep working, while gradebooks list running enrolments only. A read never writes: the player returns a lecture that has no progress row yet as not started, and the row is created when the student acts.

The player's heartbeat (`POST /learning/courses/<c>/lectures/<l>/progress/`) stores the resume position and credits the time spent, bounded by the distance the position moved, the real time since the previous beat and 60 s per beat. Everything that is about time (hours, streak, ranks, the monthly chart, the date of a badge) is derived from the daily log, `LearningStreak`: one row per student and day, in seconds. `StudentProfile.learning_streak` and `total_learning_hours` are refreshed from it the first time a student is active each day.

## Who may see and write what

**Messaging** sits above `learning`: a user may write to the admins, to the people they already have a conversation with (a reply is always possible), and to the people who share a course with them (a course's instructor and its students, classmates included). Admins may write to every active user. `GET /messaging/users/` lists exactly that set and `services.send_message` enforces the same rule (REST and WebSocket share it), so a user id that is not on the list is a 403. The socket answers a refused or malformed frame with `{"type": "error", "error": ...}` instead of dropping it, a binary frame does not close it, and an account that was deactivated has no socket.

**Reading HTML** is written by instructors and rendered in every learner's browser, so it is cleaned twice: on write (`apps.core.utils.sanitize_html`, `nh3`) and on render (`shared/lib/html.ts`, DOMPurify). Formatting, links, images and tables stay; scripts, event handlers, `javascript:` URLs, frames and forms do not. `python manage.py clean_reading_html [--dry-run]` repairs what was stored before.

## Sessions

The browser's JWT pair lives in two `HttpOnly` cookies (`AUTH_COOKIE_*`): the access token at path `/` (the WebSocket needs it) and the refresh token at `/api/`. Login sets them; token refresh rotates them (a browser gets `204` and never sees a token); logout is authenticated by the refresh token, blacklists it and always clears both cookies. Because a browser attaches cookies to requests made by any page, a request that **changes data** and is authenticated by the cookie must come from our own front end: it carries `X-Requested-With` and an `Origin` that is in `CORS_ALLOWED_ORIGINS` (a bearer header, which a page has to know, needs neither). The app and the API must be on one site (`localhost` for both in development, `app.` and `api.` of one domain in production). Scripts and mobile clients keep using `Authorization: Bearer` and may ask for tokens in the body with `X-Auth-Transport: bearer`; while `AUTH_LEGACY_TOKEN_TRANSPORT` is on (the default) login answers also carry the token pair and the refresh endpoint accepts it in the body, which is how the release before cookies moves its session over. Turn it off once nothing of that is left.

## Billing and earnings

**Plans.** `billing/plans.py` is where a Coursera Plus plan is written down: the active `SubscriptionPlan` row of a cycle (`monthly` / `yearly`) is what the checkout page lists and what Stripe is asked to charge, and until a row exists the built-in default of the cycle is used. Nothing else holds a price.

**Webhook.** `/api/payments/stripe/webhook/` accepts nothing it cannot verify: without `STRIPE_WEBHOOK_SECRET` it answers 503 and never parses the body. Subscribe the endpoint to `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated` and `customer.subscription.deleted`. Handlers are atomic and idempotent (a payment is recorded once per Stripe transaction: the payment intent, the checkout session, or `<invoice>:<attempt>` for a failed attempt) and a failure answers 5xx so that Stripe delivers the event again. A renewal moves `end_date` to the period end Stripe reports (else one plan period); the first payment of a subscription is the checkout's, not a renewal.

**Cancelling** stops the renewal at Stripe (`cancel_at_period_end`) and here (`status: cancelled`, `auto_renew: false`); the member keeps Plus until `end_date`, the end of the period they paid for. A subscription whose status is `suspended` (three failed attempts) or `expired` has no access.

**Earnings.** `python manage.py calculate_earnings [--month YYYY-MM] [--dry-run]` (schedule it for the first day of every month, for the month before). The pool is `INSTRUCTOR_REVENUE_SHARE_PERCENT` of the month's completed Plus payments and is conserved: each Plus course that the month's learners enrolled in gets a share in proportion to its enrollments times a performance multiplier, normalised so the amounts add up to the pool to the cent. A month is calculated once, after it ended, and then frozen. Only figures are recorded; nothing pays an instructor (`is_paid` stays false).

## Certificates

`certificates` sits above `assessments` (it needs the weighted grade). A certificate is issued by the application when the enrollment is **completed** and the weighted grade reaches `COURSE_PASSING_GRADE`; hand-ins still waiting for the instructor's grade postpone the decision, and a course with nothing graded certifies on completion. Because the course usually completes before the last grade arrives, three events ask the same idempotent question (`services.issue_if_eligible`): the course completed, an assignment graded, a quiz attempt finished (a retake can lift the grade). One enrollment has at most one certificate and its number never changes; numbers and verification codes are random (`secrets`). `python manage.py issue_certificates [--dry-run] [--notify]` issues the ones earned before this existed (silently unless asked).

## Assessments

A quiz or an assignment is created, edited and graded by `assessments.services` (`authoring`, `quizzes`, `assignments`, `grades`); `handlers` in the slice only adapt them to the lecture registry, and the JSON shapes are `api/serializers.py`. What a student sends is never trusted: an option counts only for the question it belongs to, an answer that is not an object is a wrong answer, a quiz answer that arrives after `time_limit` plus `QUIZ_SUBMIT_GRACE_SECONDS` closes the attempt at zero (400, `code: time_limit_exceeded`), and an inactive quiz or assignment takes no attempts or hand-ins.

The lecture form posts nested structures as JSON strings; `authoring` parses and validates them (400 on anything else) and **edits in place**: questions and options are matched by `id` (by position when a client sends none), settings change only when they were sent, and only what was removed is deleted, so attempts, responses and hand-ins survive an edit. A lecture and its content are written in one transaction. A published course is not edited in place: `courses.services.curriculum.ensure_editable` is the one guard behind add, edit, delete and reorder.

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
`manage.py check --deploy` against it. The frontend's `pnpm run build` stops without `REACT_APP_API_URL`
(`frontend/scripts/require-env.js`).

## HTTP and WebSocket surface

Every slice is mounted at `/api/v1/<slice>/`: `auth`, `courses`, `learning`, `assessments`, `billing`, `insights`, `certificates`, `messaging`, `notifications`. The unversioned `/api/<slice>/` paths of the first release stay as aliases while `API_LEGACY_ALIASES` is on: they reach the same views and answer with `Deprecation` and `Link` headers (and `Sunset` when `API_LEGACY_SUNSET` is set), and every use is logged so the day to switch them off is chosen from data. **v1 is frozen**: paths, methods, JSON keys and value types, the `{error}` / `{detail}` / field-map error shapes and the status codes of working flows do not change inside it; endpoints, keys and optional parameters may be added. The one path outside the scheme is Stripe's webhook, `/api/payments/stripe/webhook/`, which is configured in the Stripe dashboard and is neither versioned nor aliased.

**What every endpoint inherits** (`REST_FRAMEWORK` in `config/settings/base.py`):

* **Closed by default.** `DEFAULT_PERMISSION_CLASSES` is `IsAuthenticated`, so a view that forgets to declare its permissions is closed. The anonymous routes are exactly the five in `tests/test_public_surface.py` (login, signup, logout, token refresh, the public catalogue and Stripe's webhook); opening another is a change to that list. Role checks are permission classes (`IsStudent`, `IsInstructor`, `IsAdmin`), not `if user.user_type` lines in a view.
* **Throttled.** Scoped DRF throttles on a shared cache (Redis when `REDIS_URL` is set): `login`, `signup` and `refresh` per client address, `messages` and `uploads` per user, plus broad `anon` / `user` rates, all from `THROTTLE_*` variables. `NUM_PROXIES` says how many reverse proxies sit in front, so the client address is the right hop of `X-Forwarded-For`. A scope ignores the path, so `/api/v1/` and its alias share one bucket; a throttled call is a 429 with `Retry-After`.
* **One error contract.** A service raises `ServiceError` (`NotFound` and `PermissionDenied` are its subclasses) and the handler in `apps/core/api/errors.py` answers `{"error": ...}`; DRF's own exceptions keep their `{"detail": ...}` and field-map shapes. Anything else is a bug: the traceback is logged and the client gets `{"error": "Something went wrong on our side. ...", "code": "server_error"}` with status 500, never the exception text. Views therefore do not wrap themselves in `except Exception`; one that must translate a specific failure catches that one (`StripeError`). Bad input is a 400, not a 500: `int_param()` and `object_body()` (`apps/core/api/params.py`) read query parameters and JSON bodies defensively.
* **Pagination is opt-in.** The bare array is the v1 contract, so `?page=2&page_size=20` (at most 100) selects a page and nothing else changes. Every list answers `X-Total-Count`; a paged answer carries `Link` with `rel="next"` / `"prev"`; both are exposed to browsers through `CORS_EXPOSE_HEADERS`. The public catalogue has always answered its first 20 courses, so that is its default page (`apps/core/api/pagination.py`).

WebSockets: `/ws/user/` (everything addressed to the user) and `/ws/chat/<conversation_id>/` (typing indicators of one conversation), authenticated by the session cookie of the handshake (its `Origin` must be one of `CORS_ALLOWED_ORIGINS`) or, while `AUTH_LEGACY_TOKEN_TRANSPORT` is on, by `?token=<access token>`.

`backend/tests/routes.expected.txt` is the route table; `tests/test_url_contract.py` resolves every request in the frontend's `api.ts` modules against it. `backend/tests/openapi.v1.yaml` is the OpenAPI document of `/api/v1/` (paths, methods, path parameters, authentication, and the bodies wherever a serializer defines them; generated by drf-spectacular, a development-only tool) and `tests/test_openapi.py` fails on any difference: the freeze above is enforced by a diff in the pull request. Regenerate with `UPDATE_OPENAPI=1 python -m pytest tests/test_openapi.py`.

## Frontend

```
src/
  app/        App.tsx (providers, route table, lazy routes), guards, layouts (student / instructor / admin)
  shared/     api/ (the one HTTP client, error helpers), auth/, query/ (the cache), lib/ (session, media,
              time, money, grade weights, hooks), ui/ (Modal, Toast, ConfirmDialog, ErrorState, EmptyState,
              Avatar, CourseThumbnail, StatusBadge, Spinner)
  features/<slice>/
              api.ts  types.ts  hooks/  lib/  pages/  components/  index.ts
```

* **One client.** `shared/api/client.ts` sends the session cookies (`withCredentials`) and `X-Requested-With`, refreshes the session once on a 401 (concurrent requests, across tabs through `navigator.locks`, share the refresh) and replays the request. If the refresh fails it asks for the profile once, because another tab may have refreshed, and only then ends the session; `AuthProvider` sends the user to the login page.
* **One session.** `shared/lib/session.ts` holds who is signed in and the status (`unknown` while the server is asked, `authenticated`, `anonymous`, `unavailable` when it cannot be reached) in memory; the tokens are HttpOnly cookies the page cannot read. Only a *hint* that this browser has a session is stored, which also tells other tabs about a login or a logout. Guards show a spinner while the status is `unknown` and never treat `unavailable` as signed out. A session left in `localStorage` by the release before cookies is exchanged once and removed.
* **Real URLs.** `/student/...`, `/instructor/...`, `/admin/...` and `/courses/:id/learn`. The backend's notification links (`/instructor/courses`, `/admin/courses/approvals`, ...) are routes; `/student/dashboard`, `/instructor/dashboard`, `/admin/dashboard` and `/admindashboard` redirect.
* **Media** is loaded from the API host through `mediaUrl()`; the WebSocket base comes from `REACT_APP_WS_URL` or the API URL.

* **Server state is one cache** (`shared/query`, TanStack Query). A key is `[feature, resource, params]`; a hook per resource lives in `features/<slice>/hooks`; a mutation invalidates by prefix, so every screen showing the thing changes together (enrolling refreshes my courses, the catalogue and the home page; approving a course updates the approval queue and the sidebar badge, which are one entry). A failed query is retried once (not on a 4xx) and then **reported**: every screen has a loading, an error (`ErrorState`, with a retry) and an empty state (`EmptyState`), and a figure that could not be loaded is shown as "-", never as 0. The auth session is not server state and stays in `shared/lib/session.ts`.
* **Lists are paged where they can grow**: the catalogue loads twelve courses at a time ("Load more", `X-Total-Count`); My courses fetches the student's courses once and filters ("In Progress", "Completed", "All").
* **Watch time and quizzes.** The player reports where a student is in a video (uploaded files through the `<video>` events, YouTube through the IFrame Player API attached to the embed; every 15 s while playing, on pause, at the end, on leaving) and resumes from the stored place; the answer is folded into the cached outline. A quiz with a time limit counts down to the `expires_at` the server sent and hands the answers in by itself; a late answer is refused by the server (`time_limit_exceeded`) and said so. The length of an uploaded video is read from the file by the server (MP4 / MOV and WebM headers, `apps/content/media.py`), never taken on the client's word; a client may send `duration` as a fallback for a container the server cannot read.
* **No third-party requests for pictures**: avatars are initials drawn locally, a course without a picture gets a local placeholder.
* **Dialogs are one component** (`shared/ui/Modal`): a named `role="dialog"`, Escape closes the top-most, Tab stays inside, focus returns to the opener, the page behind does not scroll.
* **TypeScript, strict** (`pnpm run typecheck`, in CI, the tests included). The shapes the API answers are written down once per slice in `features/<slice>/types.ts` (taken from the serializers and views: the OpenAPI document has response schemas only for course authoring) and the `api.ts` modules return them through `api.get<T>(...)`; what several slices share (`UserType`, `CourseStatus`, the error body) is in `shared/types.ts`. A failed request is an axios error with the `{error}` / `{detail}` / field-map body, so `error.response?.status` is typed in hooks and callbacks, and a `catch` variable is `unknown`, read through `shared/api/errors`. `any` and `@ts-ignore` are lint errors.

Screens without a backend (instructor analytics, instructor settings, admin revenue / reports / platform settings) say so on the page; their sample data lives in `features/admin/sampleData.ts`.

## Adding a feature

1. Models and migration in the owning slice (set `db_table`; never alter another slice's tables).
2. Rules in `services/`, reads in `selectors/`, thin views in `api/`, a route in the slice's `urls.py`.
3. Something another slice must react to: add a signal to `core/events.py` and a receiver; something that plugs into lectures: register a handler.
4. Tests next to the behaviour: API tests in `backend/tests` use literal URLs and the factories; update `tests/routes.expected.txt` and `tests/openapi.v1.yaml` (`UPDATE_ROUTES=1 pytest tests/test_routes.py`, `UPDATE_OPENAPI=1 pytest tests/test_openapi.py`) and look at the diff: it is the contract change.
5. Frontend: `features/<slice>/api.ts` for the requests and `types.ts` for the shapes they answer, `hooks/` for the queries and mutations (keys `[slice, resource, params]`), `lib/` for the rules, pages and components using the hooks, export the public parts (and their types) from `index.ts`, add the route in `app/App.tsx` (lazily: `page(loader, name)`, which checks the export name).
6. `lint-imports`, `ruff`, `tsc`, `eslint`, `pytest`, `pnpm test` must pass; CI runs all of them, plus the browser specs.

## Development data

`apps/seeding` is tooling, not a slice: it has no models, sits on top of every slice and is installed by the dev and test settings only. `python manage.py seed_dev` builds a cast of 32 people, 18 courses and months of activity; `--reset` removes exactly the people listed in `data/people.py` (and what cascades from them), `--list` prints the cast.

```
data/      the seed files: people, catalogue, courses (curricula), stories (what students do), messages
steps/     one module per phase, run in order: people, catalogue, courses, subscriptions, learning,
           engagement, earnings, finishing
```

Rules the seed follows:

* **Through the services.** Enrolling, finishing a lecture, attempting a quiz, handing in and grading, submitting and approving a course all call the application's own use-cases, so counters, grades and notifications are the real ones. A rule change that makes a story impossible fails `tests/test_seed_dev.py` instead of leaving stale demo data.
* **Directly only where nothing writes the row**: instructor earnings and revenue pools, ratings, subscriptions and their payments, the notification kinds no event emits, `StudentProfile` hours, `last_login`. Direct writes live in the steps named for them.
* **Then back-dated.** A service stamps "now"; `clock.py` moves the dates of what a step created into the past with queryset updates.
* **Units are idempotent.** A course, an enrolment, a conversation is skipped when it exists, so a second run creates nothing and keeps passwords.
* **Stories are validated.** A student cannot enrol before the course was published or before the account existed; a finished quiz needs an outcome; retakes of the last lecture of a completed course cannot happen. Authoring mistakes raise while seeding.

To add a person, a course or a story edit the data files and run `seed_dev`; to add an activity that has a service, call it from a step.

What the seed cannot show, because the application cannot (see *Known gaps*): the rejection reason on the instructor's course card, instructor analytics and the admin revenue / reports / settings screens (static sample data). Hours, streaks, ranks and the monthly chart come from the learning log, which the seed fills through the same service the player's heartbeat uses (and tops up to each student's story hours).

## Testing

* `cd backend && python -m pytest` (SQLite by default; `TEST_DB_ENGINE=postgres` plus the `DB_*` variables runs the same suite on PostgreSQL, which CI does). Uploads go to a temporary `MEDIA_ROOT`.
* `cd frontend && pnpm test` (Jest through react-scripts; `package.json` maps axios and react-router for Jest 27). Rules are unit-tested in `lib/`; screens are tested through their hooks and api modules with only the HTTP client replaced, so a test also proves the query keys and the invalidation. The coverage floor is 60 / 48 / 52 / 61 % (statements / branches / functions / lines).
* `tests/` characterises behaviour at the HTTP level (literal URLs, models only through `factories.py`), so a refactor shows up as a failing test instead of a silent change; a known bug is fixed together with the test that pinned it, not left marked.
* `e2e/` holds Playwright specs that run against the seeded stack (`seed_dev`); they cover what only a browser proves. The pipeline, its gates and how to run every check locally are in [CI.md](CI.md).

## Known gaps

Documented, not fixed in the restructuring:

* **Logic**: payouts to instructors do not exist (earnings are calculated and recorded only); `messaging/payloads.py` (the wire format of a message) is still imported by `services.publish` because the event must be serialisable.
* **Product**: instructor analytics, instructor settings, admin revenue / reports / settings have no backend (their screens are samples and say so); reviews and ratings do not exist, so ratings show "-" or 0; the seeded earnings of past months are narrative rows that do not come from the calculation.
* **Migration to finish**: `AUTH_LEGACY_TOKEN_TRANSPORT` is still on (turn it off, and delete the code behind it, at least a week after the cookie release); the unversioned `/api/<slice>/` aliases still answer (choose the day from the `Deprecation` log); the API still sends `ui-avatars.com` URLs in a few v1 payloads (`avatar` of the user directory, the roster and messages), which the front end no longer requests; they change in v2.
