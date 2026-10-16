create table public.professionals (
  id text primary key,
  name text not null check (length(trim(name)) between 1 and 100),
  whatsapp text not null check (whatsapp ~ '^55[0-9]{10,11}$'),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.professionals enable row level security;
grant select on public.professionals to anon, authenticated;
grant insert, update, delete on public.professionals to authenticated;
grant all on public.professionals to service_role;

create policy "public read active professionals"
  on public.professionals for select to anon, authenticated
  using (active or public.has_role(auth.uid(), 'admin'));

create policy "admin manage professionals"
  on public.professionals for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.professionals (id, name, whatsapp, active)
values
  ('professional-1', 'Tiago', '5531982368541', true),
  ('professional-2', 'Heitor', '553192531495', true)
on conflict (id) do nothing;

create or replace function public.get_availability(_date date)
returns table(slot_time text, state text)
language plpgsql stable security definer set search_path = public as $$
declare
  sched jsonb;
  now_local timestamp;
  today_local date;
  dow int;
begin
  now_local := now() at time zone 'America/Sao_Paulo';
  today_local := now_local::date;
  if _date < today_local + 1 or _date > today_local + 7 then
    return;
  end if;

  select s.schedule into sched from public.settings s where id = 1;
  dow := extract(dow from _date)::int;
  return query
  select t.v::text,
    case
      when exists (select 1 from public.slot_blocks b where b.block_date = _date and b.slot_time = t.v) then 'blocked'
      when exists (select 1 from public.bookings k where k.booking_date = _date and k.slot_time = t.v and k.status = 'active') then 'booked'
      else 'free'
    end
  from jsonb_array_elements_text(coalesce(sched -> dow::text, '[]'::jsonb)) as t(v);
end $$;

create or replace function public.create_order_with_professional(
  _payload jsonb,
  _professional_name text,
  _professional_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  normalized_phone text;
  booking_day date;
  today_local date;
begin
  if coalesce(trim(_professional_name), '') = '' or length(trim(_professional_name)) > 100 then
    raise exception 'Selecione um profissional válido.';
  end if;

  normalized_phone := regexp_replace(coalesce(_professional_phone, ''), '[^0-9]', '', 'g');
  if normalized_phone !~ '^55[0-9]{10,11}$' or not exists (
    select 1
    from public.professionals p
    where p.active
      and p.name = trim(_professional_name)
      and p.whatsapp = normalized_phone
  ) then
    raise exception 'O profissional selecionado está inativo ou não está configurado.';
  end if;

  today_local := (now() at time zone 'America/Sao_Paulo')::date;
  booking_day := ( _payload->>'date' )::date;
  if booking_day < today_local + 1 or booking_day > today_local + 7 then
    raise exception 'O agendamento deve ser feito de amanhã até 7 dias à frente.';
  end if;

  result := public.create_order(_payload);

  update public.orders
  set professional_name = trim(_professional_name),
      professional_phone = normalized_phone
  where id = (result->>'id')::uuid;

  return result;
end;
$$;

revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.get_availability(date) to anon, authenticated;
grant execute on function public.create_order_with_professional(jsonb, text, text) to anon, authenticated;
