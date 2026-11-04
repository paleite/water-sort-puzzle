#!/usr/bin/env bash
set -euo pipefail

# Simulate one successful deploy behind an irrelevant newer workflow run.
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture_directory="$(mktemp -d)"
trap 'rm -rf "${fixture_directory}"' EXIT
mkdir -p "${fixture_directory}/bin"

cat > "${fixture_directory}/bin/gh" <<'MOCK_GH'
#!/usr/bin/env bash
if [[ "${MOCK_GH_MODE:-success}" == "unavailable" ]]; then
  exit 1
fi
if [[ "${MOCK_GH_MODE:-success}" == "empty" ]]; then
  exit 0
fi
if [[ "$*" == *"/jobs?"* ]]; then
  if [[ "$*" == *"/100/jobs?"* ]]; then
    printf '0\n' # Successful workflow but deploy was skipped.
  else
    printf '1\n' # Deploy actually succeeded.
  fi
else
  printf '%s\n' "100 skipped-deploy" "101 last-deployed-ancestor"
fi
MOCK_GH

cat > "${fixture_directory}/bin/git" <<'MOCK_GIT'
#!/usr/bin/env bash
if [[ "${1:-}" != "merge-base" || "${2:-}" != "--is-ancestor" ]]; then
  exit 2
fi
[[ "${3:-}" == "last-deployed-ancestor" || "${3:-}" == "skipped-deploy" ]]
MOCK_GIT

cat > "${fixture_directory}/bin/pnpm" <<'MOCK_PNPM'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${MOCK_PNPM_LOG}"
MOCK_PNPM
chmod +x "${fixture_directory}/bin/"*

run_case() {
  local scenario="$1"
  local expected="$2"
  : > "${fixture_directory}/invocations"

  MOCK_GH_MODE="${scenario}" \
    MOCK_PNPM_LOG="${fixture_directory}/invocations" \
    GITHUB_REPOSITORY="paleite/water-sort-puzzle" \
    PATH="${fixture_directory}/bin:${PATH}" \
    bash "${repository_root}/scripts/water-sort/verify-since-last-deploy.sh"

  local actual
  actual="$(cat "${fixture_directory}/invocations")"
  if [[ "${actual}" != "${expected}" ]]; then
    printf 'Scenario %s: expected <%s>, got <%s>\n' "${scenario}" "${expected}" "${actual}" >&2
    exit 1
  fi
}

run_case success "run verify:levels --changed-from last-deployed-ancestor"
run_case unavailable "run verify:levels"
run_case empty "run verify:levels"

echo "Deployment baseline selection checks passed."
