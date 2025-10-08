
-- supabase_schema.sql
-- Coco Reporting System
-- Schema, RLS policies, and core RPCs
-- Timezone assumption: Europe/Warsaw for display; store timestamptz in UTC.

-- === ENUMS ===
create type public.user_role as enum ('staff','admin','owner');
create type public.report_status as enum ('draft','submitted','approved','locked');
create type public.field_type as enum ('decimal','integer','text','boolean','date');

-- === TABLES ===

-- 1) Venues
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text generated always as (regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Users (profile mirror of auth.users)
create table if not exists public.users (
  id uuid primary key, -- = auth.users.id
  email text not null unique,
  display_name text,
  role public.user_role not null default 'staff',
  venue_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

-- 3) Daily Reports (core fields + derived snapshots)
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete restrict,
  for_date date not null,
  status public.report_status not null default 'draft',

  -- Core numeric fields (PLN; 2 decimals)
  total_sale_gross numeric(12,2) not null default 0,
  card_1 numeric(12,2) not null default 0,
  card_2 numeric(12,2) not null default 0,
  cash numeric(12,2) not null default 0,
  cash_deposits numeric(12,2) not null default 0,
  drawer numeric(12,2) not null default 0,
  przelew numeric(12,2) not null default 0,
  glovo numeric(12,2) not null default 0,
  uber numeric(12,2) not null default 0,
  wolt numeric(12,2) not null default 0,
  pyszne numeric(12,2) not null default 0,
  bolt numeric(12,2) not null default 0,
  total_sale_with_special_payment numeric(12,2) not null default 0,

  withdrawal numeric(12,2) not null default 0,
  locker_withdrawal numeric(12,2) not null default 0,
  deposit numeric(12,2) not null default 0,
  staff_cost numeric(12,2) not null default 0,
  service_10_percent numeric(12,2) not null default 0,
  staff_spent numeric(12,2) not null default 0,

  -- Carryover & derived snapshots
  cash_previous_day numeric(12,2) not null default 0,
  calculated_cash_expected numeric(12,2) not null default 0,
  reconciliation_diff numeric(12,2) not null default 0,

  created_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  locked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(venue_id, for_date)
);

create trigger trg_daily_reports_updated_at
before update on public.daily_reports
for each row execute procedure public.moddatetime(updated_at);


-- 4) Field Definitions (extensible custom fields)
create table if not exists public.field_definitions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues(id) on delete cascade,
  key text not null,
  label text not null,
  data_type public.field_type not null,
  min_value numeric(14,4),
  max_value numeric(14,4),
  required boolean not null default false,
  default_value text,
  "group" text,
  order_index int not null default 0,
  is_active boolean not null default true,
  unique(venue_id, key)
);

-- 5) Field Values
create table if not exists public.report_field_values (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  field_definition_id uuid not null references public.field_definitions(id) on delete cascade,
  value_text text,
  unique(report_id, field_definition_id)
);

-- 6) Report Withdrawals (dynamic withdrawals per report)
create table if not exists public.report_withdrawals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  reason text,
  created_at timestamptz not null default now()
);

-- 7) Report Representacja 1 (dynamic representacja 1 entries per report)
create table if not exists public.report_representacja_1 (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  reason text,
  created_at timestamptz not null default now()
);

-- 8) Report Service Kwotowy (dynamic service kwotowy entries per report)
create table if not exists public.report_service_kwotowy (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  reason text,
  created_at timestamptz not null default now()
);

-- 9) Report Strata (dynamic strata entries per report)
create table if not exists public.report_strata (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  reason text,
  created_at timestamptz not null default now()
);

-- 10) Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid not null,
  action text not null,
  changed_by uuid not null references public.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  diff_json jsonb
);

-- === SECURITY: RLS ===

alter table public.venues enable row level security;
alter table public.users enable row level security;
alter table public.daily_reports enable row level security;
alter table public.field_definitions enable row level security;
alter table public.report_field_values enable row level security;
alter table public.report_withdrawals enable row level security;
alter table public.report_representacja_1 enable row level security;
alter table public.report_service_kwotowy enable row level security;
alter table public.report_strata enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: current user role
create or replace function public.current_user_role() returns public.user_role
language sql stable as $$
  select role from public.users where id = auth.uid();
$$;

-- Venues: all roles can read active venues
create policy p_venues_read on public.venues
for select using (true);

-- Users: user can read own row; admins/owners can read all
create policy p_users_self_read on public.users
for select using (id = auth.uid() or (exists (
  select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','owner')
)));

-- Daily Reports policies
-- Staff: can insert for venues they belong to; can update own draft; read own + approved of their venues
create policy p_reports_insert_staff on public.daily_reports
for insert
to authenticated
with check (
  auth.uid() = created_by
  and (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and (daily_reports.venue_id = any(u.venue_ids))
    )
  )
);

create policy p_reports_update_staff on public.daily_reports
for update
to authenticated
using (
  created_by = auth.uid() and status = 'draft'
)
with check (
  created_by = auth.uid() and status = 'draft'
);

create policy p_reports_select_staff on public.daily_reports
for select
to authenticated
using (
  -- Own reports OR approved/locked reports for user's venues
  created_by = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and (daily_reports.venue_id = any(u.venue_ids))
      and daily_reports.status in ('approved','locked','submitted')
  )
);

-- Admin/Owner full access
create policy p_reports_admin_all on public.daily_reports
for all
to authenticated
using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','owner'))
)
with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','owner'))
);


-- Field definitions readable by all; write by admin/owner
create policy p_field_defs_read on public.field_definitions
for select using (true);

create policy p_field_defs_write on public.field_definitions
for all to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','owner')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','owner')));

-- Field values follow report access
create policy p_field_values_rw on public.report_field_values
for all to authenticated
using (
  exists (select 1 from public.daily_reports r where r.id = report_id)
)
with check (
  exists (select 1 from public.daily_reports r where r.id = report_id)
);

-- Withdrawals follow report access
create policy p_withdrawals_rw on public.report_withdrawals
for all to authenticated
using (
  exists (select 1 from public.daily_reports r where r.id = report_id)
)
with check (
  exists (select 1 from public.daily_reports r where r.id = report_id)
);

-- Representacja 1 entries follow report access
create policy p_representacja_1_rw on public.report_representacja_1
for all to authenticated
using (
  exists (select 1 from public.daily_reports r where r.id = report_id)
)
with check (
  exists (select 1 from public.daily_reports r where r.id = report_id)
);

-- Service Kwotowy entries follow report access
create policy p_service_kwotowy_rw on public.report_service_kwotowy
for all to authenticated
using (
  exists (select 1 from public.daily_reports r where r.id = report_id)
)
with check (
  exists (select 1 from public.daily_reports r where r.id = report_id)
);

-- Strata entries follow report access
create policy p_strata_rw on public.report_strata
for all to authenticated
using (
  exists (select 1 from public.daily_reports r where r.id = report_id)
)
with check (
  exists (select 1 from public.daily_reports r where r.id = report_id)
);

-- Audit logs readable by admin/owner; insert by server via rpc
create policy p_audit_logs_read on public.audit_logs
for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','owner')));

-- === FUNCTIONS (RPC) ===

-- 1) Previous day cash helper
create or replace function public.fn_prev_day_cash(p_venue uuid, p_date date)
returns numeric
language sql stable as $$
  select coalesce(dr.cash_in_envelope_after_tips + dr.left_in_drawer
         + greatest(0, dr.total_cash_in_locker 
                       - coalesce(lag(dr.total_cash_in_locker) over (partition by dr.venue_id order by dr.for_date), dr.total_cash_in_locker)), 0)
  from public.daily_reports dr
  where dr.venue_id = p_venue
    and dr.for_date = (select max(for_date) from public.daily_reports where venue_id = p_venue and for_date < p_date and status in ('approved','locked'));
$$;

-- 2) Reconciliation calculator
create or replace function public.fn_calc_reconciliation(p_report uuid)
returns table (
  sum_payments numeric,
  payment_ok boolean,
  cash_expected numeric,
  cash_diff numeric,
  locker_delta numeric,
  tips_warning boolean
)
language plpgsql stable as $$
declare
  r record;
  tolerance numeric := 0.50;
  cards numeric;
  sp numeric;
  locker_prev numeric;
  total_representacja_1 numeric;
begin
  select * into r from public.daily_reports where id = p_report;
  if not found then
    raise exception 'Report not found';
  end if;

  locker_prev := (
    select total_cash_in_locker
    from public.daily_reports
    where venue_id = r.venue_id and for_date < r.for_date
    order by for_date desc
    limit 1
  );

  cards := r.card_1 + r.card_2;
  sp := r.total_sale_with_special_payment;

  -- Calculate total representacja_1
  select coalesce(sum(amount), 0) into total_representacja_1
  from public.report_representacja_1
  where report_id = p_report;
  
  -- payments sum
  return query
  select
    (r.card_1 + r.card_2 + r.cash + r.przelew + r.glovo + r.uber + r.wolt + r.pyszne + r.bolt) as sum_payments,
    abs((r.card_1 + r.card_2 + r.cash + r.przelew + r.glovo + r.uber + r.wolt + r.pyszne + r.bolt + sp + total_representacja_1) - r.total_sale_gross) <= tolerance as payment_ok,
    -- cash expected
    (
      r.cash_previous_day + r.cash + r.deposit - r.locker_withdrawal - r.tips_cash - r.staff_cost - total_representacja_1 - r.flavour
    ) as cash_expected,
    -- diff between expected and entered envelope+drawer (+ locker movement)
    (
      (
        r.cash_previous_day + r.cash + r.deposit - r.locker_withdrawal - r.tips_cash - r.staff_cost - total_representacja_1 - r.flavour
      )
      - (r.cash_in_envelope_after_tips + r.left_in_drawer)
    ) as cash_diff,
    coalesce(r.total_cash_in_locker - locker_prev, 0) as locker_delta,
    (r.tips_card > (cards * 0.20)) as tips_warning
  ;
end;
$$;

-- 3) Update snapshots on submit/approve via triggerable function
create or replace function public.fn_snapshot_reconciliation()
returns trigger
language plpgsql as $$
declare
  rec record;
begin
  select * from public.fn_calc_reconciliation(new.id) into rec;
  new.calculated_cash_expected := coalesce(rec.cash_expected,0);
  new.reconciliation_diff := coalesce(rec.cash_diff,0);
  return new;
end;
$$;

create or replace trigger trg_reports_snapshot_before_submit
before update of status on public.daily_reports
for each row
when (new.status in ('submitted','approved') and old.status <> new.status)
execute procedure public.fn_snapshot_reconciliation();

-- NOTE: CSV append is best implemented in an Edge Function.
-- We'll call it from the app after approval, not from SQL.
-- See edge-function-append-csv.ts for implementation.

-- === OPTIMIZED ANALYTICS FUNCTIONS ===

-- Function to get analytics data efficiently
CREATE OR REPLACE FUNCTION public.get_analytics_data(
  p_start_date date,
  p_end_date date,
  p_venue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_gross_sales numeric,
  total_tips numeric,
  total_voids numeric,
  total_loss numeric,
  total_reports bigint,
  approved_reports bigint,
  pending_reports bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'approved' THEN total_sale_gross ELSE 0 END), 0) as total_gross_sales,
    COALESCE(SUM(CASE WHEN status = 'approved' THEN tips_cash + tips_card ELSE 0 END), 0) as total_tips,
    COALESCE(SUM(CASE WHEN status = 'approved' THEN voids ELSE 0 END), 0) as total_voids,
    COALESCE(SUM(CASE WHEN status = 'approved' THEN strata_loss ELSE 0 END), 0) as total_loss,
    COUNT(*) as total_reports,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_reports,
    COUNT(CASE WHEN status IN ('draft', 'submitted') THEN 1 END) as pending_reports
  FROM public.daily_reports
  WHERE for_date >= p_start_date 
    AND for_date <= p_end_date
    AND (p_venue_id IS NULL OR venue_id = p_venue_id);
END;
$$ LANGUAGE plpgsql;

-- Function to get daily analytics data efficiently
CREATE OR REPLACE FUNCTION public.get_daily_analytics_data(
  p_start_date date,
  p_end_date date,
  p_venue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  date date,
  gross_sales numeric,
  tips numeric,
  voids numeric,
  loss numeric,
  withdrawals numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.for_date as date,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.total_sale_gross ELSE 0 END), 0) as gross_sales,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.tips_cash + dr.tips_card ELSE 0 END), 0) as tips,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.voids ELSE 0 END), 0) as voids,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.strata_loss ELSE 0 END), 0) as loss,
    COALESCE(SUM(w.amount), 0) as withdrawals
  FROM public.daily_reports dr
  LEFT JOIN public.report_withdrawals w ON dr.id = w.report_id AND dr.status = 'approved'
  WHERE dr.for_date >= p_start_date 
    AND dr.for_date <= p_end_date
    AND (p_venue_id IS NULL OR dr.venue_id = p_venue_id)
  GROUP BY dr.for_date
  ORDER BY dr.for_date;
END;
$$ LANGUAGE plpgsql;

-- === INDEXES FOR PERFORMANCE ===

-- Critical indexes for daily_reports table
CREATE INDEX IF NOT EXISTS idx_daily_reports_venue_date ON public.daily_reports(venue_id, for_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON public.daily_reports(for_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON public.daily_reports(status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_venue_status ON public.daily_reports(venue_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_created_by ON public.daily_reports(created_by);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Indexes for venues table
CREATE INDEX IF NOT EXISTS idx_venues_active ON public.venues(is_active);

-- Indexes for withdrawals table
CREATE INDEX IF NOT EXISTS idx_report_withdrawals_report_id ON public.report_withdrawals(report_id);

-- Indexes for representacja_1 table
CREATE INDEX IF NOT EXISTS idx_report_representacja_1_report_id ON public.report_representacja_1(report_id);

-- Indexes for service_kwotowy table
CREATE INDEX IF NOT EXISTS idx_report_service_kwotowy_report_id ON public.report_service_kwotowy(report_id);

-- Indexes for strata table
CREATE INDEX IF NOT EXISTS idx_report_strata_report_id ON public.report_strata(report_id);

-- === SEEDS (optional) ===
insert into public.venues (name) values ('Coco Lounge') on conflict do nothing;
insert into public.venues (name) values ('Coco Chemilina') on conflict do nothing;

-- Admin must manually create a user row after Supabase Auth signup:
-- insert into public.users (id,email,display_name,role,venue_ids)
-- values ('<auth.uuid>', 'admin@coco.local','Admin','admin', array[(select id from venues where name = 'Coco Lounge'),
--                                                                  (select id from venues where name = 'Coco Chemilina')]);
