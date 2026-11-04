#!/usr/bin/env bash
set -euo pipefail

# Print "<run-id> <commit-sha>" for the latest successfully deployed main
# revision that is an ancestor of the current checkout. Successful builds
# where deploy was skipped are deliberately excluded.
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
maximum_pages=10

for ((page_number = 1; page_number <= maximum_pages; page_number++)); do
  query="repos/${repository}/actions/workflows/deploy.yml/runs?branch=main&status=success&per_page=100&page=${page_number}"
  if ! candidates="$(gh api --method GET "${query}" --jq '.workflow_runs[] | select(.event == "push" or .event == "workflow_dispatch") | "\(.id) \(.head_sha)"')"; then
    exit 1
  fi

  if [[ -z "${candidates}" ]]; then
    break
  fi

  while read -r run_id commit_sha; do
    if [[ -z "${run_id}" || -z "${commit_sha}" ]]; then
      continue
    fi

    if ! git merge-base --is-ancestor "${commit_sha}" HEAD; then
      continue
    fi

    # A successful workflow can have a skipped deploy job. It must not
    # become the output or level-verification baseline.
    if ! deployed="$(gh api --method GET "repos/${repository}/actions/runs/${run_id}/jobs?per_page=100" --jq '[.jobs[] | select(.name == "deploy" and .conclusion == "success")] | length')"; then
      exit 1
    fi
    if [[ "${deployed}" =~ ^[0-9]+$ ]] && (( deployed > 0 )); then
      printf '%s %s\n' "${run_id}" "${commit_sha}"
      exit 0
    fi
  done <<< "${candidates}"
done

exit 1
