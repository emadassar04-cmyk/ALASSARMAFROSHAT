#!/usr/bin/env bash
# يعيد إنشاء قاعدة الاختبار المحلية ويطبق المحاكاة ثم كل migrations
set -euo pipefail
DB=${TEST_DB:-alassar_test}
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="psql -X -q -v ON_ERROR_STOP=1 -U postgres -h ${PGHOST:-localhost}"
$PSQL -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
$PSQL -d "$DB" -f "$DIR/tests/00_supabase_shim.sql"
for f in "$DIR"/migrations/*.sql; do
  case "$f" in *_cron.sql|*_storage.sql|*_storage_select_media_audit.sql) continue;; esac   # pg_cron غير متوفر محلياً
  $PSQL -d "$DB" -f "$f"
done
echo "db ready: $DB"
