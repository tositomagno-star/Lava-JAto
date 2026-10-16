ALTER TABLE public.orders
  ADD COLUMN confirmation_token uuid;
--> statement-breakpoint

CREATE UNIQUE INDEX orders_confirmation_token_unique
  ON public.orders (confirmation_token)
  WHERE confirmation_token IS NOT NULL;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.create_order_with_professional(
  _payload jsonb,
  _professional_name text,
  _professional_phone text,
  _confirmation_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_order jsonb;
  _created_order jsonb;
BEGIN
  IF _confirmation_token IS NULL THEN
    RAISE EXCEPTION 'A confirmation token is required';
  END IF;

  SELECT jsonb_build_object(
    'id', orders.id,
    'code', orders.code,
    'confirmation_token', orders.confirmation_token
  )
  INTO _existing_order
  FROM public.orders
  WHERE orders.confirmation_token = _confirmation_token;

  IF FOUND THEN
    RETURN _existing_order;
  END IF;

  _created_order := public.create_order_with_professional(
    _payload,
    _professional_name,
    _professional_phone
  );

  IF COALESCE(_created_order->>'id', '') = '' THEN
    RAISE EXCEPTION 'Order creation did not return an order ID';
  END IF;

  UPDATE public.orders
  SET confirmation_token = _confirmation_token
  WHERE id = (_created_order->>'id')::uuid
    AND confirmation_token IS NULL;

  IF NOT FOUND THEN
    SELECT jsonb_build_object(
      'id', orders.id,
      'code', orders.code,
      'confirmation_token', orders.confirmation_token
    )
    INTO _existing_order
    FROM public.orders
    WHERE orders.confirmation_token = _confirmation_token;

    IF FOUND THEN
      RETURN _existing_order;
    END IF;

    RAISE EXCEPTION 'Unable to associate the order with its confirmation token';
  END IF;

  RETURN _created_order || jsonb_build_object(
    'confirmation_token',
    _confirmation_token
  );
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.create_order_with_professional(jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_order_with_professional(jsonb, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_order_with_professional(jsonb, text, text, uuid)
  TO anon, authenticated;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.get_order_summary(_id uuid, _confirmation_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stored_token uuid;
BEGIN
  SELECT orders.confirmation_token
  INTO _stored_token
  FROM public.orders
  WHERE orders.id = _id;

  IF _stored_token IS NULL OR _stored_token IS DISTINCT FROM _confirmation_token THEN
    RAISE EXCEPTION 'Order not found or confirmation token is invalid'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.get_order_summary(_id);
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.get_order_summary(uuid)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_order_summary(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_order_summary(uuid, uuid)
  TO anon, authenticated;
