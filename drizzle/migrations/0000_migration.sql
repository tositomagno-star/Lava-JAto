
-- Roles
create type public.app_role as enum ('admin');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- First registered user becomes admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.handle_first_admin();

-- Services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  image_key text not null default 'car',
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "public read active services" on public.services for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "admin manage services" on public.services for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.services (name, description, price, image_key, sort_order) values
('Ducha','Enxágue rápido para remover poeira e sujeira leve.',30.00,'shower',1),
('Motocicleta','Lavagem cuidadosa da sua moto, com atenção a cada detalhe.',40.00,'moto',2),
('Lavagem externa','Lataria, rodas e vidros limpos por fora.',35.00,'car',3),
('Limpeza interna','Aspiração, painel e acabamento interno renovados.',35.00,'interior',4),
('Lavagem simples','Externa com acabamento básico interno.',40.00,'car',5),
('Lavagem completa — carro pequeno (P)','Completa por dentro e por fora para carros compactos.',65.00,'car',6),
('Lavagem completa — carro médio (M)','Completa por dentro e por fora para sedãs e hatches médios.',75.00,'car',7),
('Lavagem completa — carro grande (G)','Completa por dentro e por fora para SUVs e carros grandes.',85.00,'suv',8),
('Lavagem completa — caminhonete','Completa para caminhonetes, caçamba inclusa.',90.00,'pickup',9),
('Lavagem — caminhonete mineradora','Lavagem pesada para caminhonetes de mineração, com remoção de barro.',100.00,'pickup',10);

-- Settings (singleton)
create table public.settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'Moto Car',
  whatsapp text,
  instagram text,
  contact_info text,
  address text,
  timezone text not null default 'America/Sao_Paulo',
  slot_capacity int not null default 1 check (slot_capacity >= 1),
  pickup_fee numeric(10,2) not null default 0 check (pickup_fee >= 0),
  schedule jsonb not null default '{
    "1":["08:00","10:00","12:00","13:30","14:30","15:30","16:30"],
    "2":["08:00","10:00","12:00","13:30","14:30","15:30","16:30"],
    "3":["08:00","10:00","12:00","13:30","14:30","15:30","16:30"],
    "4":["08:00","10:00","12:00","13:30","14:30","15:30","16:30"],
    "5":["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"],
    "6":["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"],
    "0":[]
  }'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);
grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "public read settings" on public.settings for select to anon, authenticated using (true);
create policy "admin update settings" on public.settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(md5(gen_random_uuid()::text),1,6)),
  customer_name text not null,
  phone text not null,
  vehicle_model text not null,
  plate text,
  delivery_method text not null check (delivery_method in ('dropoff','pickup')),
  cep text, street text, district text, complement text, reference text,
  notes text,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  pickup_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null check (total >= 0),
  status text not null default 'awaiting_send' check (status in ('awaiting_send','awaiting_confirmation','confirmed','completed','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  paid_amount numeric(10,2) not null default 0 check (paid_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "admin read orders" on public.orders for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  quantity int not null check (quantity between 1 and 50),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0)
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "admin read items" on public.order_items for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  booking_date date not null,
  slot_time text not null,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now()
);
create unique index bookings_unique_active on public.bookings (booking_date, slot_time) where status = 'active';
grant select, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "admin read bookings" on public.bookings for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin update bookings" on public.bookings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.slot_blocks (
  id uuid primary key default gen_random_uuid(),
  block_date date not null,
  slot_time text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (block_date, slot_time)
);
grant select, insert, delete on public.slot_blocks to authenticated;
grant all on public.slot_blocks to service_role;
alter table public.slot_blocks enable row level security;
create policy "admin manage blocks" on public.slot_blocks for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Cancelling an order frees its booking
create or replace function public.sync_booking_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.bookings set status = 'cancelled' where order_id = new.id;
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger orders_cancel_sync before update on public.orders for each row execute function public.sync_booking_on_cancel();

-- Availability (no personal data); computed from real Brasília time on every call
create or replace function public.get_availability(_date date)
returns table(slot_time text, state text)
language plpgsql stable security definer set search_path = public as $$
declare
  tz text; sched jsonb; now_local timestamp; dow int;
begin
  select s.timezone, s.schedule into tz, sched from public.settings s where id = 1;
  now_local := now() at time zone tz;
  dow := extract(dow from _date)::int;
  return query
  select t.v::text,
    case
      when (_date + t.v::time) <= now_local then 'past'
      when exists (select 1 from public.slot_blocks b where b.block_date = _date and b.slot_time = t.v) then 'blocked'
      when exists (select 1 from public.bookings k where k.booking_date = _date and k.slot_time = t.v and k.status = 'active') then 'booked'
      else 'free'
    end
  from jsonb_array_elements_text(coalesce(sched -> dow::text, '[]'::jsonb)) as t(v);
end $$;
grant execute on function public.get_availability(date) to anon, authenticated;

-- Atomic order creation with server-side price & slot validation
create or replace function public.create_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tz text; fee numeric := 0; d date; t text; st text;
  o_id uuid; o_code text; sub numeric := 0; it jsonb; svc record; q int;
  method text;
begin
  select timezone, pickup_fee into tz, fee from public.settings where id = 1;
  d := (payload->>'date')::date;
  t := payload->>'time';
  method := payload->>'delivery_method';

  if coalesce(trim(payload->>'customer_name'),'') = '' or length(payload->>'customer_name') > 100 then raise exception 'Informe seu nome.'; end if;
  if coalesce(trim(payload->>'phone'),'') = '' or length(payload->>'phone') > 30 then raise exception 'Informe um telefone válido.'; end if;
  if coalesce(trim(payload->>'vehicle_model'),'') = '' or length(payload->>'vehicle_model') > 100 then raise exception 'Informe o modelo do veículo.'; end if;
  if method not in ('dropoff','pickup') then raise exception 'Escolha como será a entrega do veículo.'; end if;
  if method = 'pickup' and (coalesce(trim(payload->>'street'),'') = '' or coalesce(trim(payload->>'district'),'') = '') then
    raise exception 'Informe rua, número e bairro para a retirada.';
  end if;
  if length(coalesce(payload->>'notes','')) > 1000 then raise exception 'Observações muito longas.'; end if;

  select a.state into st from public.get_availability(d) a where a.slot_time = t;
  if st is null then raise exception 'Horário inválido para esta data.'; end if;
  if st = 'past' then raise exception 'Este horário já passou.'; end if;
  if st <> 'free' then raise exception 'Este horário acabou de ser reservado. Escolha outro.'; end if;

  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then
    raise exception 'Seu carrinho está vazio.';
  end if;

  insert into public.orders (customer_name, phone, vehicle_model, plate, delivery_method, cep, street, district, complement, reference, notes, subtotal, pickup_fee, total)
  values (trim(payload->>'customer_name'), trim(payload->>'phone'), trim(payload->>'vehicle_model'), nullif(trim(coalesce(payload->>'plate','')),''),
    method,
    case when method='pickup' then nullif(trim(coalesce(payload->>'cep','')),'') end,
    case when method='pickup' then trim(payload->>'street') end,
    case when method='pickup' then trim(payload->>'district') end,
    case when method='pickup' then nullif(trim(coalesce(payload->>'complement','')),'') end,
    case when method='pickup' then nullif(trim(coalesce(payload->>'reference','')),'') end,
    nullif(trim(coalesce(payload->>'notes','')),''), 0, 0, 0)
  returning id, code into o_id, o_code;

  for it in select * from jsonb_array_elements(payload->'items') loop
    q := (it->>'quantity')::int;
    if q is null or q < 1 or q > 50 then raise exception 'Quantidade inválida.'; end if;
    select * into svc from public.services where id = (it->>'service_id')::uuid and active;
    if not found then raise exception 'Um serviço do carrinho não está mais disponível.'; end if;
    insert into public.order_items (order_id, service_id, service_name, quantity, unit_price, subtotal)
    values (o_id, svc.id, svc.name, q, svc.price, svc.price * q);
    sub := sub + svc.price * q;
  end loop;

  if method <> 'pickup' then fee := 0; end if;
  update public.orders set subtotal = sub, pickup_fee = fee, total = sub + fee where id = o_id;

  begin
    insert into public.bookings (order_id, booking_date, slot_time) values (o_id, d, t);
  exception when unique_violation then
    raise exception 'Este horário acabou de ser reservado. Escolha outro.';
  end;

  return jsonb_build_object('id', o_id, 'code', o_code);
end $$;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- Public order summary by unguessable id (for the confirmation page)
create or replace function public.get_order_summary(_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'customer_name', o.customer_name, 'phone', o.phone,
    'vehicle_model', o.vehicle_model, 'plate', o.plate, 'delivery_method', o.delivery_method,
    'cep', o.cep, 'street', o.street, 'district', o.district, 'complement', o.complement, 'reference', o.reference,
    'notes', o.notes, 'subtotal', o.subtotal, 'pickup_fee', o.pickup_fee, 'total', o.total, 'status', o.status,
    'booking_date', b.booking_date, 'slot_time', b.slot_time,
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.service_name, 'quantity', i.quantity, 'unit_price', i.unit_price, 'subtotal', i.subtotal)) from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o left join public.bookings b on b.order_id = o.id
  where o.id = _id
$$;
grant execute on function public.get_order_summary(uuid) to anon, authenticated;
