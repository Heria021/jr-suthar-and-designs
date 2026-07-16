create or replace function public.record_sale_payment(p_idempotency_key text, p_sale_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_sale public.sales%rowtype; v_amount numeric(14,2);
  v_due numeric(14,2); v_payment jsonb; v_allocation jsonb; v_payment_id uuid; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'record_sale_payment', jsonb_build_object('sale_id', p_sale_id, 'payload', p_payload));
  if v_replay is not null then return v_replay; end if;

  v_amount := (p_payload ->> 'amount')::numeric;
  if v_amount <= 0 then raise exception 'payment amount must be positive'; end if;

  select * into v_sale from public.sales where id = p_sale_id and status = 'finalized' for update;
  if not found then raise exception 'finalized sale not found'; end if;

  v_due := app.sale_due_for_update(p_sale_id);
  if v_amount > v_due then raise exception 'payment cannot exceed bill due'; end if;

  v_payment := public.record_payment(
    p_idempotency_key || ':payment',
    jsonb_build_object(
      'contact_id', v_sale.customer_id,
      'direction', 'in',
      'amount', v_amount,
      'payment_method', coalesce(nullif(p_payload ->> 'payment_method', ''), 'cash'),
      'reference_number', nullif(trim(coalesce(p_payload ->> 'reference_number', '')), ''),
      'notes', nullif(trim(coalesce(p_payload ->> 'notes', '')), ''),
      'auto_allocate', false
    )
  );

  v_payment_id := (v_payment ->> 'id')::uuid;
  v_allocation := public.allocate_payment(
    p_idempotency_key || ':allocation',
    v_payment_id,
    p_sale_id,
    null,
    v_amount
  );

  v_result := jsonb_build_object('id', v_payment_id, 'allocation_id', (v_allocation ->> 'id')::uuid);
  return app.idempotency_finish(p_idempotency_key, v_payment_id, v_result);
end;
$$;

create or replace function public.record_purchase_payment(p_idempotency_key text, p_purchase_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_purchase public.purchases%rowtype; v_amount numeric(14,2);
  v_due numeric(14,2); v_payment jsonb; v_allocation jsonb; v_payment_id uuid; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'record_purchase_payment', jsonb_build_object('purchase_id', p_purchase_id, 'payload', p_payload));
  if v_replay is not null then return v_replay; end if;

  v_amount := (p_payload ->> 'amount')::numeric;
  if v_amount <= 0 then raise exception 'payment amount must be positive'; end if;

  select * into v_purchase from public.purchases where id = p_purchase_id and status = 'finalized' for update;
  if not found then raise exception 'finalized purchase not found'; end if;

  v_due := app.purchase_due_for_update(p_purchase_id);
  if v_amount > v_due then raise exception 'payment cannot exceed purchase due'; end if;

  v_payment := public.record_payment(
    p_idempotency_key || ':payment',
    jsonb_build_object(
      'contact_id', v_purchase.supplier_id,
      'direction', 'out',
      'amount', v_amount,
      'payment_method', coalesce(nullif(p_payload ->> 'payment_method', ''), 'cash'),
      'reference_number', nullif(trim(coalesce(p_payload ->> 'reference_number', '')), ''),
      'notes', nullif(trim(coalesce(p_payload ->> 'notes', '')), ''),
      'auto_allocate', false
    )
  );

  v_payment_id := (v_payment ->> 'id')::uuid;
  v_allocation := public.allocate_payment(
    p_idempotency_key || ':allocation',
    v_payment_id,
    null,
    p_purchase_id,
    v_amount
  );

  v_result := jsonb_build_object('id', v_payment_id, 'allocation_id', (v_allocation ->> 'id')::uuid);
  return app.idempotency_finish(p_idempotency_key, v_payment_id, v_result);
end;
$$;
