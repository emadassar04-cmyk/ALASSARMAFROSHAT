#!/usr/bin/env bash
# بيئة اختبار محلية للوحة الإدارة (لا تلمس Supabase): قاعدة محلية + PostgREST (Docker) + بوابة auth محلية.
# الاستخدام: bash scripts/dev/admin-harness.sh   ثم   node scripts/dev/admin-e2e.mjs
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGPASSWORD="${PGPASSWORD:-postgres}"
PSQL="psql -X -q -v ON_ERROR_STOP=1 -U postgres -h localhost -d alassar_test"
bash supabase/tests/reset_db.sh > /dev/null
$PSQL -f supabase/tests/seed_demo.sql
$PSQL -f scripts/dev/admin-seed.sql
docker rm -f alassar-pgrst > /dev/null 2>&1 || true
docker run -d --name alassar-pgrst --network host \
  -e PGRST_DB_URI="postgres://authenticator:local-authenticator@127.0.0.1:5432/alassar_test" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_SERVER_PORT=3001 \
  -e PGRST_JWT_SECRET="${LOCAL_JWT_SECRET:-local-test-jwt-secret-not-real-0123456789}" \
  postgrest/postgrest:v12.2.3 > /dev/null
for _ in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:3001/ && break; sleep 0.5; done
echo "postgrest ready on :3001"
