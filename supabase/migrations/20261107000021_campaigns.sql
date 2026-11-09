-- =====================================================================
-- 0021 حملة السحب الشهري «تسوّق واربح مع العصار»
--
-- القواعد الافتراضية (قابلة للتعديل لكل حملة من الإدارة):
--   - الشراء المؤهل: طلب أونلاين وصل حالة «تم التسليم»، أو بيع فرع «معتمد».
--   - تاريخ الشراء (وقت إنشاء الطلب/العملية) داخل فترة الحملة، والمبلغ ≥ الحد الأدنى إن حُدد.
--   - مشاركة واحدة لكل شراء مؤهل (قيد فريد يمنع التكرار، والإنشاء آمن لو تكرر).
--   - الإلغاء أو الرفض بعد ذلك يُبطل المشاركة (لا تُحذف، تُعلَّم مُبطلة مع السبب).
--   - السحب بعد انتهاء الحملة فقط، مرة واحدة، عشوائياً بين المشاركات السارية، ويُسجَّل في سجل النشاط.
--   - إعلان الفائز: الاسم الأول + رقم مخفي جزئياً (059****301).
-- =====================================================================

create type public.campaign_status as enum ('draft', 'published', 'drawn', 'archived');

create table public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  title         text not null check (length(trim(title)) between 3 and 120),
  description   text check (description is null or length(description) <= 2000),
  prize         text not null check (length(trim(prize)) between 2 and 300),
  prize_image_url text check (prize_image_url is null or prize_image_url ~ '^https://'),
  terms         text not null check (length(trim(terms)) >= 20),
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  min_amount    numeric(12,2) check (min_amount is null or min_amount > 0),
  status        public.campaign_status not null default 'draft',
  winner_entry_id uuid,
  winner_display text,
  drawn_at      timestamptz,
  drawn_by      uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_at > start_at),
  check ((status = 'drawn') <= (winner_entry_id is not null))
);
create trigger campaigns_touch before update on public.campaigns
  for each row execute function private.touch_updated_at();
create trigger campaigns_audit after insert or update or delete on public.campaigns
  for each row execute function private.audit_row();

create table public.campaign_entries (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.campaigns(id) on delete restrict,
  customer_id       uuid not null references public.customers(id) on delete restrict,
  order_id          uuid references public.orders(id) on delete restrict,
  store_purchase_id uuid references public.store_purchases(id) on delete restrict,
  amount            numeric(12,2) not null,
  purchased_at      timestamptz not null,
  created_at        timestamptz not null default now(),
  voided_at         timestamptz,
  void_reason       text,
  check ((order_id is null) <> (store_purchase_id is null)),
  unique (campaign_id, order_id),
  unique (campaign_id, store_purchase_id)
);
create index campaign_entries_campaign_idx on public.campaign_entries(campaign_id) where voided_at is null;
alter table public.campaigns add constraint campaigns_winner_fk foreign key (winner_entry_id) references public.campaign_entries(id);

alter table public.campaigns enable row level security;
alter table public.campaign_entries enable row level security;
create policy campaigns_read on public.campaigns for select
  using (status in ('published', 'drawn') or private.has_permission('campaigns.manage'));
create policy campaign_entries_read on public.campaign_entries for select
  using (private.has_permission('campaigns.manage'));
revoke all on public.campaigns, public.campaign_entries from anon, authenticated;
grant select on public.campaigns, public.campaign_entries to authenticated;

-- ---------------------------------------------------------------------
-- إنشاء/إبطال المشاركات تلقائياً عند تغيّر حالة الشراء
-- ---------------------------------------------------------------------
create or replace function private.sync_entries(
  p_customer uuid, p_order uuid, p_store uuid, p_amount numeric, p_at timestamptz, p_eligible boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_eligible then
    -- حملات منشورة لم يُسحب فائزها، والشراء داخل فترتها ويتجاوز الحد الأدنى
    insert into public.campaign_entries (campaign_id, customer_id, order_id, store_purchase_id, amount, purchased_at)
    select c.id, p_customer, p_order, p_store, p_amount, p_at
      from public.campaigns c
     where c.status = 'published' and p_at >= c.start_at and p_at < c.end_at
       and (c.min_amount is null or p_amount >= c.min_amount)
    on conflict do nothing;
    -- مشاركة أُبطلت ثم عاد الشراء مؤهلاً
    update public.campaign_entries e set voided_at = null, void_reason = null
      from public.campaigns c
     where c.id = e.campaign_id and c.status = 'published' and e.voided_at is not null
       and ((p_order is not null and e.order_id = p_order) or (p_store is not null and e.store_purchase_id = p_store));
  else
    update public.campaign_entries e set voided_at = now(), void_reason = p_reason
      from public.campaigns c
     where c.id = e.campaign_id and c.status = 'published' and e.voided_at is null
       and ((p_order is not null and e.order_id = p_order) or (p_store is not null and e.store_purchase_id = p_store));
  end if;
end $$;

create or replace function private.orders_campaign_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and (new.status = 'delivered' or old.status = 'delivered') then
    perform private.sync_entries(new.customer_id, new.id, null, new.total, new.created_at,
      new.status = 'delivered', 'order_' || new.status::text);
  end if;
  return new;
end $$;
create trigger orders_campaign_sync after update of status on public.orders
  for each row execute function private.orders_campaign_sync();

create or replace function private.store_purchases_campaign_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.status = 'approved')
     or (tg_op = 'UPDATE' and (new.status is distinct from old.status or new.amount is distinct from old.amount)
         and (new.status = 'approved' or old.status = 'approved')) then
    perform private.sync_entries(new.customer_id, null, new.id, new.amount, new.created_at,
      new.status = 'approved', 'store_' || new.status::text);
  end if;
  return new;
end $$;
create trigger store_purchases_campaign_sync after insert or update on public.store_purchases
  for each row execute function private.store_purchases_campaign_sync();

-- عند نشر حملة: نضيف المشتريات المؤهلة التي وقعت في فترتها قبل النشر (آمن لو تكرر)
create or replace function private.backfill_campaign(p_campaign uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare c public.campaigns; v_count integer := 0; n integer;
begin
  select * into c from public.campaigns where id = p_campaign;
  insert into public.campaign_entries (campaign_id, customer_id, order_id, amount, purchased_at)
  select c.id, o.customer_id, o.id, o.total, o.created_at from public.orders o
   where o.status = 'delivered' and o.created_at >= c.start_at and o.created_at < c.end_at
     and (c.min_amount is null or o.total >= c.min_amount)
  on conflict do nothing;
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.campaign_entries (campaign_id, customer_id, store_purchase_id, amount, purchased_at)
  select c.id, s.customer_id, s.id, s.amount, s.created_at from public.store_purchases s
   where s.status = 'approved' and s.created_at >= c.start_at and s.created_at < c.end_at
     and (c.min_amount is null or s.amount >= c.min_amount)
  on conflict do nothing;
  get diagnostics n = row_count; v_count := v_count + n;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- إدارة الحملة
-- ---------------------------------------------------------------------
create or replace function public.save_campaign(p jsonb)
returns public.campaigns language plpgsql security definer set search_path = '' as $$
declare v public.campaigns; v_id uuid := nullif(p->>'id', '')::uuid;
begin
  perform private.require_permission('campaigns.manage');
  if v_id is null then
    insert into public.campaigns (slug, title, description, prize, prize_image_url, terms, start_at, end_at, min_amount)
    values (p->>'slug', p->>'title', nullif(p->>'description', ''), p->>'prize', nullif(p->>'prize_image_url', ''), p->>'terms',
            (p->>'start_at')::timestamptz, (p->>'end_at')::timestamptz, nullif(p->>'min_amount', '')::numeric)
    returning * into v;
  else
    -- بعد السحب لا تُعدَّل الحملة (شفافية النتيجة)
    update public.campaigns set slug = p->>'slug', title = p->>'title', description = nullif(p->>'description', ''),
           prize = p->>'prize', prize_image_url = nullif(p->>'prize_image_url', ''), terms = p->>'terms',
           start_at = (p->>'start_at')::timestamptz, end_at = (p->>'end_at')::timestamptz,
           min_amount = nullif(p->>'min_amount', '')::numeric
     where id = v_id and status in ('draft', 'published') returning * into v;
    if not found then raise exception 'campaign_locked' using errcode = 'P0001'; end if;
  end if;
  return v;
end $$;

create or replace function public.set_campaign_status(p_id uuid, p_status public.campaign_status)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.campaigns; v_added integer := 0;
begin
  perform private.require_permission('campaigns.manage');
  select * into v from public.campaigns where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_status = 'published' and v.status = 'draft' then
    if exists (select 1 from public.campaigns where status = 'published' and id <> p_id
                and tstzrange(start_at, end_at) && tstzrange(v.start_at, v.end_at)) then
      raise exception 'overlapping_campaign' using errcode = 'P0001';
    end if;
    update public.campaigns set status = 'published' where id = p_id;
    v_added := private.backfill_campaign(p_id);
  elsif p_status = 'draft' and v.status = 'published' then
    if exists (select 1 from public.campaign_entries where campaign_id = p_id) then
      raise exception 'campaign_has_entries' using errcode = 'P0001';
    end if;
    update public.campaigns set status = 'draft' where id = p_id;
  elsif p_status = 'archived' and v.status = 'drawn' then
    update public.campaigns set status = 'archived' where id = p_id;
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  return jsonb_build_object('status', p_status, 'backfilled', v_added);
end $$;

-- السحب: بعد انتهاء الحملة، مرة واحدة، عشوائي بالتساوي بين المشاركات السارية
create or replace function public.draw_campaign_winner(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.campaigns; e public.campaign_entries; v_total integer; v_name text; v_phone text; v_display text;
begin
  perform private.require_permission('campaigns.manage');
  select * into v from public.campaigns where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v.status <> 'published' then raise exception 'not_drawable' using errcode = 'P0001'; end if;
  if now() < v.end_at then raise exception 'campaign_not_ended' using errcode = 'P0001'; end if;
  select count(*) into v_total from public.campaign_entries where campaign_id = p_id and voided_at is null;
  if v_total = 0 then raise exception 'no_entries' using errcode = 'P0001'; end if;

  select * into e from public.campaign_entries where campaign_id = p_id and voided_at is null
   order by random() limit 1;
  select split_part(trim(name), ' ', 1), phone into v_name, v_phone from public.customers where id = e.customer_id;
  v_display := case when v_name is null or v_name = 'عميل' then '' else v_name || ' — ' end
               || left(v_phone, 3) || '****' || right(v_phone, 3);

  update public.campaigns set status = 'drawn', winner_entry_id = e.id, winner_display = v_display,
         drawn_at = now(), drawn_by = auth.uid() where id = p_id;
  perform private.log_activity('campaign.drawn', 'campaigns', p_id::text, null,
    jsonb_build_object('winner_entry_id', e.id, 'entries', v_total));
  return jsonb_build_object('winner', v_display, 'entries', v_total);
end $$;

-- إحصاءات الحملات للإدارة
create or replace function public.admin_campaigns()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when private.has_permission('campaigns.manage') then coalesce(jsonb_agg(jsonb_build_object(
    'campaign', to_jsonb(c),
    'entries', (select count(*) from public.campaign_entries e where e.campaign_id = c.id and e.voided_at is null),
    'customers', (select count(distinct customer_id) from public.campaign_entries e where e.campaign_id = c.id and e.voided_at is null),
    'voided', (select count(*) from public.campaign_entries e where e.campaign_id = c.id and e.voided_at is not null))
    order by c.start_at desc), '[]') end
  from public.campaigns c
$$;

-- ---------------------------------------------------------------------
-- واجهة عامة: الحملة الحالية/القادمة + آخر فائز (حقول عامة فقط؛ عدد المشاركات الفعلي)
-- ---------------------------------------------------------------------
create or replace function public.catalog_campaign()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'current', (select jsonb_build_object('slug', c.slug, 'title', c.title, 'description', c.description, 'prize', c.prize,
                  'prize_image_url', c.prize_image_url, 'terms', c.terms, 'start_at', c.start_at, 'end_at', c.end_at,
                  'min_amount', c.min_amount,
                  'entries', (select count(*) from public.campaign_entries e where e.campaign_id = c.id and e.voided_at is null))
                  from public.campaigns c where c.status = 'published' and c.end_at > now()
                  order by c.start_at limit 1),
    'last_winner', (select jsonb_build_object('title', c.title, 'prize', c.prize, 'winner', c.winner_display, 'drawn_at', c.drawn_at)
                      from public.campaigns c where c.status in ('drawn', 'archived') and c.winner_display is not null
                      order by c.drawn_at desc limit 1))
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.save_campaign(jsonb)', 'public.set_campaign_status(uuid, public.campaign_status)',
    'public.draw_campaign_winner(uuid)', 'public.admin_campaigns()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
revoke all on function public.catalog_campaign() from public;
grant execute on function public.catalog_campaign() to anon, authenticated, service_role;
