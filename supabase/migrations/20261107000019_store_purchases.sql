-- =====================================================================
-- 0019 تسجيل مبيعات الفروع + إدارة الموظفين
--
-- مبيعات الفرع في جدول مستقل (لا في الطلبات): الطلب يتطلب منتجات ومخزوناً وحجزاً،
-- أما بيع الفرع فرقم جوال + مبلغ + فرع فقط (لا فاتورة ولا منتجات ولا نقطة بيع).
-- دورة الحياة: submitted (أدخله الموظف) → approved (اعتمده المدير) أو rejected؛ المعتمد يمكن إلغاؤه (voided) بسبب.
-- لا حذف ولا كتابة مباشرة: كل شيء عبر دوال تتحقق من الصلاحية، وكل تغيير مسجل في سجل النشاط.
-- =====================================================================

-- ---------------------------------------------------------------------
-- الصلاحيات الجديدة
-- ---------------------------------------------------------------------
insert into public.permissions (code, description) values
  ('sales.record',     'تسجيل مبيعات الفرع'),
  ('sales.review',     'مراجعة واعتماد مبيعات الفروع وعرض سجل المشتريات'),
  ('staff.manage',     'إضافة الموظفين وتحديد أدوارهم'),
  ('campaigns.manage', 'إدارة حملات السحب واختيار الفائز')
on conflict (code) do nothing;

-- المدير الكامل يملك كل الصلاحيات الجديدة؛ موظف الاستقبال يسجل مبيعات الفرع فقط
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.code in ('sales.record', 'sales.review', 'staff.manage', 'campaigns.manage')
 where r.code = 'owner'
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code = 'sales.record'
 where r.code = 'reception'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- جدول مبيعات الفروع
-- ---------------------------------------------------------------------
create type public.store_purchase_status as enum ('submitted', 'approved', 'rejected', 'voided');

create table public.store_purchases (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null unique,          -- معرّف تقني يمنع تكرار الطلب نفسه (ليس رقم فاتورة)
  customer_id   uuid not null references public.customers(id) on delete restrict,
  branch_id     uuid not null references public.branches(id) on delete restrict,
  amount        numeric(12,2) not null check (amount > 0 and amount <= 1000000),
  currency      char(3) not null default 'ILS' check (currency = 'ILS'),
  status        public.store_purchase_status not null default 'submitted',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_reason text check (review_reason is null or length(review_reason) <= 300),
  updated_at    timestamptz not null default now(),
  check ((status in ('rejected', 'voided')) <= (review_reason is not null))
);
create index store_purchases_customer_idx on public.store_purchases(customer_id, created_at desc);
create index store_purchases_status_idx on public.store_purchases(status, created_at desc);
create index store_purchases_branch_idx on public.store_purchases(branch_id, created_at desc);

create trigger store_purchases_touch before update on public.store_purchases
  for each row execute function private.touch_updated_at();
create trigger store_purchases_audit after insert or update or delete on public.store_purchases
  for each row execute function private.audit_row();

alter table public.store_purchases enable row level security;
-- المراجع يرى الكل؛ الموظف يرى ما سجّله هو فقط (لعرض آخر عملياته)
create policy store_purchases_read on public.store_purchases for select
  using (private.has_permission('sales.review') or (created_by = auth.uid() and private.has_permission('sales.record')));
revoke all on public.store_purchases from anon, authenticated;
grant select on public.store_purchases to authenticated;

-- ---------------------------------------------------------------------
-- تسجيل عملية بيع في الفرع
-- p_confirm_duplicate: عملية مطابقة (نفس العميل والمبلغ والفرع) خلال دقيقتين تحتاج تأكيداً صريحاً
-- ---------------------------------------------------------------------
create or replace function public.record_store_purchase(
  p_phone text, p_amount numeric, p_branch_id uuid, p_request_id uuid, p_confirm_duplicate boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_phone    text := private.canonical_phone(p_phone);
  v_customer uuid;
  v_new      boolean := false;
  v_row      public.store_purchases;
  v_branch   text;
begin
  perform private.require_permission('sales.record');
  if p_request_id is null then raise exception 'missing_request_id' using errcode = '22023'; end if;

  -- الطلب نفسه أُرسل مرتين (ضغطتان أو إعادة إرسال بعد انقطاع): نعيد النتيجة الأولى دون تكرار
  select * into v_row from public.store_purchases where request_id = p_request_id;
  if found then
    return jsonb_build_object('id', v_row.id, 'amount', v_row.amount, 'status', v_row.status, 'replayed', true,
      'branch', (select name from public.branches where id = v_row.branch_id),
      'phone', (select phone from public.customers where id = v_row.customer_id));
  end if;

  if v_phone is null then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 or p_amount <> round(p_amount, 2) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select name into v_branch from public.branches where id = p_branch_id and is_active;
  if v_branch is null then raise exception 'invalid_branch' using errcode = '22023'; end if;

  -- العميل: موجود ← نربطه؛ جديد ← سجل بسيط
  select id into v_customer from public.customers where phone = v_phone;
  if v_customer is null then
    insert into public.customers (phone, name) values (v_phone, 'عميل من الفرع')
    on conflict (phone) do nothing returning id into v_customer;
    if v_customer is null then select id into v_customer from public.customers where phone = v_phone; end if;
    v_new := true;
  end if;

  if not coalesce(p_confirm_duplicate, false) and exists (
      select 1 from public.store_purchases
       where customer_id = v_customer and branch_id = p_branch_id and amount = p_amount
         and status <> 'rejected' and created_at > now() - interval '2 minutes') then
    raise exception 'possible_duplicate' using errcode = 'P0001';
  end if;

  insert into public.store_purchases (request_id, customer_id, branch_id, amount, created_by)
  values (p_request_id, v_customer, p_branch_id, p_amount, auth.uid())
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'amount', v_row.amount, 'status', v_row.status, 'replayed', false,
    'branch', v_branch, 'phone', v_phone, 'new_customer', v_new);
end $$;

-- ---------------------------------------------------------------------
-- المراجعة: اعتماد / رفض / إلغاء معتمد / تصحيح قبل الاعتماد
-- ---------------------------------------------------------------------
create or replace function public.review_store_purchase(p_id uuid, p_action text, p_reason text default null)
returns public.store_purchases language plpgsql security definer set search_path = '' as $$
declare
  v_row public.store_purchases;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform private.require_permission('sales.review');
  select * into v_row from public.store_purchases where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  if p_action = 'approve' and v_row.status = 'submitted' then
    update public.store_purchases set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_reason = v_reason
     where id = p_id returning * into v_row;
  elsif p_action = 'reject' and v_row.status = 'submitted' then
    if v_reason is null then raise exception 'reason_required' using errcode = '22023'; end if;
    update public.store_purchases set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_reason = v_reason
     where id = p_id returning * into v_row;
  elsif p_action = 'void' and v_row.status = 'approved' then
    if v_reason is null then raise exception 'reason_required' using errcode = '22023'; end if;
    update public.store_purchases set status = 'voided', reviewed_by = auth.uid(), reviewed_at = now(), review_reason = v_reason
     where id = p_id returning * into v_row;
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  return v_row;
end $$;

-- تصحيح المبلغ أو الفرع قبل الاعتماد فقط (القيم القديمة والجديدة تُحفظ في سجل النشاط)
create or replace function public.correct_store_purchase(p_id uuid, p_amount numeric, p_branch_id uuid, p_reason text)
returns public.store_purchases language plpgsql security definer set search_path = '' as $$
declare v_row public.store_purchases;
begin
  perform private.require_permission('sales.review');
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 or p_amount <> round(p_amount, 2) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and is_active) then
    raise exception 'invalid_branch' using errcode = '22023';
  end if;
  update public.store_purchases set amount = p_amount, branch_id = p_branch_id, review_reason = trim(p_reason)
   where id = p_id and status = 'submitted' returning * into v_row;
  if not found then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
  perform private.log_activity('store_purchase.corrected', 'store_purchases', p_id::text, null,
    jsonb_build_object('amount', p_amount, 'branch_id', p_branch_id), trim(p_reason));
  return v_row;
end $$;

-- اعتماد عدة عمليات مرة واحدة (مثلاً كل عمليات اليوم بعد مراجعتها)
create or replace function public.approve_store_purchases(p_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  perform private.require_permission('sales.review');
  update public.store_purchases set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where id = any(p_ids) and status = 'submitted';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- إدارة الموظفين (دون SQL): دعوة بريد بدور محدد، تفعيل/إيقاف، تغيير الدور
-- لا يمكن منح دور المدير الكامل من هنا، ولا تعديل حساب المدير أو حسابك الشخصي
-- ---------------------------------------------------------------------
create or replace function public.staff_overview()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when private.has_permission('staff.manage') then jsonb_build_object(
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.full_name, 'email', u.email, 'role', r.code, 'role_name', r.name_ar,
        'active', pr.is_active, 'is_me', pr.id = auth.uid()) order by r.code = 'owner' desc, pr.created_at)
      from public.profiles pr join auth.users u on u.id = pr.id left join public.roles r on r.id = pr.role_id), '[]'),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('email', i.email, 'role', i.role_code, 'created_at', i.created_at) order by i.created_at desc)
      from private.staff_invites i where i.accepted_at is null), '[]'),
    'roles', (select jsonb_agg(jsonb_build_object('code', code, 'name', name_ar) order by id) from public.roles where code <> 'owner'))
  end
$$;

create or replace function public.staff_invite(p_email text, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(p_email));
begin
  perform private.require_permission('staff.manage');
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email' using errcode = '22023'; end if;
  if p_role = 'owner' or not exists (select 1 from public.roles where code = p_role) then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  insert into private.staff_invites (email, role_code) values (v_email, p_role)
  on conflict (email) do update set role_code = excluded.role_code, accepted_at = null, created_at = now();
  perform private.accept_pending_invites();
  perform private.log_activity('staff.invited', 'staff_invites', v_email, null, jsonb_build_object('role', p_role));
end $$;

create or replace function public.staff_update(p_user_id uuid, p_role text, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.profiles; v_role smallint;
begin
  perform private.require_permission('staff.manage');
  if p_user_id = auth.uid() then raise exception 'cannot_change_self' using errcode = '42501'; end if;
  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.roles where id = v_old.role_id and code = 'owner') or p_role = 'owner' then
    raise exception 'cannot_change_owner' using errcode = '42501';
  end if;
  select id into v_role from public.roles where code = p_role;
  if v_role is null then raise exception 'invalid_role' using errcode = '22023'; end if;
  update public.profiles set role_id = v_role, is_active = p_active, updated_at = now() where id = p_user_id;
  perform private.log_activity('staff.updated', 'profiles', p_user_id::text,
    jsonb_build_object('role_id', v_old.role_id, 'active', v_old.is_active), jsonb_build_object('role', p_role, 'active', p_active));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.record_store_purchase(text, numeric, uuid, uuid, boolean)',
    'public.review_store_purchase(uuid, text, text)',
    'public.correct_store_purchase(uuid, numeric, uuid, text)',
    'public.approve_store_purchases(uuid[])',
    'public.staff_overview()',
    'public.staff_invite(text, text)',
    'public.staff_update(uuid, text, boolean)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
