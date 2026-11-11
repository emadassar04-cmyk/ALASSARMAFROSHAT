#!/usr/bin/env bash
# اختبار مساعد العصار محلياً: قاعدة الاختبار + local-api (:54321) + مزود وهمي (:54400). لا مفاتيح حقيقية.
# مزودان مضبوطان: gemini (نموذج "fail" لاختبار الانتقال) ثم groq (نموذجه الافتراضي مرفوض، فيُختار نموذج متاح تلقائياً).
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGPASSWORD="${PGPASSWORD:-postgres}"
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-test-key SUPABASE_SERVICE_ROLE_KEY=local-service-key
export GEMINI_API_KEY=mock-secret-gemini AI_BASE_URL_GEMINI=http://localhost:54400/v1 AI_MODEL_GEMINI=fail
export GROQ_API_KEY=mock-secret-groq AI_BASE_URL_GROQ=http://localhost:54400/v1  # النموذج الافتراضي يُرفض ← اختيار تلقائي
export AI_PROVIDER_ORDER=gemini,groq
pkill -f next-server || true
bash supabase/tests/reset_db.sh > /dev/null
psql -X -q -v ON_ERROR_STOP=1 -U postgres -h localhost -d alassar_test -f supabase/tests/seed_demo.sql
node scripts/dev/mock-llm.mjs > /tmp/mock-llm.log 2>&1 &
MOCK=$!
[ -d .next/cache ] && find .next/cache -mindepth 1 -delete
npx next build > /tmp/chat-build.log 2>&1 || { tail -30 /tmp/chat-build.log; kill $MOCK; exit 1; }
npx next start -p 3100 > /tmp/chat-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER $MOCK 2>/dev/null; pkill -f next-server 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null http://localhost:3100/ && break; sleep 1; done
NODE_PATH="$(npm root -g)" node scripts/dev/chat-e2e.mjs
