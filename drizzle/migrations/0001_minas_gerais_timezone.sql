-- Pin availability calculations to the business timezone without touching
-- existing schedules, bookings, orders, or order history.
alter table public.settings
  alter column timezone set default 'America/Sao_Paulo';

update public.settings
set timezone = 'America/Sao_Paulo'
where timezone is distinct from 'America/Sao_Paulo';

create or replace function public.get_availability(_date date)
returns table(slot_time text, state text)
language plpgsql stable security definer set search_path = public as $$
declare
  sched jsonb; now_local timestamp; dow int;
begin
  select s.schedule into sched from public.settings s where id = 1;
  now_local := now() at time zone 'America/Sao_Paulo';
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
