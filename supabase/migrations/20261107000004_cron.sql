-- =====================================================================
-- 0004 مهمة مجدولة داخل Supabase: تحرير الحجوزات المنتهية كل 5 دقائق
-- (pg_cron متاح في الخطة المجانية). لا يعتمد صحة المخزون على n8n.
-- =====================================================================
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'release-expired-reservations',
  '*/5 * * * *',
  $$select public.release_expired_reservations()$$
);
