alter table public.orders
  add column professional_name text,
  add column professional_phone text;

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
begin
  if coalesce(trim(_professional_name), '') = '' or length(trim(_professional_name)) > 100 then
    raise exception 'Selecione um profissional válido.';
  end if;

  normalized_phone := regexp_replace(coalesce(_professional_phone, ''), '[^0-9]', '', 'g');
  if normalized_phone !~ '^55[0-9]{10,11}$' then
    raise exception 'O WhatsApp do profissional selecionado é inválido.';
  end if;

  result := public.create_order(_payload);

  update public.orders
  set professional_name = trim(_professional_name),
      professional_phone = normalized_phone
  where id = (result->>'id')::uuid;

  return result;
end;
$$;

grant execute on function public.create_order_with_professional(jsonb, text, text) to anon, authenticated;

create or replace function public.get_order_summary(_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'code', o.code,
    'customer_name', o.customer_name,
    'phone', o.phone,
    'vehicle_model', o.vehicle_model,
    'plate', o.plate,
    'delivery_method', o.delivery_method,
    'cep', o.cep,
    'street', o.street,
    'district', o.district,
    'complement', o.complement,
    'reference', o.reference,
    'notes', o.notes,
    'subtotal', o.subtotal,
    'pickup_fee', o.pickup_fee,
    'total', o.total,
    'status', o.status,
    'professional_name', o.professional_name,
    'professional_phone', o.professional_phone,
    'booking_date', b.booking_date,
    'slot_time', b.slot_time,
    'items', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'name', i.service_name,
          'quantity', i.quantity,
          'unit_price', i.unit_price,
          'subtotal', i.subtotal
        ))
        from public.order_items i
        where i.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  from public.orders o
  left join public.bookings b on b.order_id = o.id
  where o.id = _id
$$;

grant execute on function public.get_order_summary(uuid) to anon, authenticated;
