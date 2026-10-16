-- Read-only production diagnostics. Run as an authorized database operator
-- in the Supabase SQL Editor. This file does not select customer/order rows,
-- mutate data, or expose credentials.
-- Before running any block, independently confirm the project ID shown in the
-- Supabase dashboard is jbrxnnzkewipjpixcbfa. SQL metadata alone cannot verify
-- that the dashboard is connected to the intended Supabase project.
-- Run sections 1-3 first. If a required relation is missing, record that
-- result and skip later sections that require it or its columns; do not
-- interpret a resulting query error as evidence that no other objects exist.

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
    when 1792151123401 then '0004_checkout_confirmation_token'
    when 1792166085760 then '0005_atomic_admin_slot_blocks'
    when 1792187240025 then '0006_schedule_and_motorcycle_price'
    else 'unknown journal timestamp'
  end as journal_entry
from drizzle.__drizzle_migrations
order by created_at, id;

-- 2. Expected relations and critical columns. A missing row means the
-- relation/column is not present; no application data is selected.
with expected(table_name, column_name) as (
  values
    ('services', 'id'),
    ('services', 'name'),
    ('services', 'description'),
    ('services', 'price'),
    ('services', 'image_key'),
    ('services', 'image_url'),
    ('services', 'active'),
    ('services', 'sort_order'),
    ('services', 'created_at'),
    ('settings', 'id'),
    ('settings', 'company_name'),
    ('settings', 'whatsapp'),
    ('settings', 'instagram'),
    ('settings', 'contact_info'),
    ('settings', 'address'),
    ('settings', 'timezone'),
    ('settings', 'schedule'),
    ('settings', 'slot_capacity'),
    ('settings', 'pickup_fee'),
    ('settings', 'updated_at'),
    ('orders', 'id'),
    ('orders', 'code'),
    ('orders', 'customer_name'),
    ('orders', 'phone'),
    ('orders', 'vehicle_model'),
    ('orders', 'plate'),
    ('orders', 'delivery_method'),
    ('orders', 'cep'),
    ('orders', 'street'),
    ('orders', 'district'),
    ('orders', 'complement'),
    ('orders', 'reference'),
    ('orders', 'notes'),
    ('orders', 'subtotal'),
    ('orders', 'pickup_fee'),
    ('orders', 'total'),
    ('orders', 'status'),
    ('orders', 'payment_status'),
    ('orders', 'paid_amount'),
    ('orders', 'created_at'),
    ('orders', 'updated_at'),
    ('orders', 'professional_name'),
    ('orders', 'professional_phone'),
    ('orders', 'confirmation_token'),
    ('order_items', 'id'),
    ('order_items', 'order_id'),
    ('order_items', 'service_id'),
    ('order_items', 'service_name'),
    ('order_items', 'quantity'),
    ('order_items', 'unit_price'),
    ('order_items', 'subtotal'),
    ('bookings', 'id'),
    ('bookings', 'order_id'),
    ('bookings', 'booking_date'),
    ('bookings', 'slot_time'),
    ('bookings', 'status'),
    ('bookings', 'created_at'),
    ('slot_blocks', 'id'),
    ('slot_blocks', 'block_date'),
    ('slot_blocks', 'slot_time'),
    ('slot_blocks', 'reason'),
    ('slot_blocks', 'created_at'),
    ('user_roles', 'id'),
    ('user_roles', 'user_id'),
    ('user_roles', 'role'),
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

-- Verify the application role enum exists without inspecting user-role rows.
select n.nspname as schema_name, t.typname as enum_name, e.enumlabel, e.enumsortorder
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
  and t.typname = 'app_role'
order by e.enumsortorder;

-- 3. Confirm expected tables exist. This reads catalog metadata only.
with expected(table_name) as (
  values
    ('user_roles'),
    ('services'),
    ('settings'),
    ('orders'),
    ('order_items'),
    ('bookings'),
    ('slot_blocks'),
    ('professionals')
)
select
  expected.table_name,
  to_regclass(format('public.%I', expected.table_name)) is not null as exists
from expected
order by expected.table_name;

-- 4. Confirm the configured timezone and exact weekly schedule without
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

-- 5. Report service/settings counts only; no service or customer data is shown.
-- Run only after confirming both relations exist in the preceding result.
select
  (select count(*) from public.services where active) as active_service_count,
  (select count(*) from public.settings where id = 1) as settings_singleton_count;

-- 6. Check the seeded professional records without displaying names or numbers.
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

-- 7. Check RLS, grants, and policies on tables containing customer data or
-- professional configuration. Policy expressions are metadata, not row data.
select
  table_name,
  row_security_enabled,
  anon_can_insert,
  anon_can_select,
  anon_can_update,
  anon_can_delete,
  authenticated_can_insert,
  authenticated_can_select,
  authenticated_can_update,
  authenticated_can_delete,
  service_role_can_select,
  service_role_can_insert,
  service_role_can_update,
  service_role_can_delete
from (
  select
    c.relname as table_name,
    c.relrowsecurity as row_security_enabled,
    has_table_privilege('anon', c.oid, 'insert') as anon_can_insert,
    has_table_privilege('anon', c.oid, 'select') as anon_can_select,
    has_table_privilege('anon', c.oid, 'update') as anon_can_update,
    has_table_privilege('anon', c.oid, 'delete') as anon_can_delete,
    has_table_privilege('authenticated', c.oid, 'insert') as authenticated_can_insert,
    has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select,
    has_table_privilege('authenticated', c.oid, 'update') as authenticated_can_update,
    has_table_privilege('authenticated', c.oid, 'delete') as authenticated_can_delete,
    has_table_privilege('service_role', c.oid, 'select') as service_role_can_select,
    has_table_privilege('service_role', c.oid, 'insert') as service_role_can_insert,
    has_table_privilege('service_role', c.oid, 'update') as service_role_can_update,
    has_table_privilege('service_role', c.oid, 'delete') as service_role_can_delete
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'user_roles',
      'services',
      'settings',
      'orders',
      'order_items',
      'bookings',
      'slot_blocks',
      'professionals'
    )
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
  and tablename in (
    'user_roles',
    'services',
    'settings',
    'orders',
    'order_items',
    'bookings',
    'slot_blocks',
    'professionals'
  )
order by tablename, policyname;

-- 8. Inspect all public-table constraints and indexes relevant to the app.
-- These catalog definitions contain no row data.
select
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'user_roles',
    'services',
    'settings',
    'orders',
    'order_items',
    'bookings',
    'slot_blocks',
    'professionals'
  )
order by c.relname, con.conname;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'user_roles',
    'services',
    'settings',
    'orders',
    'order_items',
    'bookings',
    'slot_blocks',
    'professionals'
  )
order by tablename, indexname;

select
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('orders', 'bookings', 'services', 'professionals');

-- 9. Inspect deployed RPC definitions and grants. Function definitions are
-- code metadata only; no customer/order rows are returned.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as argument_types,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'has_role',
    'create_order',
    'create_order_with_professional',
    'get_order_summary',
    'get_availability',
    'admin_set_slot_block'
  )
order by p.proname, argument_types;

-- 10. Inspect the deployed availability function definition and execute grants.
-- The function body must use America/Sao_Paulo and reject dates outside
-- tomorrow through today + 7 before it reads the weekly schedule.
select
  to_regprocedure('public.get_availability(date)') as availability_function,
  has_function_privilege('anon', to_regprocedure('public.get_availability(date)'), 'execute') as anon_can_execute,
  has_function_privilege('authenticated', to_regprocedure('public.get_availability(date)'), 'execute') as authenticated_can_execute,
  pg_get_functiondef(to_regprocedure('public.get_availability(date)')) as function_definition;

-- 11. Harmless RPC probes for dates relative to São Paulo's current date.
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

-- 12. Confirm active-booking and confirmation-token uniqueness constraints
-- and the cancellation trigger exist without inspecting or changing any rows.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'orders'
  and indexname = 'orders_confirmation_token_unique';

-- Confirm the single-active-booking constraint and cancellation trigger
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
