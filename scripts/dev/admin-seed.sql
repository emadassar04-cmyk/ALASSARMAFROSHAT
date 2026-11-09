-- بيانات اختبار محلية للوحة الإدارة فقط (قاعدة alassar_test). لا تُطبق على Supabase أبداً.
-- موظفون تجريبيون بكل دور + طلبات موزعة على 60 يوماً بحالات مختلفة + مصروفات + مبيعات فروع.

-- دور PostgREST المحلي
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'local-authenticator' noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;

-- موظفون تجريبيون (الدعوة ثم الحساب، تماماً كالإنتاج)
insert into private.staff_invites (email, role_code) values
  ('owner@alassar.local', 'owner'), ('orders@alassar.local', 'orders_manager'),
  ('viewer@alassar.local', 'viewer'), ('products@alassar.local', 'products_manager'),
  ('accountant@alassar.local', 'accountant'), ('reception@alassar.local', 'reception')
on conflict do nothing;
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@alassar.local', '{"full_name":"عماد (تجريبي)"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'orders@alassar.local', '{"full_name":"مدير الطلبات (تجريبي)"}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'viewer@alassar.local', '{"full_name":"مشاهد (تجريبي)"}'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'products@alassar.local', '{"full_name":"مدير المنتجات (تجريبي)"}'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'accountant@alassar.local', '{"full_name":"محاسب (تجريبي)"}'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'reception@alassar.local', '{"full_name":"استقبال (تجريبي)"}')
on conflict do nothing;

-- مخزون كافٍ للطلبات التجريبية + تكلفة لبعض الخيارات (لاختبار «بيانات ناقصة»)
update public.inventory set on_hand = on_hand + 60
 where variant_id in (select v.id from public.product_variants v join public.products p on p.id = v.product_id
                       where p.availability_mode = 'stock' and not p.requires_measurement and v.name <> 'كبيرة');
insert into public.variant_costs (variant_id, unit_cost)
select v.id, round(coalesce(v.price_override, p.price) * 0.6, 2)
  from public.product_variants v join public.products p on p.id = v.product_id
 where p.slug in ('مرتبة-طبية-فاخرة', 'بطانية-شتوية-ناعمة', 'مخدة-فندقية') and coalesce(v.price_override, p.price) is not null
on conflict do nothing;

do $$
declare
  owner_claims text := '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-000000000001","aal":"aal2"}';
  names text[] := array['أحمد أبو سمرة','سارة النجار','محمد العطار','هبة الكحلوت','يوسف شاهين','رنا أبو ندى','خالد الحلو','منى الزعانين','إبراهيم عوض','ليلى المصري','عمر السوافيري','نور أبو عيدة'];
  variants uuid[];
  zones uuid[];
  r jsonb; oid uuid; st text; days int; v uuid; i int; fulfil text; pay text;
begin
  select array_agg(v.id) into variants from public.product_variants v join public.products p on p.id = v.product_id
   where p.availability_mode = 'stock' and not p.requires_measurement and v.is_active and v.name <> 'كبيرة';
  select array_agg(id order by sort_order) into zones from public.delivery_zones;
  perform setseed(0.42);
  for i in 1..48 loop
    v := variants[1 + floor(random() * array_length(variants, 1))::int];
    fulfil := case when random() < 0.65 then 'delivery' else 'pickup' end;
    pay := case when fulfil = 'delivery' then (case when random() < 0.7 then 'cash_on_delivery' else 'bank_transfer' end)
                else (case when random() < 0.8 then 'cash_in_store' else 'bank_transfer' end) end;
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    r := public.place_order(jsonb_build_object(
      'customer_name', names[1 + (i % array_length(names, 1))],
      'phone', '0599' || lpad((100000 + (i % 12) * 7919)::text, 6, '0'),
      'fulfillment', fulfil, 'payment_method', pay, 'terms_accepted', true,
      'delivery_zone_id', case when fulfil = 'delivery' then zones[1 + (i % 3)] end,
      'address', case when fulfil = 'delivery' then 'شارع صلاح الدين، بجانب المسجد الكبير' end,
      'source', (array['instagram','facebook','whatsapp','direct','google'])[1 + (i % 5)],
      'items', jsonb_build_array(jsonb_build_object('variant_id', v, 'quantity', 1 + (i % 3 = 0)::int))));
    oid := (r->>'order_id')::uuid;
    days := floor(random() * 58)::int;
    st := case when i > 44 then 'received'
               when i % 9 = 0 then 'cancelled'
               when i % 7 = 0 then 'preparing'
               when i % 11 = 0 then 'confirmed'
               else 'delivered' end;
    perform set_config('request.jwt.claims', owner_claims, true);
    if st = 'cancelled' then
      perform public.cancel_order(oid, 'الزبون ألغى الطلب', true);
    elsif st <> 'received' then
      if pay = 'bank_transfer' then
        update public.orders set payment_status = 'paid' where id = oid;
      end if;
      perform public.confirm_order(oid, null);
      if st in ('preparing', 'delivered') then perform public.update_order_status(oid, 'preparing', null); end if;
      if st = 'delivered' then
        if fulfil = 'delivery' then perform public.update_order_status(oid, 'out_for_delivery', null);
        else perform public.update_order_status(oid, 'ready_for_pickup', null); end if;
        perform public.update_order_status(oid, 'delivered', null);
      end if;
      -- ربح يدوي لمعظم البنود (بعضها يبقى بلا ربح لاختبار «بيانات ناقصة»)
      if i % 6 <> 0 then
        perform public.set_item_profit(it.id, round(it.net_line_amount * 0.22, 2))
          from public.order_items it where it.order_id = oid;
      end if;
    end if;
    -- توزيع زمني واقعي (اختبار فقط)
    update public.orders set created_at = created_at - make_interval(days => days, hours => (i * 5) % 9),
           confirmed_at = confirmed_at - make_interval(days => days, hours => (i * 5) % 9),
           delivered_at = delivered_at - make_interval(days => days, hours => (i * 5) % 9),
           cancelled_at = cancelled_at - make_interval(days => days, hours => (i * 5) % 9),
           reservation_expires_at = case when st = 'received' then now() + make_interval(mins => 20 + i) else reservation_expires_at end
     where id = oid and st <> 'received';
  end loop;
  update public.customers c set created_at = (select min(created_at) from public.orders o where o.customer_id = c.id),
         last_order_at = (select max(created_at) from public.orders o where o.customer_id = c.id);

  perform set_config('request.jwt.claims', owner_claims, true);
  perform public.add_expense('delivery', 120, 'أجرة المندوب – أسبوعي', (now() at time zone 'Asia/Gaza')::date - 3);
  perform public.add_expense('marketing', 250, 'إعلان Instagram', (now() at time zone 'Asia/Gaza')::date - 10);
  perform public.add_expense('packaging', 60, 'أكياس وتغليف', (now() at time zone 'Asia/Gaza')::date - 18);
  perform public.add_expense('refunds', 90, 'استرداد قيمة مخدة تالفة', (now() at time zone 'Asia/Gaza')::date - 25);

  -- مبيعات فروع: واحدة بانتظار الاعتماد وأخرى معتمدة
  perform public.record_store_purchase('0599100000', 340, (select id from public.branches where is_default), gen_random_uuid(), false);
  perform public.record_store_purchase('0599115838', 180, (select id from public.branches where is_default), gen_random_uuid(), false);
  perform public.review_store_purchase((select id from public.store_purchases order by created_at limit 1), 'approve', null);
end $$;
