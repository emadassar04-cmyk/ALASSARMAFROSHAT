#!/usr/bin/env bash
# بناء وتشغيل نسخة محلية من الموقع موصولة ببيئة اختبار الإدارة (admin-harness.sh + admin-gateway.mjs)
set -euo pipefail
cd "$(dirname "$0")/../.."
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54322
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-test-key
export SUPABASE_SERVICE_ROLE_KEY=local-service-key
[ -d .next/cache ] && find .next/cache -mindepth 1 -delete
npx next build > /tmp/admin-build.log 2>&1 || { tail -40 /tmp/admin-build.log; exit 1; }
echo "build ok"
