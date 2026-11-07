#!/usr/bin/env bash
# تشغيل اختبارات End-to-End كاملة على نسخة محلية معزولة (لا تلمس Supabase).
# الترتيب مهم: إعادة القاعدة → البيانات التجريبية → البناء (يلتقط البيانات) → التشغيل → الاختبار.
# يتطلب: PostgreSQL محلي، وخادم scripts/dev/local-api.mjs يعمل على المنفذ 54321.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGPASSWORD="${PGPASSWORD:-postgres}"
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-test-key
export SUPABASE_SERVICE_ROLE_KEY=local-service-key
export ORDER_RATE_LIMIT_PER_IP=50

pkill -f next-server || true
bash supabase/tests/reset_db.sh > /dev/null
psql -X -q -v ON_ERROR_STOP=1 -U postgres -h localhost -d alassar_test -f supabase/tests/seed_demo.sql
npx next build > /tmp/e2e-build.log 2>&1 || { tail -30 /tmp/e2e-build.log; exit 1; }
npx next start -p 3100 > /tmp/e2e-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null http://localhost:3100/ && break; sleep 1; done

export NODE_PATH="$(npm root -g)"
status=0
node scripts/dev/storefront-e2e.mjs "${1:-}" || status=1
node scripts/dev/checkout-e2e.mjs || status=1
exit $status
