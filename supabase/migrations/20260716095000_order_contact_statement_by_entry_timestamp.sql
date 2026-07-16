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
