#!/usr/bin/env bash
set -euo pipefail

# Test byte-level site equality, differences, and missing/unavailable baseline
# without GitHub API access, a real Next build, or deploying to Pages.
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture_directory="$(mktemp -d)"
trap 'rm -rf "${fixture_directory}"' EXIT
mkdir -p "${fixture_directory}/bin" "${fixture_directory}/out"
ln -s "${repository_root}/scripts" "${fixture_directory}/scripts"
printf 'Hello static export\n' > "${fixture_directory}/out/index.html"

cat > "${fixture_directory}/bin/gh" <<'MOCK_GH'
#!/usr/bin/env bash
if [[ "${MOCK_SCENARIO:-same}" == "api-error" ]]; then
  exit 1
fi
if [[ "${1:-}" == "api" ]]; then
  if [[ "$*" == *"/jobs?"* ]]; then
    printf '1\n'
  else
    printf '123 last-deployed-ancestor\n'
  fi
  exit 0
fi
if [[ "${1:-}" == "run" && "${2:-}" == "download" ]]; then
  if [[ "${MOCK_SCENARIO:-same}" == "missing" ]]; then
    exit 1
  fi
  destination=""
  while (( $# > 0 )); do
    if [[ "$1" == "--dir" ]]; then
      destination="$2"
      break
    fi
    shift
  done
  if [[ -z "${destination}" ]]; then
    exit 2
  fi
  if [[ "${MOCK_SCENARIO:-same}" == "different" ]]; then
    printf 'not the same output\n' > "${destination}/site-output.manifest"
  else
    cp "${RUNNER_TEMP}/site-output.manifest" "${destination}/site-output.manifest"
  fi
  exit 0
fi
exit 2
MOCK_GH

cat > "${fixture_directory}/bin/git" <<'MOCK_GIT'
#!/usr/bin/env bash
[[ "${1:-}" == "merge-base" && "${2:-}" == "--is-ancestor" && "${3:-}" == "last-deployed-ancestor" ]]
MOCK_GIT
chmod +x "${fixture_directory}/bin/"*

run_case() {
  local scenario="$1"
  local expected="$2"
  local temporary_directory="${fixture_directory}/run-${scenario}"
  mkdir -p "${temporary_directory}"
  : > "${temporary_directory}/output"

  (
    cd "${fixture_directory}"
    MOCK_SCENARIO="${scenario}" \
      RUNNER_TEMP="${temporary_directory}" \
      GITHUB_OUTPUT="${temporary_directory}/output" \
      GITHUB_REPOSITORY="paleite/water-sort-puzzle" \
      PATH="${fixture_directory}/bin:${PATH}" \
      bash scripts/ci/compare-site-output.sh
  )

  if [[ "$(cat "${temporary_directory}/output")" != "changed=${expected}" ]]; then
    printf 'Scenario %s expected changed=%s\n' "${scenario}" "${expected}" >&2
    exit 1
  fi
}

run_case same false
run_case different true
run_case missing true
run_case api-error true
echo "Site-output change-detection checks passed."
