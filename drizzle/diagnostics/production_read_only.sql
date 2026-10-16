-- Read-only production diagnostics. Run as an authorized database operator
-- in the Supabase SQL Editor. This file does not select customer/order rows,
-- mutate data, or expose credentials.

-- 1. Drizzle's PostgreSQL migration ledger is stored in drizzle.__drizzle_migrations.
-- If this returns NULL, STOP: do not run drizzle-kit migrate until the existing
-- baseline and migration history have been reconciled.
select to_regclass('drizzle.__drizzle_migrations') as drizzle_migration_ledger;

-- Run this query only if the ledger relation above exists. Drizzle records
-- content hashes and the journal's "when" value (created_at), not migration
-- tags. Match created_at against the CASE below to identify local entries.
select
  id,
  hash,
  created_at,
  case created_at
    when 1792103152528 then '0000_migration'
    when 1792113809380 then '0001_minas_gerais_timezone'
    when 1792113809381 then '0002_order_professional_snapshot'
    when 1792114447216 then '0003_booking_window_and_professionals'
    else 'unknown journal timestamp'
  end as journal_entry
from drizzle.__drizzle_migrations
order by created_at, id;

-- 2. Expected relations and critical columns. A missing row means the
-- relation/column is not present; no application data is selected.
with expected(table_name, column_name) as (
  values
    ('settings', 'timezone'),
    ('settings', 'schedule'),
    ('orders', 'professional_name'),
    ('orders', 'professional_phone'),
    ('bookings', 'booking_date'),
    ('bookings', 'slot_time'),
    ('bookings', 'status'),
    ('professionals', 'id'),
    ('professionals', 'name'),
    ('professionals', 'whatsapp'),
    ('professionals', 'active'),
    ('professionals', 'updated_at')
)
select
  expected.table_name,
  expected.column_name,
  information_schema.columns.data_type,
  information_schema.columns.is_nullable
from expected
left join information_schema.columns
  on information_schema.columns.table_schema = 'public'
  and information_schema.columns.table_name = expected.table_name
  and information_schema.columns.column_name = expected.column_name
order by expected.table_name, expected.column_name;

-- 3. Confirm the configured timezone and exact weekly schedule without
-- returning orders, reservations, customer information, or contact details.
select
  timezone,
  schedule = '{
    "0": [],
    "1": ["08:00", "10:00", "12:00", "13:30", "14:30", "15:30", "16:30"],
    "2": ["08:00", "10:00", "12:00", "13:30", "14:30", "15:30", "16:30"],
    "3": ["08:00", "10:00", "12:00", "13:30", "14:30", "15:30", "16:30"],
    "4": ["08:00", "10:00", "12:00", "13:30", "14:30", "15:30", "16:30"],
    "5": ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
    "6": ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
  }'::jsonb as schedule_matches_expected
from public.settings
where id = 1;

-- 4. Check the seeded professional records without displaying names or numbers.
-- This also completes safely when the table has not been created.
do $diagnostic$
declare
  tiago_matches boolean;
  heitor_matches boolean;
begin
  if to_regclass('public.professionals') is null then
    raise notice 'professionals table: MISSING';
  else
    execute $query$
      select
        exists (
          select 1 from public.professionals
          where id = 'professional-1'
            and name = 'Tiago'
            and whatsapp = '5531982368541'
            and active
        ),
        exists (
          select 1 from public.professionals
          where id = 'professional-2'
            and name = 'Heitor'
            and whatsapp = '553192531495'
            and active
        )
    $query$
    into tiago_matches, heitor_matches;

    raise notice 'professional seed matches expected values: Tiago=%, Heitor=%',
      tiago_matches, heitor_matches;
  end if;
end
$diagnostic$;

-- 5. Check RLS, grants, and policies on tables containing customer data or
-- professional configuration. Policy expressions are metadata, not row data.
select
  table_name,
  row_security_enabled,
  anon_can_select,
  authenticated_can_select
from (
  select
    c.relname as table_name,
    c.relrowsecurity as row_security_enabled,
    has_table_privilege('anon', c.oid, 'select') as anon_can_select,
    has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('orders', 'order_items', 'bookings', 'user_roles', 'professionals')
) as access_checks
order by table_name;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items', 'bookings', 'user_roles', 'professionals')
order by tablename, policyname;

-- 6. Inspect the deployed availability function definition and execute grants.
-- The function body must use America/Sao_Paulo and reject dates outside
-- tomorrow through today + 7 before it reads the weekly schedule.
select
  to_regprocedure('public.get_availability(date)') as availability_function,
  has_function_privilege('anon', to_regprocedure('public.get_availability(date)'), 'execute') as anon_can_execute,
  has_function_privilege('authenticated', to_regprocedure('public.get_availability(date)'), 'execute') as authenticated_can_execute,
  pg_get_functiondef(to_regprocedure('public.get_availability(date)')) as function_definition;

-- 7. Harmless RPC probes for dates relative to São Paulo's current date.
-- Expected: zero slots at offsets -1, 0 and 8; configured schedule slots at
-- offsets 1 through 7. This returns slot counts only, never customer data.
do $diagnostic$
declare
  sao_paulo_today date := (now() at time zone 'America/Sao_Paulo')::date;
  offset_days integer;
  returned_slots bigint;
begin
  if to_regprocedure('public.get_availability(date)') is null then
    raise notice 'get_availability(date): MISSING';
  else
    for offset_days in -1..8 loop
      execute 'select count(*) from public.get_availability($1)'
        into returned_slots
        using sao_paulo_today + offset_days;
      raise notice 'availability offset %, date %, returned slots %',
        offset_days, sao_paulo_today + offset_days, returned_slots;
    end loop;
  end if;
end
$diagnostic$;

-- 8. Confirm the single-active-booking constraint and cancellation trigger
-- exist without inspecting or changing any booking rows.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'bookings'
  and indexname = 'bookings_unique_active';

select trigger_name, event_object_table, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'orders_cancel_sync';
