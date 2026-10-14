# Coursera clone

[![CI](https://github.com/anas-irfan786/coursera/actions/workflows/ci.yml/badge.svg)](https://github.com/anas-irfan786/coursera/actions/workflows/ci.yml)

A learning platform with three roles (student, instructor, admin): course authoring and moderation, enrollment and progress, quizzes and assignments with grading, direct messaging, notifications and Stripe subscriptions.

```
backend/    Django 5 + DRF + Channels API         python manage.py ...
frontend/   React 19 single page application      npm start
docs/       ARCHITECTURE.md: slices, rules, how to extend
```

Both sides are organised by the same product slices (identity, authoring, monetisation, learning, assessment, engagement, recognition, insight); see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quickstart

Backend, on SQLite (nothing else to install):

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements-dev.txt

cd backend
cp .env.example .env               # DB_ENGINE=sqlite in the example
python manage.py migrate
python manage.py seed_dev          # a cast, a catalogue and activity; prints the shared password once
python manage.py runserver         # http://localhost:8000 (HTTP and WebSockets)
```

Frontend:

```bash
cd frontend
cp .env.example .env               # REACT_APP_API_URL=http://localhost:8000/api/v1
npm install
npm start                          # http://localhost:3000
```

### PostgreSQL

Install PostgreSQL 14 or newer (or use `docker compose`, below), then in `backend/.env`:

```
DB_ENGINE=postgres
DB_NAME=coursera_db
DB_USER=coursera_admin
DB_PASSWORD=choose-one              # there is no built-in password
```

and create the role and the database once; the command asks for the password of the `postgres` superuser:

```bash
python manage.py create_dev_database
python manage.py migrate
python manage.py seed_dev
```

With Docker instead: `DB_PASSWORD=choose-one docker compose up -d` starts PostgreSQL 16 and Redis 7 with the same names; set `REDIS_URL=redis://localhost:6379/0` in `.env` if the API and the socket consumers run in different processes.

### Development data

`seed_dev` fills the database with 32 people, 18 courses and a few months of activity, played through the application's own services, so every screen of the three roles has something to show and every reachable state has an example (draft, pending and rejected courses, learners from 0 to 100 percent, passed and failed quizzes, graded and waiting hand-ins, Plus members, lapsed and cancelled memberships, unread notifications and messages, empty accounts).

```bash
python manage.py seed_dev                    # create what is missing; safe to repeat
python manage.py seed_dev --reset            # remove the seeded people and what hangs off them, seed again
python manage.py seed_dev --list             # the accounts and what to try with each; touches nothing
python manage.py seed_dev --password ...     # or SEED_PASSWORD in backend/.env, else random and printed once
```

All seeded accounts share one password and use `@example.com` addresses. The ones to start with:

| Account | Role | Why |
|---|---|---|
| `demo.student@example.com` | student | Plus member, five enrolments from 0 to 100 percent, a certificate, 10+ unread notifications, four conversations |
| `amara.okoye@example.com` | student | yearly Plus, an eight-day streak, two certificates |
| `mei.lin@example.com` | student | registered, nothing else: the empty states |
| `demo.instructor@example.com` | instructor | the two demo courses and a course waiting for approval |
| `james.okafor@example.com` | instructor | featured course, a pending course, a course taken offline with learners enrolled |
| `noah.bennett@example.com` | instructor | no courses: the empty instructor screens |
| `demo.admin@example.com` | admin | two courses waiting in the approvals queue, every list |

`seed_demo` is the smaller sibling (three accounts and two courses); `seed_dev` runs it first. Both refuse to run when `DEBUG` is off unless `--force` is given, and neither exists in the production settings.

### Stripe

Checkout needs a test-mode secret key and the webhook secret in `backend/.env` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; checkout redirects to Stripe, so no publishable key is needed). Point the webhook at `/api/payments/stripe/webhook/` and set `FRONTEND_URL` to where the React app runs.

## Checks

```bash
cd backend
python -m pytest --cov            # SQLite; TEST_DB_ENGINE=postgres for PostgreSQL; fails under 90 % coverage
ruff check apps config tests      # rules in backend/ruff.toml
lint-imports                      # slices depend downwards only
python manage.py makemigrations --check --dry-run

cd ../frontend
npm run lint                      # includes the module boundaries
npm run test:ci                   # Jest with coverage
npm run build                     # warnings fail it

cd ../e2e
npm test                          # browser specs against the seeded stack, see docs/CI.md
```

CI (`.github/workflows/ci.yml`) runs all of it in parallel on every pull request, adds dependency
and secret scanning and posts the test report on the pull request. What each job guarantees and
how to run it locally: [docs/CI.md](docs/CI.md).

## Configuration

Local development needs none of the backend variables: `config.settings.dev` supplies safe defaults.
A deployment runs `config.settings.prod` (the default of `wsgi.py` and `asgi.py`), which **refuses to
start** and names every missing variable marked *required* below.

| Variable | Where | Meaning |
|---|---|---|
| `SECRET_KEY` | backend | signs sessions and JWTs; **required in production**, a development key is refused |
| `ALLOWED_HOSTS` | backend | host names served; **required in production** |
| `CORS_ALLOWED_ORIGINS` | backend | origins of the React app; **required in production** (localhost in development) |
| `FRONTEND_URL` | backend | where Stripe sends customers back; **required in production** |
| `DB_ENGINE` | backend | `sqlite` or `postgres` (default) |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | backend | PostgreSQL connection (no default password; `DB_PASSWORD` is required in production) |
| `REDIS_URL` | backend | Channels layer; in-memory when empty (required in production unless `CHANNEL_LAYER=memory`) |
| `BEHIND_TLS_PROXY` | backend | production only: trust the proxy's `X-Forwarded-Proto` |
| `JWT_ACCESS_LIFETIME_MINUTES`, `JWT_REFRESH_LIFETIME_DAYS` | backend | token lifetimes (60 and 7) |
| `LOG_LEVEL` | backend | level of the application's loggers (`INFO`) |
| `SEED_PASSWORD` | backend | password of the users `seed_dev` creates (random when empty) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | backend | Stripe test secret key (no default) and webhook secret |
| `REACT_APP_API_URL` | frontend | API base; **required for a production build** (`npm run build` stops without it), `http://localhost:8000/api/v1` in development |
| `REACT_APP_WS_URL` | frontend | WebSocket base, derived from the API URL by default |

`backend/.env.example` lists the rest.
