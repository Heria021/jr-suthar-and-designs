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

grant select on public.daily_payment_totals to authenticated;
grant select on public.daily_payment_totals to anon;

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

update public.payments p
set status = 'reversed',
    reversal_reason = coalesce(p.reversal_reason, r.reversal_reason, 'Payment reversed')
from public.payments r
where r.reversed_payment_id = p.id
  and p.status <> 'reversed';
