#!/usr/bin/env bash
# Decides which parts of the pipeline a change needs and writes them to $GITHUB_OUTPUT.
#
# A pull request runs what its diff touches; pushes to main and manual runs run
# everything. A change to the pipeline itself (the workflow, its actions and
# scripts) counts as touching every area.
set -euo pipefail

: "${EVENT:?}" "${GITHUB_OUTPUT:?}" "${GITHUB_STEP_SUMMARY:?}"

if [ "$EVENT" = "pull_request" ]; then
  : "${BASE_SHA:?}"
  files="$(git diff --name-only "${BASE_SHA}...HEAD")"
else
  files="ALL"
fi

touches() {
  [ "$files" = "ALL" ] && return 0
  printf '%s\n' "$files" | grep -Eq "$1"
}

PIPELINE='^\.github/(workflows/ci\.yml|actions/|scripts/|matchers/)'

report() {
  local name="$1" pattern="$2" value=false
  if touches "$PIPELINE" || touches "$pattern"; then value=true; fi
  echo "${name}=${value}" >> "$GITHUB_OUTPUT"
  echo "| ${name} | ${value} |" >> "$GITHUB_STEP_SUMMARY"
}

{
  echo "### Areas this change touches"
  echo
  echo "| area | runs |"
  echo "|---|---|"
} >> "$GITHUB_STEP_SUMMARY"

report backend '^backend/'
report frontend '^frontend/'
report e2e '^(backend|frontend|e2e)/'
report workflows '^\.github/'
report dependencies '^(backend/requirements[^/]*\.txt|((frontend|e2e)/)?(package\.json|pnpm-lock\.yaml))$'
