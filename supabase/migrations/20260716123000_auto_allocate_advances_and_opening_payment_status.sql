drop view if exists public.payment_allocation_status;

create view public.payment_allocation_status
with (security_invoker = true) as
with document_allocations as (
  select
    payment_id,
    coalesce(sum(allocated_amount), 0)::numeric(14,2) as document_allocated_amount
  from public.payment_allocations
  group by payment_id
),
base as (
  select
    p.id as payment_id,
    p.contact_id,
    p.direction,
    p.amount::numeric(14,2) as amount,
    p.status,
    p.reversed_payment_id,
    p.created_at,
    c.contact_type,
    greatest(coalesce(c.opening_balance, 0), 0)::numeric(14,2) as opening_due,
    coalesce(da.document_allocated_amount, 0)::numeric(14,2) as document_allocated_amount,
    case
      when p.status = 'completed' and p.reversed_payment_id is null
        then greatest(p.amount - coalesce(da.document_allocated_amount, 0), 0)::numeric(14,2)
      else 0::numeric(14,2)
    end as raw_remaining_amount
  from public.payments p
  join public.contacts c on c.id = p.contact_id
  left join document_allocations da on da.payment_id = p.id
),
calculated as (
  select
    base.*,
    coalesce(
      sum(raw_remaining_amount) over (
        partition by contact_id, direction
        order by created_at, payment_id
        rows between unbounded preceding and 1 preceding
      ),
      0
    )::numeric(14,2) as prior_raw_remaining_amount
  from base
),
finalized as (
  select
    *,
    case
      when direction = 'in' and contact_type in ('customer', 'both', 'walk_in')
        then least(raw_remaining_amount, greatest(opening_due - prior_raw_remaining_amount, 0))
      when direction = 'out' and contact_type in ('supplier', 'both')
        then least(raw_remaining_amount, greatest(opening_due - prior_raw_remaining_amount, 0))
      else 0::numeric(14,2)
    end::numeric(14,2) as opening_applied_amount
  from calculated
)
select
  payment_id,
  contact_id,
  direction,
  amount,
  status,
  reversed_payment_id,
  created_at,
  document_allocated_amount,
  opening_applied_amount,
  (document_allocated_amount + opening_applied_amount)::numeric(14,2) as effective_allocated_amount,
  greatest(amount - document_allocated_amount - opening_applied_amount, 0)::numeric(14,2) as effective_remaining_amount
from finalized;

grant select on public.payment_allocation_status to authenticated;
grant select on public.payment_allocation_status to anon;

create or replace function app.auto_allocate_contact_payments(p_contact_id uuid, p_direction text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_doc record;
  v_remaining numeric(14,2);
  v_alloc numeric(14,2);
begin
  if p_direction = 'in' then
    for v_payment in
      select payment_id, effective_remaining_amount
      from public.payment_allocation_status
      where contact_id = p_contact_id
        and direction = 'in'
        and status = 'completed'
        and reversed_payment_id is null
        and effective_remaining_amount > 0
      order by created_at, payment_id
    loop
      v_remaining := v_payment.effective_remaining_amount;

      for v_doc in
        select s.id, sb.due_amount
        from public.sales s
        join public.sale_balances sb on sb.sale_id = s.id
        where s.customer_id = p_contact_id
          and s.status = 'finalized'
          and sb.due_amount > 0
        order by s.sale_date, s.created_at, s.sale_number
      loop
        exit when v_remaining <= 0;
        v_alloc := least(v_remaining, v_doc.due_amount);
        perform public.allocate_payment(
          'auto-alloc:' || v_payment.payment_id::text || ':sale:' || v_doc.id::text,
          v_payment.payment_id,
          v_doc.id,
          null,
          v_alloc
        );
        v_remaining := v_remaining - v_alloc;
      end loop;
    end loop;
  elsif p_direction = 'out' then
    for v_payment in
      select payment_id, effective_remaining_amount
      from public.payment_allocation_status
      where contact_id = p_contact_id
        and direction = 'out'
        and status = 'completed'
        and reversed_payment_id is null
        and effective_remaining_amount > 0
      order by created_at, payment_id
    loop
      v_remaining := v_payment.effective_remaining_amount;

      for v_doc in
        select pu.id, pb.due_amount
        from public.purchases pu
        join public.purchase_balances pb on pb.purchase_id = pu.id
        where pu.supplier_id = p_contact_id
          and pu.status = 'finalized'
          and pb.due_amount > 0
        order by pu.purchase_date, pu.created_at, pu.purchase_number
      loop
        exit when v_remaining <= 0;
        v_alloc := least(v_remaining, v_doc.due_amount);
        perform public.allocate_payment(
          'auto-alloc:' || v_payment.payment_id::text || ':purchase:' || v_doc.id::text,
          v_payment.payment_id,
          null,
          v_doc.id,
          v_alloc
        );
        v_remaining := v_remaining - v_alloc;
      end loop;
    end loop;
  else
    raise exception 'invalid payment direction';
  end if;
end;
$$;

create or replace function public.record_payment(p_idempotency_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_contact_id uuid;
  v_direction text;
  v_amount numeric(14,2);
  v_id uuid;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'record_payment', p_payload);
  if v_replay is not null then return v_replay; end if;

  v_contact_id := (p_payload ->> 'contact_id')::uuid;
  v_direction := p_payload ->> 'direction';
  v_amount := (p_payload ->> 'amount')::numeric;
  if v_amount <= 0 then raise exception 'payment amount must be positive'; end if;
  if v_direction = 'in' then
    perform app.assert_contact_role(v_contact_id, array['customer', 'walk_in']);
  elsif v_direction = 'out' then
    perform app.assert_contact_role(v_contact_id, array['supplier']);
  else
    raise exception 'invalid payment direction';
  end if;

  insert into public.payments (payment_number, contact_id, direction, amount, payment_method, reference_number, notes)
  values (
    'PAY-' || lpad(nextval('public.payment_number_seq')::text, 6, '0'),
    v_contact_id,
    v_direction,
    v_amount,
    coalesce(p_payload ->> 'payment_method', 'cash'),
    p_payload ->> 'reference_number',
    p_payload ->> 'notes'
  ) returning id into v_id;

  if coalesce((p_payload ->> 'auto_allocate')::boolean, true) then
    perform app.auto_allocate_contact_payments(v_contact_id, v_direction);
  end if;

  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

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
        'notes', p_initial_payment ->> 'notes',
        'auto_allocate', false
      )
    );
    perform public.allocate_payment(p_idempotency_key || ':initial-allocation', (v_payment ->> 'id')::uuid, p_sale_id, null, v_payment_amount);
  end if;

  perform app.auto_allocate_contact_payments(v_sale.customer_id, 'in');

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
        'notes', p_initial_payment ->> 'notes',
        'auto_allocate', false
      )
    );
    perform public.allocate_payment(p_idempotency_key || ':initial-allocation', (v_payment ->> 'id')::uuid, null, p_purchase_id, v_payment_amount);
  end if;

  perform app.auto_allocate_contact_payments(v_purchase.supplier_id, 'out');

  v_result := jsonb_build_object('id', p_purchase_id, 'total_amount', v_total);
  return app.idempotency_finish(p_idempotency_key, p_purchase_id, v_result);
end;
$$;

grant execute on function app.auto_allocate_contact_payments(uuid, text) to authenticated;
grant execute on function public.record_payment(text, jsonb) to authenticated;
grant execute on function public.finalize_sale(text, uuid, numeric, jsonb) to authenticated;
grant execute on function public.finalize_purchase(text, uuid, numeric, numeric, jsonb, boolean) to authenticated;
