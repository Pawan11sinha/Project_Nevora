#!/usr/bin/env bash
# Copies the values in deploy-test/.env.test into a deployed test Worker, without printing them.
# Usage: bash tools/set-secrets.sh <worker-name>
set -euo pipefail

worker="${1:?Give the Worker name}"
here="$(cd "$(dirname "$0")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source "$here/.env.test"
set +a

: "${SUPABASE_URL:?Fill in SUPABASE_URL in .env.test}"
: "${SUPABASE_PUBLISHABLE_KEY:?Fill in SUPABASE_PUBLISHABLE_KEY in .env.test}"

cd "$here/opennext"
for name in SUPABASE_URL SUPABASE_PUBLISHABLE_KEY DEPLOY_TEST_TOKEN; do
  printf '%s' "${!name}" | npx wrangler secret put "$name" --name "$worker"
done
