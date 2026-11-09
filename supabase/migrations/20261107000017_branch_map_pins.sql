-- =====================================================================
-- 0017 مواقع الفرعين الدقيقة (من روابط Google Maps التي أرسلها صاحب المحل)
--   دير البلح: https://maps.app.goo.gl/FtsQN71RsBLmkqxD6 → 31.418326, 34.349009
--   النصيرات:  https://maps.app.goo.gl/tx3gbPcU2VhGHcs67 → 31.450171, 34.389171
-- =====================================================================
update public.branches
   set map_url = 'https://maps.app.goo.gl/FtsQN71RsBLmkqxD6', lat = 31.418326, lng = 34.349009
 where city = 'دير البلح';

update public.branches
   set map_url = 'https://maps.app.goo.gl/tx3gbPcU2VhGHcs67', lat = 31.450171, lng = 34.389171
 where city = 'النصيرات';
