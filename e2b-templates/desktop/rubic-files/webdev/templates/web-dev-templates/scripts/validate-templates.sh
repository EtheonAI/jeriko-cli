#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
TEMPLATES=(web-db-user web-static)

create_env_file() {
  local template="$1"
  local dir="$2"

  case "$template" in
    web-basic)
      cat >"${dir}/.env" <<'ENV'
VITE_APP_TITLE="Web App"
VITE_ANALYTICS_ENDPOINT=""
VITE_ANALYTICS_WEBSITE_ID=""
ENV
      ;;
    web-db)
      cat >"${dir}/.env" <<'ENV'
VITE_APP_TITLE="Web App"
VITE_ANALYTICS_ENDPOINT=""
VITE_ANALYTICS_WEBSITE_ID=""
DATABASE_URL="mysql://user:password@127.0.0.1:3306/app"
ENV
      ;;
    web-db-user)
      cat >"${dir}/.env" <<'ENV'
VITE_APP_TITLE="Web App"
VITE_APP_LOGO="https://placehold.co/64x64"
VITE_APP_ID="app_dev_123"
VITE_OAUTH_PORTAL_URL="https://auth.example.com"
VITE_ANALYTICS_ENDPOINT=""
VITE_ANALYTICS_WEBSITE_ID=""
DATABASE_URL="mysql://user:password@127.0.0.1:3306/app"
JWT_SECRET="dev-secret-key-with-least-32-chars"
OAUTH_SERVER_URL="https://api.example.com"
ENV
      ;;
    web-static)
      cat >"${dir}/.env" <<'ENV'
VITE_APP_TITLE="Static Site"
VITE_APP_LOGO="https://placehold.co/64x64"
VITE_APP_ID="app_dev_123"
VITE_OAUTH_PORTAL_URL="https://auth.example.com"
VITE_ANALYTICS_ENDPOINT=""
VITE_ANALYTICS_WEBSITE_ID=""
ENV
      ;;
  esac
}

run_script_exists() {
  local dir="$1"
  local script_name="$2"
  node -e "const pkg=require('${dir}/package.json'); const scripts=pkg.scripts||{}; process.exit(scripts['${script_name}'] ? 0 : 1);" >/dev/null 2>&1
}

for template in "${TEMPLATES[@]}"; do
  TEMPLATE_DIR="${ROOT_DIR}/templates/${template}"
  create_env_file "${template}" "${TEMPLATE_DIR}"
  rm -rf "${TEMPLATE_DIR}/node_modules"
  echo "\n=== ${template}: installing dependencies ==="
  (cd "${TEMPLATE_DIR}" && pnpm install --no-frozen-lockfile)

  echo "=== ${template}: running build ==="
  (cd "${TEMPLATE_DIR}" && pnpm run build)

  if run_script_exists "${TEMPLATE_DIR}" check; then
    echo "=== ${template}: running type check ==="
    (cd "${TEMPLATE_DIR}" && pnpm run check)
  fi

  if run_script_exists "${TEMPLATE_DIR}" test; then
    echo "=== ${template}: running tests ==="
    (cd "${TEMPLATE_DIR}" && pnpm run test --passWithNoTests)
  fi
  
  echo "=== ${template}: skipped long-running dev server sanity check ==="
done

echo "\nAll templates passed install/build/check/test verification (dev server check skipped)."
