-- 0029: تحديث طرق الدفع (طلب المدير) + تفعيل «المحفظة الإلكترونية» بنفس مسار التحويل البنكي:
--   الزبون يختارها ← نرسل له رقم المحفظة عبر WhatsApp ← المدير يراجع الدفع ويعتمده من لوحة الإدارة.
-- لا يوجد دفع إلكتروني مباشر (بوابة دفع) — لم تُضف طريقة لا تعمل فعلياً.
-- التغييرات: بيانات payment_methods (أسماء/أوصاف + صف جديد)، trigger صغير لحالة الدفع، واستبدال دالتين:
--   review_bank_transfer (تقبل المحفظة أيضاً) و telegram_text (اسم الطريقة في إشعار الطلب).

update public.payment_methods
   set name_ar = 'الدفع عند الاستلام',
       instructions = 'الدفع عند وصول الطلب واستلامه.',
       sort_order = 1
 where code = 'cash_on_delivery';
update public.payment_methods
   set name_ar = 'تحويل بنكي',
       instructions = 'التحويل مباشرة إلى الحساب البنكي. بعد إرسال الطلب نرسل لك بيانات الحساب عبر WhatsApp، ولا يُعتمد الدفع إلا بعد مراجعة التحويل.',
       sort_order = 2
 where code = 'bank_transfer';
insert into public.payment_methods (code, name_ar, instructions, is_enabled, sort_order) values
  ('e_wallet', 'الدفع عبر المحفظة الإلكترونية',
   'الدفع باستخدام محفظة إلكترونية. بعد إرسال الطلب نرسل لك رقم المحفظة عبر WhatsApp، ولا يُعتمد الدفع إلا بعد مراجعته.',
   true, 3)
on conflict (code) do nothing;
update public.payment_methods set sort_order = 4 where code = 'cash_in_store';

-- طلب بالمحفظة يبدأ «بانتظار المراجعة» مثل التحويل البنكي (دون تعديل place_order)
create or replace function private.e_wallet_awaiting_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.payment_method = 'e_wallet' and new.payment_status = 'unpaid' then
    new.payment_status := 'awaiting_review';
  end if;
  return new;
end $$;
revoke all on function private.e_wallet_awaiting_review() from public, anon, authenticated;
drop trigger if exists orders_e_wallet_review on public.orders;
create trigger orders_e_wallet_review before insert on public.orders
  for each row execute function private.e_wallet_awaiting_review();

-- مراجعة الدفع اليدوي: التحويل البنكي والمحفظة الإلكترونية
create or replace function public.review_bank_transfer(
  p_order_id uuid, p_approved boolean, p_amount numeric default null,
  p_reference text default null, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  perform private.require_permission('orders.manage');
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if o.payment_method not in ('bank_transfer', 'e_wallet') or o.payment_status not in ('awaiting_review', 'rejected') then
    raise exception 'payment_not_reviewable' using errcode = 'P0001';
  end if;
  insert into public.payment_reviews (order_id, approved, amount, reference, note)
  values (p_order_id, p_approved, p_amount, p_reference, p_note);
  update public.orders set payment_status = case when p_approved then 'paid'::public.payment_status else 'rejected' end
   where id = p_order_id returning * into o;
  perform private.log_activity('payment.review', 'orders', p_order_id::text, null,
    jsonb_build_object('approved', p_approved, 'amount', p_amount), p_note);
  return o;
end $$;

create or replace function private.telegram_text(p_event public.notification_outbox)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders;
  v_site text := (select site_url from public.store_settings);
  v_items text;
  v_zone text;
begin
  if p_event.order_id is not null then
    select * into o from public.orders where id = p_event.order_id;
    select string_agg('• ' || private.html_escape(i.product_name_snapshot)
             || coalesce(nullif(' (' || private.html_escape(nullif(i.variant_snapshot->>'name', 'افتراضي')) || ')', ' ()'), '')
             || ' × ' || i.quantity, E'\n' order by i.created_at)
      into v_items from public.order_items i where i.order_id = o.id;
    select name into v_zone from public.delivery_zones where id = o.delivery_zone_id;
  end if;

  return case p_event.event_type
    when 'order.created' then
      '🛒 <b>طلب جديد ' || o.order_number || '</b>' || E'\n'
      || 'الإجمالي: <b>' || private.fmt_ils(o.total) || '</b>' || E'\n'
      || case when o.fulfillment = 'delivery' then 'توصيل — ' || private.html_escape(coalesce(v_zone, '')) else 'استلام من المحل' end || E'\n'
      || 'الدفع: ' || case o.payment_method when 'cash_on_delivery' then 'عند الاستلام'
                       when 'cash_in_store' then 'نقداً في المحل' when 'e_wallet' then 'محفظة إلكترونية (أرسل رقم المحفظة عبر WhatsApp وراجع الدفع)'
                       else 'تحويل بنكي' end || E'\n'
      || coalesce(v_items, '') || E'\n'
      || case when o.reservation_expires_at is not null
              then 'الحجز ينتهي: ' || to_char(o.reservation_expires_at at time zone 'Asia/Gaza', 'HH24:MI') || E'\n' else '' end
      || v_site || '/admin/orders/' || o.id
    when 'payment.bank_transfer_selected' then
      '🏦 <b>تحويل بنكي — ' || o.order_number || '</b>' || E'\n'
      || 'المبلغ: ' || private.fmt_ils(o.total) || E'\n'
      || 'أرسل بيانات الحساب للزبون عبر WhatsApp، وراجع التحويل قبل الاعتماد.' || E'\n'
      || v_site || '/admin/orders/' || o.id
    when 'reservation.expired' then
      '⌛ انتهى حجز الطلب ' || o.order_number || ' دون تأكيد، وأُلغي تلقائياً وعادت الكمية للمخزون.' || E'\n'
      || v_site || '/admin/orders/' || o.id
    when 'auth.staff_login' then
      '🔐 دخول جديد إلى لوحة الإدارة' || E'\n'
      || 'الوقت: ' || to_char(p_event.created_at at time zone 'Asia/Gaza', 'YYYY-MM-DD HH24:MI') || E'\n'
      || 'الجهاز: ' || private.html_escape(left(p_event.payload->>'user_agent', 120)) || E'\n'
      || 'إن لم تكن أنت: ادخل اللوحة واضغط «إنهاء كل الجلسات» فوراً.'
    when 'custom_order.created' then
      '📐 <b>طلب تفصيل جديد ' || private.html_escape(p_event.payload->>'number') || '</b>' || E'\n'
      || private.html_escape(p_event.payload->>'type_label') || E'\n'
      || private.html_escape(p_event.payload->>'summary') || E'\n'
      || 'المنطقة: ' || private.html_escape(p_event.payload->>'area') || E'\n'
      || 'السعر يُحدَّد بعد المراجعة.' || E'\n'
      || v_site || '/admin/custom-orders/' || (p_event.payload->>'id')
    else private.html_escape(p_event.event_type)
  end;
end $$;
