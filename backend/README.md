# Backend

Django 5 + Django REST framework + Channels API of the platform in the repository root. The slices, their
rules and how they talk to each other are described in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md);
how code is written here in [`../docs/CONVENTIONS.md`](../docs/CONVENTIONS.md).

```
apps/<slice>/   accounts, assessments, billing, certificates, content, core, courses, insights,
                learning, messaging, notifications  (+ seeding: development tooling)
config/         settings (base, dev, prod, test), urls, asgi, wsgi
tests/          HTTP-level tests, the route table and the OpenAPI contract of v1
```

## Settings

| Module | Used by | What it is |
|---|---|---|
| `config.settings.base` | everything | the shared configuration; no development convenience, no secrets |
| `config.settings.dev` | `manage.py` | safe local defaults (a development key, localhost origins), `DEBUG` on, installs `daphne` and the seeding tools |
| `config.settings.prod` | `wsgi.py`, `asgi.py` | what a deployment must supply; refuses to start and names every missing variable |
| `config.settings.test` | pytest | SQLite by default, throttles off, fake secrets, a throw-away `MEDIA_ROOT`, the schema generator |

Variables are read through `config/settings/env.py` and documented in [`.env.example`](.env.example)
(`tests/test_env_example.py` keeps the file and the code in step). A real environment variable always wins
over `.env`.

## Running

```bash
python -m venv ../.venv && source ../.venv/bin/activate     # Windows: ..\.venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                         # DB_ENGINE=sqlite for a zero-setup database
python manage.py migrate
python manage.py seed_dev                                    # a cast, a catalogue and months of activity
python manage.py runserver                                   # HTTP and WebSockets on :8000
```

Management commands worth knowing:

| Command | What it does |
|---|---|
| `seed_dev [--reset] [--list]` | development data played through the services (see `docs/ARCHITECTURE.md`) |
| `create_dev_database` | creates the PostgreSQL role and database named in `.env` |
| `create_subscription_plans` | writes the Coursera Plus plans from `apps/billing/plans.py` |
| `calculate_earnings [--month YYYY-MM] [--dry-run]` | records the instructors' earnings of a finished month (schedule: first of the month) |
| `issue_certificates [--dry-run] [--notify]` | issues the certificates that completed, passed enrolments earned before certificates existed |
| `clean_reading_html [--dry-run]` | sanitises readings stored before HTML was sanitised on write |

## Checks

```bash
python -m pytest --cov                       # SQLite; TEST_DB_ENGINE=postgres for PostgreSQL
ruff check apps config tests                 # rules and docstrings: ruff.toml
lint-imports                                 # slices, layers, no HTTP in the domain: .importlinter
python manage.py makemigrations --check --dry-run
DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check --deploy   # with a production env
```

Two files are contracts, regenerated deliberately and reviewed in the diff:

```bash
UPDATE_ROUTES=1 python -m pytest tests/test_routes.py      # tests/routes.expected.txt
UPDATE_OPENAPI=1 python -m pytest tests/test_openapi.py    # tests/openapi.v1.yaml
```

`tests/openapi.v1.yaml` is the OpenAPI document of `/api/v1/` (every path and method, path parameters,
authentication, and the bodies wherever a serializer defines them). v1 is frozen: it may grow, never
shrink or change type.

## Pointers

* **Errors**: `apps/core/api/errors.py` (`ServiceError`, the exception handler).
* **Domain events**: `apps/core/events.py`; receivers in `notifications/receivers.py` and
  `certificates/receivers.py`.
* **Lecture types**: `apps/courses/extensions.py` (registry) with handlers in `assessments` and `content`
  (`course_extensions.py`).
* **Sessions**: `apps/accounts/authentication.py` and `cookies.py`; WebSocket authentication in
  `apps/messaging/middleware.py`.
* **Money**: `apps/billing/plans.py` (prices), `services/subscriptions.py` (webhook handlers),
  `services/earnings.py` (the pool), `apps/insights/services/earnings.py` (the monthly calculation).
