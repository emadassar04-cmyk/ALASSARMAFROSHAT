-- =====================================================================
-- 0018 هوية العميل الموحدة برقم الجوال
--
-- المشكلة: normalize_phone كانت تحذف الرموز و"00" فقط، فالرقم نفسه بصيغ مختلفة
-- (0599123456 / +970599123456 / 00972599123456) كان يصبح ثلاثة عملاء مختلفين.
--
-- الحل: صيغة قانونية واحدة للجوال: 05XXXXXXXX (10 أرقام).
--   059/056 (جوال، Ooredoo) وأرقام 05 الأخرى تُقبل بالصيغ المحلية والدولية (+970 / +972 / 00970 / 00972).
--   رقم لا يطابق أي صيغة جوال مدعومة يُرفض (لا تخمين ولا دمج أعمى).
-- رقم الجوال معرّف للربط فقط، وليس إثباتاً للهوية: لا يكشف أي بيانات لمن يكتبه.
-- =====================================================================

create or replace function private.canonical_phone(p_phone text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  d text := regexp_replace(
              translate(coalesce(p_phone, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
              '\D', '', 'g');
begin
  d := regexp_replace(d, '^00', '');
  if d ~ '^(970|972)5[0-9]{8}$' then
    d := '0' || substr(d, 4);
  elsif d ~ '^5[0-9]{8}$' then
    d := '0' || d;
  end if;
  return case when d ~ '^05[0-9]{8}$' then d end;
end $$;

-- الدالة القديمة صارت تعيد الصيغة القانونية (أو نصاً فارغاً لرقم غير صالح، فيُرفض الطلب كما كان)
create or replace function private.normalize_phone(p_phone text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(private.canonical_phone(p_phone), '')
$$;

-- ---------------------------------------------------------------------
-- تحويل البيانات الموجودة إلى الصيغة القانونية
-- إن تحوّل رقمان مختلفان مخزنان إلى الرقم نفسه نتوقف ولا ندمج تلقائياً (يُراجع يدوياً)
-- ---------------------------------------------------------------------
do $$
declare v_conflicts int;
begin
  select count(*) into v_conflicts from (
    select private.canonical_phone(phone) c from public.customers
     where private.canonical_phone(phone) is not null
     group by 1 having count(*) > 1) x;
  if v_conflicts > 0 then
    raise exception 'customer phone conflicts after normalization: % — review manually before migrating', v_conflicts;
  end if;
  if exists (select 1 from public.customers where private.canonical_phone(phone) is null) then
    raise exception 'customers with unsupported phone format exist — review manually before migrating';
  end if;
end $$;

update public.customers set phone = private.canonical_phone(phone)
 where phone is distinct from private.canonical_phone(phone);
update public.orders set customer_phone = private.canonical_phone(customer_phone)
 where private.canonical_phone(customer_phone) is not null
   and customer_phone is distinct from private.canonical_phone(customer_phone);

alter table public.customers drop constraint if exists customers_phone_check;
alter table public.customers add constraint customers_phone_canonical check (phone ~ '^05[0-9]{8}$');

-- عميل أُنشئ من فرع (دون اسم) ثم طلب أونلاين باسمه: نُكمل الاسم من أول طلب
create or replace function private.fill_placeholder_customer_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.customers set name = new.customer_name
   where id = new.customer_id and name = 'عميل من الفرع' and length(trim(new.customer_name)) > 1;
  return new;
end $$;
create trigger orders_fill_customer_name after insert on public.orders
  for each row execute function private.fill_placeholder_customer_name();
