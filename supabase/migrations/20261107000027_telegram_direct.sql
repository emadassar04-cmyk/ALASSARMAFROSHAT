-- =====================================================================
-- 0027 إرسال Telegram مباشرة من خادم الموقع (بديل/مكمّل لـ n8n) — إضافات فقط: دالتان جديدتان
-- - نفس صندوق الأحداث ونفس جدول التسليم ونفس نص الرسائل (private.telegram_text)
-- - الحجز (claim) يقفل الصفوف: من يحجز أولاً (الموقع أو n8n) يرسل، فلا تكرار
-- - لمفتاح الخدمة فقط (من خادم الموقع)، ولا تُرسل إلا أحداث آخر يوم (لا نغرق المدير برسائل قديمة)
-- =====================================================================
create or replace function public.notifications_claim_service(p_channel text default 'telegram', p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not private.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  with claimed as (
    update public.notification_deliveries d
       set status = 'processing', locked_at = now(), attempts = d.attempts + 1
     where d.id in (
       select id from public.notification_deliveries
        where channel = p_channel and created_at > now() - interval '1 day'
          and ((status in ('pending', 'failed') and next_attempt_at <= now())
               or (status = 'processing' and locked_at < now() - interval '10 minutes'))
        order by id limit least(greatest(p_limit, 1), 50)
        for update skip locked)
    returning d.event_id, d.attempts)
  select coalesce(jsonb_agg(jsonb_build_object(
           'event_id', c.event_id, 'event_type', e.event_type, 'attempt', c.attempts,
           'text', private.telegram_text(e)) order by e.id), '[]')
    into v_result
    from claimed c join public.notification_outbox e on e.event_id = c.event_id;
  return v_result;
end $$;

create or replace function public.notifications_complete_service(
  p_event_id uuid, p_success boolean, p_error text default null, p_channel text default 'telegram')
returns text language plpgsql security definer set search_path = '' as $$
declare v_status public.outbox_status;
begin
  if not private.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.notification_deliveries set
    status = case when p_success then 'sent'::public.outbox_status when attempts >= 5 then 'dead' else 'failed' end,
    sent_at = case when p_success then now() end,
    last_error = case when p_success then null else left(p_error, 500) end,
    next_attempt_at = case when p_success then next_attempt_at
                           else now() + make_interval(mins => least(60, (2 ^ attempts)::integer)) end,
    locked_at = null
  where event_id = p_event_id and channel = p_channel and status = 'processing'
  returning status into v_status;
  return coalesce(v_status::text, 'ignored');
end $$;

revoke all on function public.notifications_claim_service(text, integer), public.notifications_complete_service(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.notifications_claim_service(text, integer), public.notifications_complete_service(uuid, boolean, text, text) to service_role;
