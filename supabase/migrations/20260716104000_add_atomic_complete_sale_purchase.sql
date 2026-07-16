create or replace function public.finalize_sale(p_idempotency_key text, p_sale_id uuid, p_discount_amount numeric default null, p_initial_payment jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_sale public.sales%rowtype;
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
  v_total numeric(14,2);
  v_payment_amount numeric(14,2);
  v_item record;
  v_product public.products%rowtype;
  v_payment jsonb;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'finalize_sale', jsonb_build_object('sale_id', p_sale_id, 'discount', p_discount_amount, 'payment', p_initial_payment));
  if v_replay is not null then return v_replay; end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or v_sale.status <> 'draft' then raise exception 'sale must be draft'; end if;
  select coalesce(sum(line_total), 0)::numeric(14,2) into v_subtotal from public.sale_items where sale_id = p_sale_id;
  if v_subtotal <= 0 then raise exception 'sale must have at least one item'; end if;
  v_discount := coalesce(p_discount_amount, v_sale.discount_amount, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'invalid discount'; end if;
  v_total := v_subtotal - v_discount;
  v_payment_amount := coalesce((p_initial_payment ->> 'amount')::numeric, 0);
  if v_payment_amount < 0 then raise exception 'payment amount cannot be negative'; end if;
  if v_payment_amount > v_total then raise exception 'payment cannot exceed bill total'; end if;

  for v_item in select * from public.sale_items where sale_id = p_sale_id order by id loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if v_product.stock_on_hand < v_item.base_quantity then
      raise exception 'insufficient stock for product %', v_product.name;
    end if;
    update public.products
    set stock_on_hand = stock_on_hand - v_item.base_quantity,
        version = v_product.version
    where id = v_product.id;
    insert into public.stock_movements (
      product_id, movement_type, quantity_delta, sale_item_id, reason, stock_before, stock_after
    ) values (
      v_product.id, 'sale', -v_item.base_quantity, v_item.id, 'sale finalized',
      v_product.stock_on_hand, v_product.stock_on_hand - v_item.base_quantity
    );
  end loop;

  update public.sales
  set subtotal = v_subtotal,
      discount_amount = v_discount,
      total_amount = v_total,
      status = 'finalized',
      finalized_at = now(),
      version = v_sale.version
  where id = p_sale_id;

  if p_initial_payment is not null and v_payment_amount > 0 then
    v_payment := public.record_payment(
      p_idempotency_key || ':initial-payment',
      jsonb_build_object(
        'contact_id', v_sale.customer_id,
        'direction', 'in',
        'amount', v_payment_amount,
        'payment_method', coalesce(p_initial_payment ->> 'payment_method', 'cash'),
        'reference_number', p_initial_payment ->> 'reference_number',
        'notes', p_initial_payment ->> 'notes'
      )
    );
    perform public.allocate_payment(p_idempotency_key || ':initial-allocation', (v_payment ->> 'id')::uuid, p_sale_id, null, v_payment_amount);
  end if;

  v_result := jsonb_build_object('id', p_sale_id, 'total_amount', v_total);
  return app.idempotency_finish(p_idempotency_key, p_sale_id, v_result);
end;
$$;

create or replace function public.finalize_purchase(p_idempotency_key text, p_purchase_id uuid, p_discount_amount numeric default null, p_additional_cost numeric default null, p_initial_payment jsonb default null, p_update_product_cost boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_purchase public.purchases%rowtype; v_subtotal numeric(14,2);
  v_discount numeric(14,2); v_additional numeric(14,2); v_total numeric(14,2);
  v_payment_amount numeric(14,2); v_item record; v_product public.products%rowtype; v_payment jsonb; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'finalize_purchase', jsonb_build_object('purchase_id', p_purchase_id, 'discount', p_discount_amount, 'additional', p_additional_cost, 'payment', p_initial_payment, 'update_cost', p_update_product_cost));
  if v_replay is not null then return v_replay; end if;
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found or v_purchase.status <> 'draft' then raise exception 'purchase must be draft'; end if;
  select coalesce(sum(line_total), 0)::numeric(14,2) into v_subtotal from public.purchase_items where purchase_id = p_purchase_id;
  if v_subtotal <= 0 then raise exception 'purchase must have at least one item'; end if;
  v_discount := coalesce(p_discount_amount, v_purchase.discount_amount, 0);
  v_additional := coalesce(p_additional_cost, v_purchase.additional_cost, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'invalid discount'; end if;
  if v_additional < 0 then raise exception 'additional cost cannot be negative'; end if;
  v_total := v_subtotal - v_discount + v_additional;
  v_payment_amount := coalesce((p_initial_payment ->> 'amount')::numeric, 0);
  if v_payment_amount < 0 then raise exception 'payment amount cannot be negative'; end if;
  if v_payment_amount > v_total then raise exception 'payment cannot exceed purchase total'; end if;

  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id order by id loop
    select * into v_product from public.products where id = v_item.product_id for update;
    update public.products
    set stock_on_hand = stock_on_hand + v_item.base_quantity,
        loose_cost_price = case when p_update_product_cost and v_item.entry_mode = 'loose' then v_item.cost_per_entry else loose_cost_price end,
        box_cost_price = case when p_update_product_cost and v_item.entry_mode = 'box' then v_item.cost_per_entry else box_cost_price end,
        version = v_product.version
    where id = v_product.id;
    insert into public.stock_movements (
      product_id, movement_type, quantity_delta, purchase_item_id, reason, stock_before, stock_after
    ) values (
      v_product.id, 'purchase', v_item.base_quantity, v_item.id, 'purchase finalized',
      v_product.stock_on_hand, v_product.stock_on_hand + v_item.base_quantity
    );
  end loop;

  update public.purchases
  set subtotal = v_subtotal,
      discount_amount = v_discount,
      additional_cost = v_additional,
      total_amount = v_total,
      status = 'finalized',
      finalized_at = now(),
      version = v_purchase.version
  where id = p_purchase_id;

  if p_initial_payment is not null and v_payment_amount > 0 then
    v_payment := public.record_payment(
      p_idempotency_key || ':initial-payment',
      jsonb_build_object(
        'contact_id', v_purchase.supplier_id,
        'direction', 'out',
        'amount', v_payment_amount,
        'payment_method', coalesce(p_initial_payment ->> 'payment_method', 'cash'),
        'reference_number', p_initial_payment ->> 'reference_number',
        'notes', p_initial_payment ->> 'notes'
      )
    );
    perform public.allocate_payment(p_idempotency_key || ':initial-allocation', (v_payment ->> 'id')::uuid, null, p_purchase_id, v_payment_amount);
  end if;

  v_result := jsonb_build_object('id', p_purchase_id, 'total_amount', v_total);
  return app.idempotency_finish(p_idempotency_key, p_purchase_id, v_result);
end;
$$;

create or replace function public.complete_sale(p_idempotency_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_customer_id uuid; v_customer jsonb; v_sale jsonb; v_sale_id uuid;
  v_item record; v_items jsonb; v_subtotal numeric(14,2); v_discount numeric(14,2);
  v_total numeric(14,2); v_payment jsonb; v_payment_amount numeric(14,2); v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'complete_sale', p_payload);
  if v_replay is not null then return v_replay; end if;

  v_customer_id := nullif(p_payload ->> 'customer_id', '')::uuid;
  if v_customer_id is null then
    v_customer := coalesce(p_payload -> 'customer', '{}'::jsonb);
    if length(trim(coalesce(v_customer ->> 'name', ''))) = 0 then raise exception 'customer name is required'; end if;
    v_customer := v_customer || jsonb_build_object(
      'contact_type', 'customer',
      'opening_balance', 0,
      'opening_balance_date', current_date
    );
    v_customer_id := (public.create_contact(p_idempotency_key || ':customer', v_customer) ->> 'id')::uuid;
  else
    perform app.assert_contact_role(v_customer_id, array['customer', 'walk_in']);
  end if;

  v_items := coalesce(p_payload -> 'items', '[]'::jsonb);
  if jsonb_array_length(v_items) = 0 then raise exception 'sale must have at least one item'; end if;

  v_sale := public.create_draft_sale(
    p_idempotency_key || ':draft',
    jsonb_build_object(
      'customer_id', v_customer_id,
      'sale_date', coalesce(nullif(p_payload ->> 'sale_date', ''), current_date::text),
      'discount_amount', coalesce((p_payload ->> 'discount_amount')::numeric, 0),
      'notes', nullif(trim(coalesce(p_payload ->> 'notes', '')), '')
    )
  );
  v_sale_id := (v_sale ->> 'id')::uuid;

  for v_item in select value, ordinality from jsonb_array_elements(v_items) with ordinality loop
    perform public.add_sale_item(
      p_idempotency_key || ':item:' || v_item.ordinality::text,
      v_sale_id,
      (v_item.value ->> 'product_id')::uuid,
      coalesce(v_item.value ->> 'entry_mode', 'loose'),
      (v_item.value ->> 'quantity')::integer,
      case when nullif(v_item.value ->> 'price_per_entry', '') is null then null else (v_item.value ->> 'price_per_entry')::numeric end
    );
  end loop;

  select coalesce(sum(line_total), 0)::numeric(14,2) into v_subtotal from public.sale_items where sale_id = v_sale_id;
  v_discount := coalesce((p_payload ->> 'discount_amount')::numeric, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'invalid discount'; end if;
  v_total := v_subtotal - v_discount;
  v_payment := p_payload -> 'initial_payment';
  v_payment_amount := coalesce((v_payment ->> 'amount')::numeric, 0);
  if v_payment_amount < 0 then raise exception 'payment amount cannot be negative'; end if;
  if v_payment_amount > v_total then raise exception 'payment cannot exceed bill total'; end if;

  v_result := public.finalize_sale(
    p_idempotency_key || ':finalize',
    v_sale_id,
    v_discount,
    case when v_payment_amount > 0 then v_payment else null end
  );

  return app.idempotency_finish(p_idempotency_key, v_sale_id, v_result);
end;
$$;

create or replace function public.complete_purchase(p_idempotency_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_supplier_id uuid; v_supplier jsonb; v_purchase jsonb; v_purchase_id uuid;
  v_item record; v_items jsonb; v_subtotal numeric(14,2); v_discount numeric(14,2);
  v_additional numeric(14,2); v_total numeric(14,2); v_payment jsonb; v_payment_amount numeric(14,2); v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'complete_purchase', p_payload);
  if v_replay is not null then return v_replay; end if;

  v_supplier_id := nullif(p_payload ->> 'supplier_id', '')::uuid;
  if v_supplier_id is null then
    v_supplier := coalesce(p_payload -> 'supplier', '{}'::jsonb);
    if length(trim(coalesce(v_supplier ->> 'name', ''))) = 0 then raise exception 'supplier name is required'; end if;
    v_supplier := v_supplier || jsonb_build_object(
      'contact_type', 'supplier',
      'opening_balance', 0,
      'opening_balance_date', current_date
    );
    v_supplier_id := (public.create_contact(p_idempotency_key || ':supplier', v_supplier) ->> 'id')::uuid;
  else
    perform app.assert_contact_role(v_supplier_id, array['supplier']);
  end if;

  v_items := coalesce(p_payload -> 'items', '[]'::jsonb);
  if jsonb_array_length(v_items) = 0 then raise exception 'purchase must have at least one item'; end if;

  v_purchase := public.create_draft_purchase(
    p_idempotency_key || ':draft',
    jsonb_build_object(
      'supplier_id', v_supplier_id,
      'supplier_invoice_number', nullif(trim(coalesce(p_payload ->> 'supplier_invoice_number', '')), ''),
      'purchase_date', coalesce(nullif(p_payload ->> 'purchase_date', ''), current_date::text),
      'discount_amount', coalesce((p_payload ->> 'discount_amount')::numeric, 0),
      'additional_cost', coalesce((p_payload ->> 'additional_cost')::numeric, 0),
      'notes', nullif(trim(coalesce(p_payload ->> 'notes', '')), '')
    )
  );
  v_purchase_id := (v_purchase ->> 'id')::uuid;

  for v_item in select value, ordinality from jsonb_array_elements(v_items) with ordinality loop
    perform public.add_purchase_item(
      p_idempotency_key || ':item:' || v_item.ordinality::text,
      v_purchase_id,
      (v_item.value ->> 'product_id')::uuid,
      coalesce(v_item.value ->> 'entry_mode', 'loose'),
      (v_item.value ->> 'quantity')::integer,
      case when nullif(v_item.value ->> 'cost_per_entry', '') is null then null else (v_item.value ->> 'cost_per_entry')::numeric end
    );
  end loop;

  select coalesce(sum(line_total), 0)::numeric(14,2) into v_subtotal from public.purchase_items where purchase_id = v_purchase_id;
  v_discount := coalesce((p_payload ->> 'discount_amount')::numeric, 0);
  v_additional := coalesce((p_payload ->> 'additional_cost')::numeric, 0);
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'invalid discount'; end if;
  if v_additional < 0 then raise exception 'additional cost cannot be negative'; end if;
  v_total := v_subtotal - v_discount + v_additional;
  v_payment := p_payload -> 'initial_payment';
  v_payment_amount := coalesce((v_payment ->> 'amount')::numeric, 0);
  if v_payment_amount < 0 then raise exception 'payment amount cannot be negative'; end if;
  if v_payment_amount > v_total then raise exception 'payment cannot exceed purchase total'; end if;

  v_result := public.finalize_purchase(
    p_idempotency_key || ':finalize',
    v_purchase_id,
    v_discount,
    v_additional,
    case when v_payment_amount > 0 then v_payment else null end,
    coalesce((p_payload ->> 'update_product_cost')::boolean, true)
  );

  return app.idempotency_finish(p_idempotency_key, v_purchase_id, v_result);
end;
$$;

grant execute on function public.complete_sale(text, jsonb) to authenticated;
grant execute on function public.complete_purchase(text, jsonb) to authenticated;
