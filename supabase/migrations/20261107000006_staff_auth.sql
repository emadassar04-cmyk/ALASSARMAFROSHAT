-- =====================================================================
-- 0006 دخول الموظفين: دعوات بالبريد، سياق الصلاحيات للواجهة، تسجيل الدخول
-- عناوين البريد المدعوّة تُضاف كبيانات في القاعدة (وليس في Git)
-- =====================================================================
create table private.staff_invites (
  email       text primary key check (email = lower(email)),
  role_code   text not null references public.roles(code),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

-- عند إنشاء مستخدم (أو تأكيد بريده) بعنوان مدعوّ، يُمنح الدور مرة واحدة
create or replace function private.apply_staff_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_role smallint;
begin
  select r.id into v_role
    from private.staff_invites i join public.roles r on r.code = i.role_code
   where i.email = lower(new.email) and i.accepted_at is null;
  if v_role is not null then
    insert into public.profiles (id, full_name, role_id)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), v_role)
    on conflict (id) do update set role_id = excluded.role_id;
    update private.staff_invites set accepted_at = now() where email = lower(new.email);
    perform private.log_activity('staff.invite_accepted', 'profiles', new.id::text,
      null, jsonb_build_object('email', lower(new.email), 'role_id', v_role));
  end if;
  return new;
end $$;

create trigger on_auth_user_staff_invite
  after insert or update of email on auth.users
  for each row execute function private.apply_staff_invite();

-- يطبق دعوة على مستخدم موجود مسبقاً (إن سجّل قبل إضافة الدعوة)
create or replace function private.accept_pending_invites()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer := 0; u record;
begin
  for u in select au.id, au.email, au.raw_user_meta_data from auth.users au
             join private.staff_invites i on i.email = lower(au.email) and i.accepted_at is null loop
    update auth.users set email = email where id = u.id;  -- يشغّل المشغل أعلاه
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ما تحتاجه الواجهة لتوجيه المستخدم: هل هو موظف؟ وهل أكمل الخطوتين؟
create or replace function public.my_staff_context()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'is_staff_account', pr.id is not null and pr.is_active and pr.role_id is not null,
    'aal', coalesce(auth.jwt()->>'aal', 'aal1'),
    'role', r.code,
    'role_name', r.name_ar,
    'full_name', pr.full_name,
    'permissions', case when coalesce(auth.jwt()->>'aal', '') = 'aal2' then
      coalesce((select jsonb_agg(pe.code order by pe.code) from public.role_permissions rp
                  join public.permissions pe on pe.id = rp.permission_id where rp.role_id = pr.role_id), '[]')
      else '[]'::jsonb end)
  from (select auth.uid() as uid) me
  left join public.profiles pr on pr.id = me.uid
  left join public.roles r on r.id = pr.role_id
$$;

-- يُستدعى بعد نجاح التحقق بخطوتين لتسجيل الدخول في سجل النشاط
create or replace function public.record_staff_login(p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.log_activity('auth.staff_login', 'profiles', auth.uid()::text, null,
    jsonb_build_object('user_agent', left(p_user_agent, 300)));
end $$;

revoke all on function public.my_staff_context() from public, anon;
revoke all on function public.record_staff_login(text) from public, anon;
grant execute on function public.my_staff_context() to authenticated;
grant execute on function public.record_staff_login(text) to authenticated;
revoke all on all functions in schema private from anon, authenticated;
grant execute on function private.is_service_role() to anon, authenticated, service_role;
grant execute on function private.has_permission(text) to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.require_permission(text) to anon, authenticated, service_role;
grant execute on function private.default_branch_id() to anon, authenticated, service_role;
