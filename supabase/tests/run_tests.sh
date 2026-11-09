#!/usr/bin/env bash
# يشغل كل اختبارات قاعدة البيانات على PostgreSQL محلي (لا يلمس Supabase).
# الاستخدام: PGPASSWORD=... ./supabase/tests/run_tests.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DB=${TEST_DB:-alassar_test}
"$DIR/reset_db.sh" >/dev/null
out=$(psql -X -t -U postgres -h "${PGHOST:-localhost}" -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/10_core.sql" -f "$DIR/15_staff_auth.sql" -f "$DIR/16_catalog.sql" -f "$DIR/17_admin_catalog.sql" -f "$DIR/18_checkout.sql" -f "$DIR/19_notifications.sql" -f "$DIR/20_finance.sql" -f "$DIR/21_marketing.sql" 2>&1) || {
  echo "$out" | grep -E 'FAIL|ERROR' ; exit 1; }
echo "$out" | grep -oE 'PASS: [^(]*' | sed 's/ *$//'
echo "core: $(echo "$out" | grep -c 'PASS:') passed"
"$DIR/20_concurrency.sh"
