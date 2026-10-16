-- Update only the active service catalog price and the public booking schedule.
-- Existing order_items keep their recorded unit_price and subtotal snapshots.
do $migration$
declare
  motorcycle_count integer;
  motorcycle_id uuid;
  motorcycle_price numeric(10, 2);
begin
  select count(*)
  into motorcycle_count
  from public.services
  where name = 'Motocicleta'
    and image_key = 'moto';

  if motorcycle_count <> 1 then
    raise exception
      'Expected exactly one Motocicleta service with image_key=moto; found %',
      motorcycle_count;
  end if;

  select id, price
  into motorcycle_id, motorcycle_price
  from public.services
  where name = 'Motocicleta'
    and image_key = 'moto';

  if motorcycle_price = 40.00 then
    update public.services
    set price = 50.00
    where id = motorcycle_id;
  elsif motorcycle_price <> 50.00 then
    raise exception
      'Expected Motocicleta price to be R$ 40.00 or R$ 50.00; found R$ %',
      motorcycle_price;
  end if;

  if not exists (select 1 from public.settings where id = 1) then
    raise exception 'Expected the Moto Car settings row (id=1) to exist';
  end if;

  update public.settings
  set schedule = '{
    "1":["08:00","10:00","12:00","13:30","14:30","15:30","16:30"],
    "2":["08:00","10:00","12:00","13:30","14:30","15:30","16:30"],
    "3":["08:00","10:00","12:00","13:30","14:30","15:30","16:30"],
    "4":["08:00","10:00","12:00","13:30","14:30","15:30","16:30"],
    "5":["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"],
    "6":["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"],
    "0":[]
  }'::jsonb,
  updated_at = now()
  where id = 1;
end;
$migration$;
