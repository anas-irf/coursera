# Coursera clone

A learning platform with three roles (student, instructor, admin): course
authoring and moderation, enrollment and progress tracking, quizzes and
assignments, direct messaging, notifications and Stripe subscriptions.

```
backend/    Django 5 + DRF + Channels API         (python manage.py ...)
frontend/   React 19 single page application      (npm start)
```

## Quickstart

Backend (no Postgres required):

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows; use `source .venv/bin/activate` elsewhere
pip install -r backend/requirements-dev.txt
cd backend
cp .env.example .env              # DB_ENGINE=sqlite is the default in the example
python manage.py migrate
python manage.py create_test_users
python manage.py runserver        # http://localhost:8000
```

Frontend:

```bash
cd frontend
npm install
npm start                         # http://localhost:3000
```

## Tests

```bash
cd backend
python -m pytest
```

More documentation (architecture, slices, conventions) is added with the
refactor; see `docs/` once it exists.
