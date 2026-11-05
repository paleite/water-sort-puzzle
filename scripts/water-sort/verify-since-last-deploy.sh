#!/usr/bin/env bash
set -euo pipefail

# Only successfully deployed, ancestral revisions are valid baselines.
# Workflow runs that skipped deployment do not advance the baseline.
# If history cannot be established, re-verify every level (fail closed).
if deployed_run="$(bash scripts/ci/find-last-successful-deployment.sh)"; then
  read -r run_id baseline <<< "${deployed_run}"
  echo "Checking levels changed since successful deployment ${run_id}: ${baseline}..HEAD"
  pnpm run verify:levels --changed-from "${baseline}"
else
  echo "::warning::Cannot establish last successful deployment; verifying all levels."
  pnpm run verify:levels
fi
