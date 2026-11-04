#!/usr/bin/env bash
set -euo pipefail

# Compare HEAD with the most recent successful main deployment that is an
# ancestor of HEAD. Unlike github.event.before, this includes changes from
# failed, canceled, or superseded pushes.
#
# A successful deploy.yml workflow means BOTH build and deploy jobs completed.
# Never fall back to the immediately previous push: if the API is unavailable
# or no usable deployment exists, recheck all levels instead.
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
workflow="deploy.yml"
maximum_pages=10
baseline=""

for ((page_number = 1; page_number <= maximum_pages; page_number++)); do
  query="repos/${repository}/actions/workflows/${workflow}/runs?branch=main&status=success&per_page=100&page=${page_number}"

  if ! deployed_commits="$(gh api --method GET "${query}" --jq '.workflow_runs[] | select(.event == "push" or .event == "workflow_dispatch") | .head_sha')"; then
    echo "::warning::Cannot query successful deploy runs; verifying all levels."
    pnpm run verify:levels
    exit $?
  fi

  if [[ -z "${deployed_commits}" ]]; then
    break
  fi

  while IFS= read -r deployed_commit; do
    if [[ -n "${deployed_commit}" ]] && git merge-base --is-ancestor "${deployed_commit}" HEAD; then
      baseline="${deployed_commit}"
      break
    fi
  done <<< "${deployed_commits}"

  if [[ -n "${baseline}" ]]; then
    break
  fi
done

if [[ -z "${baseline}" ]]; then
  echo "::warning::No ancestor with a successful deployment found; verifying all levels."
  pnpm run verify:levels
else
  echo "Checking levels changed since last successful deployment: ${baseline}..HEAD"
  pnpm run verify:levels --changed-from "${baseline}"
fi
