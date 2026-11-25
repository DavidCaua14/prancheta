#!/usr/bin/env bash
# Publica as Edge Functions no Supabase pela Management API.
# Uso: SUPABASE_ACCESS_TOKEN=sbp_... npm run fn:deploy
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-sochoqusshdywnbqvzxv}"
: "${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN}"
cd "$(dirname "$0")/.."
node scripts/fn-build.mjs
for fn in close-league close-cup; do
  curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/$REF/functions/deploy?slug=$fn" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -F "metadata={\"entrypoint_path\":\"index.js\",\"name\":\"$fn\",\"verify_jwt\":false};type=application/json" \
    -F "file=@supabase/functions/$fn/dist/index.js;filename=index.js;type=application/javascript"
  echo
done
