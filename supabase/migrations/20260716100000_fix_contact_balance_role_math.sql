create or replace view public.contact_balances
with (security_invoker = true) as
select
  c.id as contact_id,
  c.opening_balance,
  case
    when c.contact_type in ('customer', 'walk_in', 'both') then
      (c.opening_balance
        + coalesce((select sum(total_amount) from public.sales s where s.customer_id = c.id and s.status = 'finalized'), 0)
        - coalesce((
          select sum(case when p.direction = 'in' then p.amount else -p.amount end)
          from public.payments p
          left join public.payments original on original.id = p.reversed_payment_id
          where p.contact_id = c.id
            and (p.direction = 'in' or original.direction = 'in')
        ), 0)
      )::numeric(14,2)
    else 0::numeric(14,2)
  end as customer_balance,
  case
    when c.contact_type in ('supplier', 'both') then
      (c.opening_balance
        + coalesce((select sum(total_amount) from public.purchases pu where pu.supplier_id = c.id and pu.status = 'finalized'), 0)
        - coalesce((
          select sum(case when p.direction = 'out' then p.amount else -p.amount end)
          from public.payments p
          left join public.payments original on original.id = p.reversed_payment_id
          where p.contact_id = c.id
            and (p.direction = 'out' or original.direction = 'out')
        ), 0)
      )::numeric(14,2)
    else 0::numeric(14,2)
  end as supplier_balance
from public.contacts c;
