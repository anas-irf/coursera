# Continuous integration

Every pull request, and every push to `main`, runs `.github/workflows/ci.yml`. The jobs run in
parallel, only for the areas a change touches, and end in one job, **CI gate**: that is the check to
require on `main`. A pull request also gets one comment with the test report.

```
changes ──┬─ backend-lint ────── ruff, import contracts, Django checks, model drift
          ├─ backend-test ─────── pytest + coverage on Python 3.13 / PostgreSQL 16 and 3.14 / 18
          ├─ frontend ─────────── ESLint, Jest + coverage, production build
          ├─ e2e ──────────────── Playwright specs against the seeded stack
          ├─ workflows ────────── actionlint, zizmor
          ├─ backend-security ─── pip-audit, bandit
          └─ frontend-security ── npm audit of the packages that ship
secrets ───── gitleaks over the commits of the change
dependency-review ── what the pull request adds (pull requests only)
report ────── one test-report comment on the pull request
gate ──────── passes when every job above passed or was skipped on purpose
```

Besides `ci.yml`: `codeql.yml` (code scanning, results under *Security*), `security-audit.yml`
(the dependency audits again every Monday, new advisories do not wait for a code change) and
`dependabot.yml` (weekly grouped update pull requests, 7 days after a release).

## What each job guarantees

| Job | Fails when | Run it locally |
|---|---|---|
| Backend lint and contracts | ruff finds a bug pattern (`F E9 E7 B UP C4 SIM S`, see `backend/ruff.toml`), a slice imports upwards (`lint-imports`), `manage.py check` fails, a model changed without a migration | `cd backend && ruff check apps config tests && lint-imports && python manage.py makemigrations --check --dry-run` |
| Backend tests | a test fails, coverage drops under 90 % (`backend/.coveragerc`), the lines the pull request changes are covered under 85 % (diff coverage), `seed_dev` / `--reset` break on PostgreSQL 18 | `cd backend && python -m pytest --cov` (`TEST_DB_ENGINE=postgres` for PostgreSQL) |
| Frontend | ESLint reports anything (module boundaries included, no warnings allowed), a Jest test fails, coverage drops under the floor in `package.json`, the production build has a warning | `cd frontend && npm run lint && npm run test:ci && npm run build` |
| Browser specs | a spec in `e2e/specs` fails twice (one retry; a spec that only passes on the retry is reported as *flaky*) | see below |
| Workflow lint and security | `actionlint` / shellcheck find an error, `zizmor` finds a medium or worse issue (injection, over-broad permissions, an action not pinned by SHA) | `actionlint` and `zizmor --min-severity medium .` |
| Secret scan | gitleaks finds a credential in the commits of the change (`.gitleaks.toml`) | `gitleaks git --redact .` |
| Backend security | `pip-audit` finds a known vulnerability in `requirements.txt`, `bandit` finds a medium or worse issue | `cd backend && pip-audit -r requirements.txt && bandit -r apps config -ll -x apps/seeding` |
| Frontend security | a package that ships to the browser has a high or critical advisory (the build toolchain is summarised, not gated) | `cd frontend && node ../.github/scripts/audit-runtime-dependencies.mjs` |
| Dependency review | the pull request adds a dependency with a high advisory | – |

Coverage is a floor, not a goal: the backend sits at ~93 %, the frontend at ~14 %. Raise
`fail_under` in `backend/.coveragerc` and `coverageThreshold` in `frontend/package.json` when the
numbers grow; never lower them to make a pull request pass.

## The test report

Every test job writes a [CTRF](https://ctrf.io) JSON report (`pytest-json-ctrf`,
`jest-ctrf-json-reporter`, `playwright-ctrf-json-reporter`). The `report` job gathers them into
one sticky comment on the pull request (summary, per-file results, failures with their stack
trace, flaky and slowest tests) and into the job summary. The comment is updated in place; the job
holds the only write token of the pipeline and runs no repository code. Pull requests from forks
only get the job summary.

## Browser specs

`e2e/` holds Playwright specs that run against the real stack with the development data:
`seed_dev` creates the accounts the specs sign in as (`demo.student@…`, `james.okafor@…`,
`demo.admin@…`, `mei.lin@…`, `noah.bennett@…` and the others listed by `seed_dev --list`).

```bash
# once
cd frontend && npm ci && npm run build          # the specs use the production build
cd ../e2e && npm ci && npx playwright install chromium

# a freshly seeded database (the specs change data, e.g. approve a course)
cd ../backend && python manage.py migrate && python manage.py seed_dev --reset
python manage.py runserver 8000                 # terminal 1
cd ../e2e && npm run serve                      # terminal 2: serves frontend/build on :3000
SEED_PASSWORD=<the seeded password> npm test    # terminal 3 (SEED_PASSWORD is in backend/.env)
npm run report                                  # open the HTML report of the last run
```

Rules the specs follow:

* **Few, and about user-visible flows.** Logic belongs in pytest / Jest; a browser spec exists for
  what only a browser proves (sign in, role guards, a page shows the numbers of the seeded world,
  an action changes what the next page shows).
* **They describe the seed.** Expected numbers come from `apps/seeding/data`; a change there that
  moves a number is a change to the spec in the same pull request.
* **Order matters, data is shared.** One worker, files in alphabetical order, one seeded database.
  A spec that changes data (approving a course) says so and picks data no other spec reads. To run
  the suite again locally, reseed first (`seed_dev --reset`).
* **No assumption about list order.** PostgreSQL and SQLite order NULLs differently (a course that
  was never visited comes first on PostgreSQL), and CI runs on PostgreSQL: find a card by its title,
  not by its position.
* **Evidence on failure.** CI keeps the HTML report, a trace and a video of every failed spec as the
  `playwright-evidence` artifact for 14 days.

## Reading a red pull request

1. Open the **CI gate** job summary: it lists every job and its result.
2. The failed job's own summary has the coverage table or the audit result; the test report comment
   has the failing test with its stack trace.
3. For a browser spec download `playwright-evidence` and run
   `npx playwright show-trace <trace.zip>` in `e2e/`.

## Pipeline rules

* Workflow permissions are `contents: read`; a job asks for more only where it needs it.
* Third-party actions are pinned by commit SHA with the version in a comment; Dependabot moves both.
* Untrusted values (`github.event.*`, matrix values in shell) reach scripts through `env:`, never
  through `${{ }}` inside `run:`.
* Every job has a `timeout-minutes`; a new pull request run cancels the previous one.
* Changing `ci.yml`, its actions or scripts runs every area, so the pipeline is tested by itself.

## Settings only an admin can change

On GitHub (*Settings → Branches → Branch protection rule for `main`*): require a pull request,
require the status check **CI gate** (and nothing else: job names may change, the gate stays),
require branches to be up to date. Optionally require the **CodeQL** checks as well.

*Settings → Security*: switch on the **dependency graph** (the *Dependency review* job warns and
skips itself until it is on) and Dependabot alerts.
