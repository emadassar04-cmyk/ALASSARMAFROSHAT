#!/usr/bin/env bash
# اختبارات التزامن الحقيقية: عمليات psql متوازية على قاعدة اختبار محلية.
set -euo pipefail
DB=${TEST_DB:-alassar_test}
DIR="$(cd "$(dirname "$0")" && pwd)"
PSQL="psql -X -q -t -A -U postgres -h ${PGHOST:-localhost} -d $DB"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fail() { echo "FAIL: $*"; exit 1; }
pass() { echo "PASS: $*"; }

"$DIR/reset_db.sh" >/dev/null

$PSQL -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
update public.store_settings set is_published = true;
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.profiles (id, role_id) select '00000000-0000-0000-0000-00000000000a', id from public.roles where code='owner';
insert into public.products (id, slug, name, unit_id, status, price)
  values ('a0000000-0000-0000-0000-000000000001', 'آخر-قطعة', 'آخر قطعة', 1, 'active', 100),
         ('a0000000-0000-0000-0000-000000000002', 'مخزون-10', 'مخزون عشرة', 1, 'active', 10);
insert into public.product_variants (id, product_id, is_default)
  values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', true),
         ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', true);
update public.inventory set on_hand = 1  where variant_id = 'b0000000-0000-0000-0000-000000000001';
update public.inventory set on_hand = 10 where variant_id = 'b0000000-0000-0000-0000-000000000002';
SQL

order_sql() { # $1 = phone suffix, $2 = variant, $3 = qty
  cat <<SQL
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select public.place_order('{"customer_name":"عميل $1","phone":"0599$1","fulfillment":"pickup",
  "payment_method":"cash_in_store","terms_accepted":true,
  "items":[{"variant_id":"$2","quantity":$3}]}')->>'order_number';
SQL
}

# ---- 1) 30 طلباً متزامناً على آخر قطعة ----
for i in $(seq 10 39); do
  ( order_sql "${i}0000" b0000000-0000-0000-0000-000000000001 1 | $PSQL >"$TMP/a$i.out" 2>"$TMP/a$i.err" || true ) &
done
wait
ok=$(grep -l 'ALS-' "$TMP"/a*.out | wc -l)
rej=$(grep -l 'insufficient_stock' "$TMP"/a*.err | wc -l)
[ "$ok" -eq 1 ] || fail "آخر قطعة: نجح $ok طلب بدلاً من 1"
[ "$rej" -eq 29 ] || fail "آخر قطعة: رُفض $rej بدلاً من 29"
inv=$($PSQL -c "select on_hand||'/'||reserved from public.inventory where variant_id='b0000000-0000-0000-0000-000000000001'")
[ "$inv" = "1/1" ] || fail "آخر قطعة: المخزون $inv"
pass "30 طلباً متزامناً على آخر قطعة: نجح طلب واحد فقط، ورُفض 29، والمخزون 1/محجوز 1"

# ---- 2) 25 طلباً متزامناً بكمية 1 على مخزون 10 ----
for i in $(seq 40 64); do
  ( order_sql "${i}0000" b0000000-0000-0000-0000-000000000002 1 | $PSQL >"$TMP/b$i.out" 2>"$TMP/b$i.err" || true ) &
done
wait
ok=$(grep -l 'ALS-' "$TMP"/b*.out | wc -l)
res=$($PSQL -c "select reserved from public.inventory where variant_id='b0000000-0000-0000-0000-000000000002'")
[ "$ok" -eq 10 ] && [ "$res" -eq 10 ] || fail "مخزون 10: نجح $ok، المحجوز $res"
pass "25 طلباً متزامناً على مخزون 10: نجح 10 بالضبط والمحجوز 10 (لا بيع زائد)"

# ---- 3) تحرير متزامن للحجوزات المنتهية من 6 عمليات ----
$PSQL -c "update public.orders set reservation_expires_at = now() - interval '1 minute' where status = 'received'" >/dev/null
for i in 1 2 3 4 5 6; do
  ( $PSQL -c "set role service_role; select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false) is not null;
     select public.release_expired_reservations();" | tail -1 >"$TMP/r$i.out" 2>&1 || true ) &
done
wait
total=$(cat "$TMP"/r*.out | awk "{s+=\$1} END {print s}")
inv=$($PSQL -c "select string_agg(reserved::text, ',' order by variant_id) from public.inventory")
mv=$($PSQL -c "select count(*) from public.inventory_movements where kind='release'")
[ "$total" -eq 11 ] || fail "التحرير المتزامن: حُرر $total طلب بدلاً من 11"
[ "$inv" = "0,0" ] || fail "التحرير المتزامن: المحجوز $inv"
[ "$mv" -eq 11 ] || fail "التحرير المتزامن: $mv حركة بدلاً من 11"
pass "6 عمليات تحرير متزامنة: حُرر كل حجز مرة واحدة فقط (11 طلباً، 11 حركة، المحجوز 0)"

# ---- 4) تأكيد وإلغاء متزامنان على الطلب نفسه ----
oid=$(order_sql 990000 b0000000-0000-0000-0000-000000000002 3 | $PSQL | tail -1)
id=$($PSQL -c "select id from public.orders where order_number='$oid'")
ADMIN="set role authenticated; select set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"00000000-0000-0000-0000-00000000000a\",\"aal\":\"aal2\"}',false) is not null;"
( $PSQL -c "$ADMIN select 'DONE:' || (public.confirm_order('$id')).status;" >"$TMP/c1.out" 2>&1 || true ) &
( $PSQL -c "$ADMIN select 'DONE:' || (public.cancel_order('$id', 'race')).status;" >"$TMP/c2.out" 2>&1 || true ) &
wait
c1=$(grep -c '^DONE:' "$TMP"/c1.out || true); c2=$(grep -c '^DONE:' "$TMP"/c2.out || true)
mv=$($PSQL -c "select count(*) filter (where kind='sale_online')||'/'||count(*) filter (where kind='cancellation_restock')||'/'||count(*) filter (where kind='release') from public.inventory_movements where order_id='$id'")
inv=$($PSQL -c "select on_hand||'/'||reserved from public.inventory where variant_id='b0000000-0000-0000-0000-000000000002'")
st=$($PSQL -c "select status from public.orders where id='$id'")
# مساران صحيحان فقط (الطلب مقفل أثناء كل عملية):
#  أ) الإلغاء أولاً: يُحرَّر الحجز ويفشل التأكيد   -> حركات 0/0/1
#  ب) التأكيد أولاً: خصم نهائي ثم إلغاء يعيد الكمية -> حركات 1/1/0
[ "$c2" -eq 1 ] || fail "الإلغاء يجب أن ينجح في المسارين"
[ "$st" = "cancelled" ] && [ "$inv" = "10/0" ] || fail "الحالة $st والمخزون $inv"
if [ "$c1" -eq 1 ]; then [ "$mv" = "1/1/0" ] || fail "مسار التأكيد أولاً: الحركات $mv"
else [ "$mv" = "0/0/1" ] || fail "مسار الإلغاء أولاً: الحركات $mv"; fi
pass "تأكيد وإلغاء متزامنان: تسلسل صحيح (تأكيد=$c1، إلغاء=$c2، حركات $mv) والمخزون 10/0 دون تكرار"

echo "ALL CONCURRENCY TESTS PASSED"
