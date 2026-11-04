#!/usr/bin/env bash
set -euo pipefail

# Compare the exact emitted Next.js static-export files (paths + SHA-256
# content hashes) to the latest *successfully deployed* site. Never skip a
# deployment if we cannot establish a trustworthy prior manifest.
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

if [[ ! -d out ]]; then
  echo "::error::Next.js export directory 'out' was not generated."
  exit 1
fi

current_manifest="${RUNNER_TEMP}/site-output.manifest"
(
  cd out
  find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum
) > "${current_manifest}"

changed=true
if deployed_run="$(bash scripts/ci/find-last-successful-deployment.sh)"; then
  read -r run_id deployed_commit <<< "${deployed_run}"
  previous_directory="${RUNNER_TEMP}/last-deployed-site"
  mkdir -p "${previous_directory}"

  if gh run download "${run_id}" \
    --repo "${GITHUB_REPOSITORY}" \
    --name "site-output-manifest" \
    --dir "${previous_directory}"; then
    previous_manifest="${previous_directory}/site-output.manifest"
    if [[ -f "${previous_manifest}" ]] && cmp -s "${current_manifest}" "${previous_manifest}"; then
      echo "The exported site is byte-for-byte unchanged from deployed commit ${deployed_commit}."
      changed=false
    else
      echo "The exported site has changed since deployed commit ${deployed_commit}."
    fi
  else
    echo "::warning::Previous site manifest is unavailable; deploying to be safe."
  fi
else
  echo "::warning::No confirmed prior successful deployment; deploying to be safe."
fi

printf 'changed=%s\n' "${changed}" >> "${GITHUB_OUTPUT}"
if [[ "${changed}" == "true" ]]; then
  echo "Deployment required."
else
  echo "Deployment skipped; generated site content is unchanged."
fi
