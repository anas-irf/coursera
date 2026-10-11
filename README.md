# Coursera clone

A learning platform with three roles (student, instructor, admin): course authoring and moderation, enrollment and progress, quizzes and assignments with grading, direct messaging, notifications and Stripe subscriptions.

```
backend/    Django 5 + DRF + Channels API         python manage.py ...
frontend/   React 19 single page application      npm start
docs/       ARCHITECTURE.md: slices, rules, how to extend
```

Both sides are organised by the same product slices (identity, authoring, monetisation, learning, assessment, engagement, recognition, insight); see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quickstart

Backend (SQLite, nothing else to install):

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements-dev.txt

cd backend
cp .env.example .env               # DB_ENGINE=sqlite in the example
python manage.py migrate
python manage.py seed_demo         # prints a password for each demo user, once
python manage.py runserver         # http://localhost:8000 (HTTP and WebSockets)
```

Frontend:

```bash
cd frontend
cp .env.example .env               # REACT_APP_API_URL=http://localhost:8000/api
npm install
npm start                          # http://localhost:3000
```

`seed_demo` creates `demo.admin@example.com`, `demo.instructor@example.com` and `demo.student@example.com`, the subscription plans and two sample courses (one free, one Plus). Run it again to fill in anything missing; pass `--password` to choose the password of new users.

### PostgreSQL and Redis

```bash
DB_PASSWORD=choose-one docker compose up -d      # Postgres 16 and Redis 7
```

then in `backend/.env`: `DB_ENGINE=postgres`, the same `DB_PASSWORD`, and `REDIS_URL=redis://localhost:6379/0` if the API and the socket consumers run in different processes.

### Stripe

Checkout needs test-mode keys in `backend/.env` (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`). Point the webhook at `/api/payments/stripe/webhook/` and set `FRONTEND_URL` to where the React app runs.

## Checks

```bash
cd backend
python -m pytest                   # SQLite; TEST_DB_ENGINE=postgres for PostgreSQL
lint-imports                       # slices depend downwards only
ruff check --select F apps config tests
python manage.py makemigrations --check --dry-run

cd ../frontend
npm test -- --watchAll=false
npx eslint --ext .js,.jsx src      # includes the module boundaries
CI=false npm run build
```

CI (`.github/workflows/ci.yml`) runs the same on every push and pull request.

## Configuration

| Variable | Where | Meaning |
|---|---|---|
| `DB_ENGINE` | backend | `sqlite` or `postgres` (default) |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | backend | PostgreSQL connection |
| `REDIS_URL` | backend | Channels layer; in-memory when empty |
| `FRONTEND_URL` | backend | where Stripe sends customers back |
| `STRIPE_*` | backend | Stripe test keys and webhook secret |
| `REACT_APP_API_URL` | frontend | API base, default `http://localhost:8000/api` |
| `REACT_APP_WS_URL` | frontend | WebSocket base, derived from the API URL by default |

`backend/.env.example` lists the rest.
