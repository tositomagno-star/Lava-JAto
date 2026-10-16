CREATE OR REPLACE FUNCTION public.create_order(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz text;
  fee numeric := 0;
  d date;
  t text;
  st text;
  o_id uuid;
  o_code text;
  sub numeric := 0;
  it jsonb;
  svc record;
  q int;
  method text;
BEGIN
  SELECT timezone, pickup_fee INTO tz, fee FROM public.settings WHERE id = 1;
  d := (payload->>'date')::date;
  t := payload->>'time';
  method := payload->>'delivery_method';

  IF coalesce(trim(payload->>'customer_name'), '') = '' OR length(payload->>'customer_name') > 100 THEN
    RAISE EXCEPTION 'Informe seu nome.';
  END IF;
  IF coalesce(trim(payload->>'phone'), '') = '' OR length(payload->>'phone') > 30 THEN
    RAISE EXCEPTION 'Informe um telefone válido.';
  END IF;
  IF coalesce(trim(payload->>'vehicle_model'), '') = '' OR length(payload->>'vehicle_model') > 100 THEN
    RAISE EXCEPTION 'Informe o modelo do veículo.';
  END IF;
  IF method NOT IN ('dropoff', 'pickup') THEN
    RAISE EXCEPTION 'Escolha como será a entrega do veículo.';
  END IF;
  IF method = 'pickup' AND (
    coalesce(trim(payload->>'street'), '') = '' OR
    coalesce(trim(payload->>'district'), '') = ''
  ) THEN
    RAISE EXCEPTION 'Informe rua, número e bairro para a retirada.';
  END IF;
  IF length(coalesce(payload->>'notes', '')) > 1000 THEN
    RAISE EXCEPTION 'Observações muito longas.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.to_char(d, 'YYYY-MM-DD') || '|' || t, 0)
  );

  SELECT a.state INTO st
  FROM public.get_availability(d) AS a
  WHERE a.slot_time = t;
  IF st IS NULL THEN
    RAISE EXCEPTION 'Horário inválido para esta data.';
  END IF;
  IF st = 'past' THEN
    RAISE EXCEPTION 'Este horário já passou.';
  END IF;
  IF st <> 'free' THEN
    RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro.';
  END IF;

  IF jsonb_typeof(payload->'items') <> 'array' OR jsonb_array_length(payload->'items') = 0 THEN
    RAISE EXCEPTION 'Seu carrinho está vazio.';
  END IF;

  INSERT INTO public.orders (
    customer_name, phone, vehicle_model, plate, delivery_method, cep,
    street, district, complement, reference, notes, subtotal, pickup_fee, total
  )
  VALUES (
    trim(payload->>'customer_name'),
    trim(payload->>'phone'),
    trim(payload->>'vehicle_model'),
    nullif(trim(coalesce(payload->>'plate', '')), ''),
    method,
    CASE WHEN method = 'pickup' THEN nullif(trim(coalesce(payload->>'cep', '')), '') END,
    CASE WHEN method = 'pickup' THEN trim(payload->>'street') END,
    CASE WHEN method = 'pickup' THEN trim(payload->>'district') END,
    CASE WHEN method = 'pickup' THEN nullif(trim(coalesce(payload->>'complement', '')), '') END,
    CASE WHEN method = 'pickup' THEN nullif(trim(coalesce(payload->>'reference', '')), '') END,
    nullif(trim(coalesce(payload->>'notes', '')), ''),
    0, 0, 0
  )
  RETURNING id, code INTO o_id, o_code;

  FOR it IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    q := (it->>'quantity')::int;
    IF q IS NULL OR q < 1 OR q > 50 THEN
      RAISE EXCEPTION 'Quantidade inválida.';
    END IF;
    SELECT * INTO svc
    FROM public.services
    WHERE id = (it->>'service_id')::uuid AND active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Um serviço do carrinho não está mais disponível.';
    END IF;
    INSERT INTO public.order_items (
      order_id, service_id, service_name, quantity, unit_price, subtotal
    )
    VALUES (o_id, svc.id, svc.name, q, svc.price, svc.price * q);
    sub := sub + svc.price * q;
  END LOOP;

  IF method <> 'pickup' THEN
    fee := 0;
  END IF;
  UPDATE public.orders
  SET subtotal = sub, pickup_fee = fee, total = sub + fee
  WHERE id = o_id;

  BEGIN
    INSERT INTO public.bookings (order_id, booking_date, slot_time)
    VALUES (o_id, d, t);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro.';
  END;

  RETURN jsonb_build_object('id', o_id, 'code', o_code);
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.admin_set_slot_block(
  _date date,
  _slot_time text,
  _blocked boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _state text;
BEGIN
  IF _blocked IS NULL THEN
    RAISE EXCEPTION 'A ação de bloqueio é obrigatória.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.to_char(_date, 'YYYY-MM-DD') || '|' || _slot_time,
      0
    )
  );

  SELECT a.state INTO _state
  FROM public.get_availability(_date) AS a
  WHERE a.slot_time = _slot_time;
  IF _state IS NULL THEN
    RAISE EXCEPTION 'O horário não pertence à agenda disponível.';
  END IF;

  IF _blocked THEN
    IF _state <> 'free' THEN
      RAISE EXCEPTION 'Somente horários livres podem ser bloqueados.';
    END IF;
    INSERT INTO public.slot_blocks (block_date, slot_time, reason)
    VALUES (_date, _slot_time, 'Bloqueio administrativo');
    RETURN 'blocked';
  END IF;

  IF _state <> 'blocked' THEN
    RAISE EXCEPTION 'Este horário não está bloqueado.';
  END IF;
  DELETE FROM public.slot_blocks
  WHERE block_date = _date AND slot_time = _slot_time;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O bloqueio já foi removido.';
  END IF;

  SELECT a.state INTO _state
  FROM public.get_availability(_date) AS a
  WHERE a.slot_time = _slot_time;
  RETURN coalesce(_state, 'unavailable');
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.admin_set_slot_block(date, text, boolean)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_set_slot_block(date, text, boolean)
  TO service_role;
