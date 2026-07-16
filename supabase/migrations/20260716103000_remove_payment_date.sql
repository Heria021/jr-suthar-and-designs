drop index if exists public.payments_contact_date_idx;
drop index if exists public.payments_method_date_idx;

drop view if exists public.daily_payment_totals;

create view public.daily_payment_totals
with (security_invoker = true) as
select
  created_at::date as payment_date,
  payment_method,
  sum(case when direction = 'in' then amount else 0 end)::numeric(14,2) as received_amount,
  sum(case when direction = 'out' then amount else 0 end)::numeric(14,2) as paid_amount,
  sum(case when direction = 'in' then amount else -amount end)::numeric(14,2) as net_amount
from public.payments
where status = 'completed'
group by created_at::date, payment_method;

create or replace function public.contact_statement(p_contact_id uuid)
returns table(entry_date date, entry_type text, reference_id uuid, description text, debit numeric, credit numeric, running_balance numeric)
language sql
stable
security definer
set search_path = public
as $$
  with target_contact as (
    select c.*
    from public.contacts c
    where app.owner_guard_passes()
      and c.id = p_contact_id
  ),
  entries as (
    select c.opening_balance_date as entry_date, 'opening' as entry_type, c.id as reference_id, 'Opening balance' as description,
      case
        when c.contact_type = 'supplier' then greatest(-c.opening_balance, 0)::numeric
        else greatest(c.opening_balance, 0)::numeric
      end as debit,
      case
        when c.contact_type = 'supplier' then greatest(c.opening_balance, 0)::numeric
        else greatest(-c.opening_balance, 0)::numeric
      end as credit,
      case
        when c.contact_type = 'supplier' then -c.opening_balance::numeric
        else c.opening_balance::numeric
      end as delta,
      coalesce(c.opening_balance_date::timestamp + c.created_at::time, c.created_at::timestamp) as entry_at
    from target_contact c
    union all
    select s.sale_date, 'sale', s.id, s.sale_number, s.total_amount, 0::numeric, s.total_amount,
      s.sale_date::timestamp + s.created_at::time
    from public.sales s where s.customer_id = p_contact_id and s.status = 'finalized'
    union all
    select pu.purchase_date, 'purchase', pu.id, pu.purchase_number, 0::numeric, pu.total_amount, -pu.total_amount,
      pu.purchase_date::timestamp + pu.created_at::time
    from public.purchases pu where pu.supplier_id = p_contact_id and pu.status = 'finalized'
    union all
    select p.created_at::date, 'payment', p.id, p.payment_number,
      case when p.direction = 'out' then p.amount else 0 end,
      case when p.direction = 'in' then p.amount else 0 end,
      case when p.direction = 'out' then p.amount else -p.amount end,
      p.created_at::timestamp
    from public.payments p where p.contact_id = p_contact_id
  )
  select entry_date, entry_type, reference_id, description, debit, credit,
    sum(delta) over (order by entry_at nulls first)::numeric(14,2) as running_balance
  from entries
  order by entry_at nulls first;
$$;

create or replace function public.record_payment(p_idempotency_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_contact_id uuid; v_direction text; v_amount numeric(14,2); v_id uuid; v_remaining numeric(14,2); v_doc record; v_alloc numeric(14,2); v_result jsonb;
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

  if coalesce((p_payload ->> 'auto_allocate')::boolean, false) then
    v_remaining := v_amount;
    if v_direction = 'in' then
      for v_doc in select s.id, sb.due_amount from public.sales s join public.sale_balances sb on sb.sale_id = s.id
                   where s.customer_id = v_contact_id and s.status = 'finalized' and sb.due_amount > 0
                   order by s.sale_date, s.created_at, s.sale_number loop
        exit when v_remaining <= 0;
        v_alloc := least(v_remaining, v_doc.due_amount);
        perform public.allocate_payment(p_idempotency_key || ':alloc-sale:' || v_doc.id::text, v_id, v_doc.id, null, v_alloc);
        v_remaining := v_remaining - v_alloc;
      end loop;
    else
      for v_doc in select pu.id, pb.due_amount from public.purchases pu join public.purchase_balances pb on pb.purchase_id = pu.id
                   where pu.supplier_id = v_contact_id and pu.status = 'finalized' and pb.due_amount > 0
                   order by pu.purchase_date, pu.created_at, pu.purchase_number loop
        exit when v_remaining <= 0;
        v_alloc := least(v_remaining, v_doc.due_amount);
        perform public.allocate_payment(p_idempotency_key || ':alloc-purchase:' || v_doc.id::text, v_id, null, v_doc.id, v_alloc);
        v_remaining := v_remaining - v_alloc;
      end loop;
    end if;
  end if;

  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

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
  v_allocation := public.allocate_payment(p_idempotency_key || ':allocation', v_payment_id, p_sale_id, null, v_amount);

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
  v_allocation := public.allocate_payment(p_idempotency_key || ':allocation', v_payment_id, null, p_purchase_id, v_amount);

  v_result := jsonb_build_object('id', v_payment_id, 'allocation_id', (v_allocation ->> 'id')::uuid);
  return app.idempotency_finish(p_idempotency_key, v_payment_id, v_result);
end;
$$;

create or replace function public.reverse_payment(p_idempotency_key text, p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_payment public.payments%rowtype; v_reverse_id uuid; v_alloc record; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'reverse_payment', jsonb_build_object('payment_id', p_payment_id, 'reason', p_reason));
  if v_replay is not null then return v_replay; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reversal reason is required'; end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if v_payment.reversed_payment_id is not null then raise exception 'cannot reverse a reversal payment'; end if;
  if v_payment.status = 'reversed' then raise exception 'payment already reversed'; end if;
  if exists(select 1 from public.payments where reversed_payment_id = p_payment_id) then raise exception 'payment already reversed'; end if;

  insert into public.payments (
    payment_number, contact_id, direction, amount, payment_method,
    reference_number, notes, status, reversed_payment_id, reversal_reason
  ) values (
    'PAY-' || lpad(nextval('public.payment_number_seq')::text, 6, '0'),
    v_payment.contact_id,
    case when v_payment.direction = 'in' then 'out' else 'in' end,
    v_payment.amount,
    v_payment.payment_method,
    v_payment.reference_number,
    'Reversal of ' || v_payment.payment_number,
    'reversed',
    p_payment_id,
    p_reason
  ) returning id into v_reverse_id;

  for v_alloc in select * from public.payment_allocations where payment_id = p_payment_id loop
    if v_alloc.sale_id is not null then
      perform public.allocate_payment(p_idempotency_key || ':reverse-sale:' || v_alloc.id::text, v_reverse_id, v_alloc.sale_id, null, v_alloc.allocated_amount);
    else
      perform public.allocate_payment(p_idempotency_key || ':reverse-purchase:' || v_alloc.id::text, v_reverse_id, null, v_alloc.purchase_id, v_alloc.allocated_amount);
    end if;
  end loop;

  update public.payments
  set status = 'reversed',
      reversal_reason = p_reason
  where id = p_payment_id;

  v_result := jsonb_build_object('id', v_reverse_id, 'reversed_payment_id', p_payment_id);
  return app.idempotency_finish(p_idempotency_key, v_reverse_id, v_result);
end;
$$;

alter table public.payments drop column if exists payment_date;

create index if not exists payments_contact_created_idx on public.payments(contact_id, created_at desc);
create index if not exists payments_method_created_idx on public.payments(payment_method, created_at desc);

grant select on public.daily_payment_totals to authenticated;
grant execute on function public.contact_statement(uuid) to authenticated;
grant execute on function public.record_payment(text, jsonb) to authenticated;
grant execute on function public.record_sale_payment(text, uuid, jsonb) to authenticated;
grant execute on function public.record_purchase_payment(text, uuid, jsonb) to authenticated;
grant execute on function public.reverse_payment(text, uuid, text) to authenticated;
