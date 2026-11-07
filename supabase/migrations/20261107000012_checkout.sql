-- =====================================================================
-- 0012 إتمام الطلب: حساب ملخص الطلب قبل الإرسال، الحد من الطلبات، تعليمات التحويل البنكي
-- =====================================================================

-- ---------------------------------------------------------------------
-- الحد من التكرار (rate limiting) بنافذة زمنية ثابتة، يُستدعى من خادم Next.js فقط.
-- المفتاح يُمرَّر مجزأً (لا نخزن عناوين IP صريحة).
-- ---------------------------------------------------------------------
create table private.rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  hits          integer not null
);

create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
begin
  if not private.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into private.rate_limits as r (key, window_start, hits)
  values (left(p_key, 200), now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  -- تنظيف خفيف للمفاتيح القديمة
  delete from private.rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_limit;
end $$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- ملخص الطلب قبل الإرسال (لا يكتب ولا يحجز شيئاً). نفس قواعد التسعير في place_order،
-- لكنه يُرجع مشكلات كل بند بدلاً من رفض الطلب كاملاً. place_order يبقى المرجع النهائي.
-- ---------------------------------------------------------------------
create or replace function public.quote_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lines     jsonb := '[]';
  v_subtotal  numeric(12,2) := 0;
  v_discount  numeric(12,2) := 0;
  v_fee       numeric(12,2) := 0;
  v_zone      public.delivery_zones;
  v_customer  uuid;
  v_coupon    jsonb := null;
  v_problem   text;
  v_detail    text;
  r           record;
begin
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') > 50 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for r in
    select x.variant_id, sum(x.quantity)::integer as qty
      from jsonb_to_recordset(p->'items') as x(variant_id uuid, quantity integer)
     where x.variant_id is not null
     group by x.variant_id order by x.variant_id
  loop
    select case
             when v.id is null or not v.is_active or pr.status <> 'active' then 'unavailable'
             when pr.requires_measurement then 'requires_measurement'
             when r.qty is null or r.qty <= 0 or r.qty > 100 then 'invalid_quantity'
             when pr.availability_mode not in ('stock', 'made_to_order') then 'unavailable'
             when pr.availability_mode = 'stock'
              and coalesce((select sum(i.on_hand - i.reserved) from public.inventory i
                             where i.variant_id = v.id and i.branch_id = private.default_branch_id()), 0) < r.qty
               then 'insufficient_stock'
           end
      into v_problem
      from (select r.variant_id as id) req
      left join public.product_variants v on v.id = req.id
      left join public.products pr on pr.id = v.product_id;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', r.variant_id, 'quantity', r.qty,
      'unit_price', case when v_problem is null then private.effective_unit_price(r.variant_id) end,
      'line_total', case when v_problem is null then private.effective_unit_price(r.variant_id) * r.qty end,
      'problem', v_problem));
    if v_problem is null then
      v_subtotal := v_subtotal + private.effective_unit_price(r.variant_id) * r.qty;
    end if;
  end loop;

  if p->>'fulfillment' = 'delivery' and coalesce(p->>'delivery_zone_id', '') <> '' then
    select * into v_zone from public.delivery_zones where id = (p->>'delivery_zone_id')::uuid and is_active;
    v_fee := coalesce(v_zone.fee, 0);
  end if;

  if coalesce(trim(p->>'coupon_code'), '') <> '' then
    select id into v_customer from public.customers where phone = private.normalize_phone(p->>'phone');
    begin
      select e.discount into v_discount from private.evaluate_coupon(p->>'coupon_code', v_customer, v_subtotal) e;
      v_coupon := jsonb_build_object('valid', true, 'code', upper(trim(p->>'coupon_code')), 'discount', v_discount);
    exception when others then
      get stacked diagnostics v_detail = pg_exception_detail;
      v_discount := 0;
      v_coupon := jsonb_build_object('valid', false, 'code', upper(trim(p->>'coupon_code')), 'reason', coalesce(nullif(v_detail, ''), 'invalid'));
    end;
  end if;

  return jsonb_build_object(
    'lines', v_lines, 'subtotal', v_subtotal, 'discount', v_discount, 'delivery_fee', v_fee,
    'total', v_subtotal - v_discount + v_fee, 'coupon', v_coupon,
    'reservation_minutes', (select reservation_minutes from public.store_settings));
end $$;
revoke all on function public.quote_order(jsonb) from public;
grant execute on function public.quote_order(jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- التحويل البنكي: بيانات الحساب تُرسل للزبون عبر WhatsApp (قرار المدير)، لا تُعرض في الموقع
-- ---------------------------------------------------------------------
update public.payment_methods
   set instructions = 'بعد إرسال الطلب سنتواصل معك عبر WhatsApp ونرسل لك بيانات الحساب البنكي. لا يُعتمد الدفع إلا بعد مراجعة التحويل.'
 where code = 'bank_transfer';
update public.payment_methods
   set instructions = 'تدفع نقداً للمندوب عند استلام الطلب.' where code = 'cash_on_delivery';
update public.payment_methods
   set instructions = 'تستلم طلبك من المحل وتدفع نقداً هناك.' where code = 'cash_in_store';
