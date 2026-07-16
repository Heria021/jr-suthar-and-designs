create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists app;

create sequence if not exists public.sale_number_seq;
create sequence if not exists public.purchase_number_seq;
create sequence if not exists public.payment_number_seq;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  contact_type text not null check (contact_type in ('customer', 'supplier', 'both', 'walk_in')),
  opening_balance numeric(14,2) not null default 0,
  opening_balance_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  sku text unique,
  unit_name text not null default 'piece' check (length(trim(unit_name)) > 0),
  loose_sale_price numeric(14,2) not null check (loose_sale_price >= 0),
  loose_cost_price numeric(14,2) not null check (loose_cost_price >= 0),
  has_box boolean not null default false,
  box_units integer,
  box_sale_price numeric(14,2),
  box_cost_price numeric(14,2),
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint products_box_config_chk check (
    (
      has_box
      and coalesce(box_units > 1, false)
      and box_sale_price is not null
      and box_sale_price >= 0
      and box_cost_price is not null
      and box_cost_price >= 0
    )
    or
    (not has_box and box_units is null and box_sale_price is null and box_cost_price is null)
  )
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  customer_id uuid not null references public.contacts(id),
  sale_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'cancelled')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  notes text,
  finalized_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint sales_cancel_reason_chk check (status <> 'cancelled' or length(trim(coalesce(cancellation_reason, ''))) > 0)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  entry_mode text not null check (entry_mode in ('loose', 'box')),
  entered_quantity integer not null check (entered_quantity > 0),
  base_units_per_entry integer not null check (base_units_per_entry > 0),
  base_quantity integer not null check (base_quantity > 0),
  price_per_entry numeric(14,2) not null check (price_per_entry >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  cost_total_snapshot numeric(14,2) not null check (cost_total_snapshot >= 0),
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique,
  supplier_id uuid not null references public.contacts(id),
  supplier_invoice_number text,
  purchase_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'cancelled')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  additional_cost numeric(14,2) not null default 0 check (additional_cost >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  notes text,
  finalized_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint purchases_cancel_reason_chk check (status <> 'cancelled' or length(trim(coalesce(cancellation_reason, ''))) > 0)
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  entry_mode text not null check (entry_mode in ('loose', 'box')),
  entered_quantity integer not null check (entered_quantity > 0),
  base_units_per_entry integer not null check (base_units_per_entry > 0),
  base_quantity integer not null check (base_quantity > 0),
  cost_per_entry numeric(14,2) not null check (cost_per_entry >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  contact_id uuid not null references public.contacts(id),
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'upi', 'bank', 'card', 'other')),
  reference_number text,
  notes text,
  status text not null default 'completed' check (status in ('completed', 'reversed')),
  reversed_payment_id uuid references public.payments(id),
  reversal_reason text,
  created_at timestamptz not null default now(),
  constraint payments_reversal_reason_chk check (reversed_payment_id is null or length(trim(coalesce(reversal_reason, ''))) > 0)
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete restrict,
  allocated_amount numeric(14,2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now(),
  constraint payment_allocations_one_target_chk check ((sale_id is not null)::integer + (purchase_id is not null)::integer = 1)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  movement_type text not null check (movement_type in ('opening', 'sale', 'purchase', 'adjustment', 'sale_cancellation', 'purchase_cancellation')),
  quantity_delta integer not null check (quantity_delta <> 0),
  sale_item_id uuid references public.sale_items(id),
  purchase_item_id uuid references public.purchase_items(id),
  reason text,
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0),
  occurred_at timestamptz not null default now()
);

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  operation_type text not null,
  request_hash text not null,
  result jsonb,
  result_entity_id uuid,
  status text not null check (status in ('processing', 'completed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days'
);

create table public.shop_settings (
  id boolean primary key default true check (id),
  owner_user_id uuid,
  owner_email text default 'owner@example.com',
  shop_name text not null default 'JR Suthar And Designs',
  owner_name text,
  phone text,
  address text,
  invoice_prefix text not null default 'INV',
  purchase_prefix text not null default 'PUR',
  currency text not null default 'INR',
  receipt_footer text,
  prices_include_tax boolean not null default false,
  default_payment_method text not null default 'cash' check (default_payment_method in ('cash', 'upi', 'bank', 'card', 'other')),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

insert into public.contacts (id, name, contact_type, opening_balance, opening_balance_date)
values ('00000000-0000-0000-0000-000000000001', 'Walk-in Customer', 'walk_in', 0, current_date)
on conflict (id) do nothing;

insert into public.shop_settings (id, owner_email) values (true, 'owner@example.com') on conflict (id) do nothing;

create index contacts_search_idx on public.contacts using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(phone, '')));
create index contacts_type_active_idx on public.contacts(contact_type, is_active);
create index contacts_opening_balance_idx on public.contacts(opening_balance);
create index products_search_idx on public.products using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(sku, '')));
create index products_stock_idx on public.products(stock_on_hand, reorder_level, is_active);
create index sales_customer_date_idx on public.sales(customer_id, sale_date desc);
create index sales_status_date_idx on public.sales(status, sale_date desc);
create index sale_items_sale_idx on public.sale_items(sale_id);
create index purchases_supplier_date_idx on public.purchases(supplier_id, purchase_date desc);
create index purchases_status_date_idx on public.purchases(status, purchase_date desc);
create index purchase_items_purchase_idx on public.purchase_items(purchase_id);
create index payments_contact_created_idx on public.payments(contact_id, created_at desc);
create index payments_method_created_idx on public.payments(payment_method, created_at desc);
create index payment_allocations_sale_idx on public.payment_allocations(sale_id);
create index payment_allocations_purchase_idx on public.payment_allocations(purchase_id);
create index stock_movements_product_idx on public.stock_movements(product_id, occurred_at desc);

create or replace function app.touch_version()
returns trigger
language plpgsql
as $$
begin
  if new.version is distinct from old.version then
    raise exception 'optimistic lock conflict on %. expected %, got %', tg_table_name, old.version, new.version
      using errcode = '40001';
  end if;
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger contacts_touch_version before update on public.contacts for each row execute function app.touch_version();
create trigger products_touch_version before update on public.products for each row execute function app.touch_version();
create trigger sales_touch_version before update on public.sales for each row execute function app.touch_version();
create trigger purchases_touch_version before update on public.purchases for each row execute function app.touch_version();

create or replace function app.touch_shop_settings()
returns trigger
language plpgsql
as $$
begin
  if new.version is distinct from old.version then
    raise exception 'optimistic lock conflict on shop_settings. expected %, got %', old.version, new.version
      using errcode = '40001';
  end if;
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger shop_settings_touch_version before update on public.shop_settings for each row execute function app.touch_shop_settings();

create or replace function app.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    exists (
      select 1 from public.shop_settings
      where id and (
        owner_user_id = auth.uid()
        or (owner_user_id is null and owner_email is not null and owner_email = auth.jwt() ->> 'email')
      )
    ),
    false
  );
$$;

create or replace function app.owner_guard_passes()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select auth.uid() is null or app.is_owner();
$$;

create or replace function app.assert_owner()
returns void
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not app.owner_guard_passes() then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;
end;
$$;

create or replace function app.request_hash(p_payload jsonb)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex');
$$;

create or replace function app.idempotency_get_result(p_key text, p_operation text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text := app.request_hash(p_payload);
  v_existing public.idempotency_keys%rowtype;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'idempotency key is required';
  end if;

  select * into v_existing
  from public.idempotency_keys
  where idempotency_key = p_key
  for update;

  if found then
    if v_existing.operation_type <> p_operation or v_existing.request_hash <> v_hash then
      raise exception 'idempotency key reused with different operation or payload';
    end if;
    if v_existing.status = 'completed' then
      return v_existing.result || jsonb_build_object('idempotent_replay', true);
    end if;
    raise exception 'idempotency key is already processing';
  end if;

  insert into public.idempotency_keys (idempotency_key, operation_type, request_hash, status)
  values (p_key, p_operation, v_hash, 'processing');

  return null;
end;
$$;

create or replace function app.idempotency_finish(p_key text, p_entity_id uuid, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.idempotency_keys
  set status = 'completed',
      result_entity_id = p_entity_id,
      result = p_result || jsonb_build_object('idempotent_replay', false)
  where idempotency_key = p_key;
  return p_result || jsonb_build_object('idempotent_replay', false);
end;
$$;

create or replace function app.assert_contact_role(p_contact_id uuid, p_allowed text[])
returns void
language plpgsql
as $$
declare
  v_type text;
  v_active boolean;
begin
  select contact_type, is_active into v_type, v_active from public.contacts where id = p_contact_id;
  if not found then
    raise exception 'contact not found';
  end if;
  if not v_active then
    raise exception 'contact is inactive';
  end if;
  if not (v_type = any(p_allowed) or v_type = 'both') then
    raise exception 'contact type % is not allowed here', v_type;
  end if;
end;
$$;

create or replace function app.payment_signed_for_sale(p_direction text, p_amount numeric)
returns numeric language sql immutable as $$
  select case when p_direction = 'in' then p_amount else -p_amount end;
$$;

create or replace function app.payment_signed_for_purchase(p_direction text, p_amount numeric)
returns numeric language sql immutable as $$
  select case when p_direction = 'out' then p_amount else -p_amount end;
$$;

create view public.sale_balances
with (security_invoker = true) as
select
  s.id as sale_id,
  s.total_amount,
  coalesce(sum(app.payment_signed_for_sale(p.direction, pa.allocated_amount)), 0)::numeric(14,2) as paid_amount,
  (s.total_amount - coalesce(sum(app.payment_signed_for_sale(p.direction, pa.allocated_amount)), 0))::numeric(14,2) as due_amount,
  case
    when s.status = 'cancelled' then 'Cancelled'
    when coalesce(sum(app.payment_signed_for_sale(p.direction, pa.allocated_amount)), 0) <= 0 then 'Pending'
    when coalesce(sum(app.payment_signed_for_sale(p.direction, pa.allocated_amount)), 0) >= s.total_amount then 'Paid'
    else 'Partially paid'
  end as payment_status
from public.sales s
left join public.payment_allocations pa on pa.sale_id = s.id
left join public.payments p on p.id = pa.payment_id
group by s.id;

create view public.purchase_balances
with (security_invoker = true) as
select
  pu.id as purchase_id,
  pu.total_amount,
  coalesce(sum(app.payment_signed_for_purchase(p.direction, pa.allocated_amount)), 0)::numeric(14,2) as paid_amount,
  (pu.total_amount - coalesce(sum(app.payment_signed_for_purchase(p.direction, pa.allocated_amount)), 0))::numeric(14,2) as due_amount,
  case
    when pu.status = 'cancelled' then 'Cancelled'
    when coalesce(sum(app.payment_signed_for_purchase(p.direction, pa.allocated_amount)), 0) <= 0 then 'Pending'
    when coalesce(sum(app.payment_signed_for_purchase(p.direction, pa.allocated_amount)), 0) >= pu.total_amount then 'Paid'
    else 'Partially paid'
  end as payment_status
from public.purchases pu
left join public.payment_allocations pa on pa.purchase_id = pu.id
left join public.payments p on p.id = pa.payment_id
group by pu.id;

create view public.contact_balances
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

create view public.stock_reconciliation
with (security_invoker = true) as
select
  p.id as product_id,
  p.name,
  p.stock_on_hand,
  coalesce(sum(sm.quantity_delta), 0)::integer as movement_stock,
  p.stock_on_hand <> coalesce(sum(sm.quantity_delta), 0)::integer as is_mismatch
from public.products p
left join public.stock_movements sm on sm.product_id = p.id
group by p.id;

create or replace function public.reconcile_stock()
returns table(product_id uuid, name text, stock_on_hand integer, movement_stock integer, is_mismatch boolean)
language sql
stable
security definer
set search_path = public
as $$
  select sr.product_id, sr.name, sr.stock_on_hand, sr.movement_stock, sr.is_mismatch
  from public.stock_reconciliation sr
  where app.owner_guard_passes() and sr.is_mismatch;
$$;

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

create or replace function public.create_contact(p_idempotency_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_replay jsonb;
  v_id uuid;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'create_contact', p_payload);
  if v_replay is not null then return v_replay; end if;

  insert into public.contacts (name, phone, contact_type, opening_balance, opening_balance_date, notes)
  values (
    p_payload ->> 'name',
    p_payload ->> 'phone',
    coalesce(p_payload ->> 'contact_type', 'customer'),
    coalesce((p_payload ->> 'opening_balance')::numeric, 0),
    coalesce((p_payload ->> 'opening_balance_date')::date, current_date),
    p_payload ->> 'notes'
  )
  returning id into v_id;

  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.update_contact(p_idempotency_key text, p_contact_id uuid, p_expected_version integer, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_has_transactions boolean;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'update_contact', jsonb_build_object('id', p_contact_id, 'version', p_expected_version, 'payload', p_payload));
  if v_replay is not null then return v_replay; end if;

  select exists(select 1 from public.sales where customer_id = p_contact_id)
      or exists(select 1 from public.purchases where supplier_id = p_contact_id)
      or exists(select 1 from public.payments where contact_id = p_contact_id)
  into v_has_transactions;

  if v_has_transactions and p_payload ? 'opening_balance' then
    raise exception 'opening balance cannot be edited after transactions exist';
  end if;

  update public.contacts
  set name = coalesce(p_payload ->> 'name', name),
      phone = case when p_payload ? 'phone' then p_payload ->> 'phone' else phone end,
      contact_type = coalesce(p_payload ->> 'contact_type', contact_type),
      opening_balance = case when p_payload ? 'opening_balance' then (p_payload ->> 'opening_balance')::numeric else opening_balance end,
      opening_balance_date = case when p_payload ? 'opening_balance_date' then (p_payload ->> 'opening_balance_date')::date else opening_balance_date end,
      notes = case when p_payload ? 'notes' then p_payload ->> 'notes' else notes end,
      version = p_expected_version
  where id = p_contact_id;

  if not found then raise exception 'contact not found'; end if;
  v_result := jsonb_build_object('id', p_contact_id);
  return app.idempotency_finish(p_idempotency_key, p_contact_id, v_result);
end;
$$;

create or replace function public.deactivate_contact(p_idempotency_key text, p_contact_id uuid, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_replay jsonb; v_result jsonb;
begin
  perform app.assert_owner();
  if p_contact_id = '00000000-0000-0000-0000-000000000001' then
    raise exception 'walk-in customer cannot be deactivated';
  end if;
  v_replay := app.idempotency_get_result(p_idempotency_key, 'deactivate_contact', jsonb_build_object('id', p_contact_id, 'version', p_expected_version));
  if v_replay is not null then return v_replay; end if;
  update public.contacts set is_active = false, version = p_expected_version where id = p_contact_id;
  if not found then raise exception 'contact not found'; end if;
  v_result := jsonb_build_object('id', p_contact_id);
  return app.idempotency_finish(p_idempotency_key, p_contact_id, v_result);
end;
$$;

create or replace function public.create_product(p_idempotency_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_replay jsonb;
  v_id uuid;
  v_opening integer := coalesce((p_payload ->> 'opening_stock')::integer, 0);
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'create_product', p_payload);
  if v_replay is not null then return v_replay; end if;

  if v_opening < 0 then raise exception 'opening stock cannot be negative'; end if;

  insert into public.products (
    name, sku, unit_name, loose_sale_price, loose_cost_price, has_box, box_units,
    box_sale_price, box_cost_price, stock_on_hand, reorder_level
  )
  values (
    p_payload ->> 'name',
    p_payload ->> 'sku',
    coalesce(p_payload ->> 'unit_name', 'piece'),
    (p_payload ->> 'loose_sale_price')::numeric,
    (p_payload ->> 'loose_cost_price')::numeric,
    coalesce((p_payload ->> 'has_box')::boolean, false),
    (p_payload ->> 'box_units')::integer,
    (p_payload ->> 'box_sale_price')::numeric,
    (p_payload ->> 'box_cost_price')::numeric,
    v_opening,
    coalesce((p_payload ->> 'reorder_level')::integer, 0)
  )
  returning id into v_id;

  if v_opening > 0 then
    insert into public.stock_movements (product_id, movement_type, quantity_delta, reason, stock_before, stock_after)
    values (v_id, 'opening', v_opening, 'opening stock', 0, v_opening);
  end if;

  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.update_product(p_idempotency_key text, p_product_id uuid, p_expected_version integer, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_replay jsonb; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'update_product', jsonb_build_object('id', p_product_id, 'version', p_expected_version, 'payload', p_payload));
  if v_replay is not null then return v_replay; end if;
  if p_payload ? 'stock_on_hand' then raise exception 'stock must be changed through correct_stock'; end if;

  update public.products
  set name = coalesce(p_payload ->> 'name', name),
      sku = case when p_payload ? 'sku' then p_payload ->> 'sku' else sku end,
      unit_name = coalesce(p_payload ->> 'unit_name', unit_name),
      loose_sale_price = coalesce((p_payload ->> 'loose_sale_price')::numeric, loose_sale_price),
      loose_cost_price = coalesce((p_payload ->> 'loose_cost_price')::numeric, loose_cost_price),
      has_box = coalesce((p_payload ->> 'has_box')::boolean, has_box),
      box_units = case when p_payload ? 'box_units' then (p_payload ->> 'box_units')::integer else box_units end,
      box_sale_price = case when p_payload ? 'box_sale_price' then (p_payload ->> 'box_sale_price')::numeric else box_sale_price end,
      box_cost_price = case when p_payload ? 'box_cost_price' then (p_payload ->> 'box_cost_price')::numeric else box_cost_price end,
      reorder_level = coalesce((p_payload ->> 'reorder_level')::integer, reorder_level),
      version = p_expected_version
  where id = p_product_id;
  if not found then raise exception 'product not found'; end if;
  v_result := jsonb_build_object('id', p_product_id);
  return app.idempotency_finish(p_idempotency_key, p_product_id, v_result);
end;
$$;

create or replace function public.deactivate_product(p_idempotency_key text, p_product_id uuid, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_replay jsonb; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'deactivate_product', jsonb_build_object('id', p_product_id, 'version', p_expected_version));
  if v_replay is not null then return v_replay; end if;
  update public.products set is_active = false, version = p_expected_version where id = p_product_id;
  if not found then raise exception 'product not found'; end if;
  v_result := jsonb_build_object('id', p_product_id);
  return app.idempotency_finish(p_idempotency_key, p_product_id, v_result);
end;
$$;

create or replace function public.correct_stock(p_idempotency_key text, p_product_id uuid, p_actual_stock integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_product public.products%rowtype;
  v_delta integer;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'correct_stock', jsonb_build_object('product_id', p_product_id, 'actual_stock', p_actual_stock, 'reason', p_reason));
  if v_replay is not null then return v_replay; end if;
  if p_actual_stock < 0 then raise exception 'actual stock cannot be negative'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'stock correction reason is required'; end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'product not found'; end if;
  v_delta := p_actual_stock - v_product.stock_on_hand;
  if v_delta <> 0 then
    update public.products set stock_on_hand = p_actual_stock, version = v_product.version where id = p_product_id;
    insert into public.stock_movements (product_id, movement_type, quantity_delta, reason, stock_before, stock_after)
    values (p_product_id, 'adjustment', v_delta, p_reason, v_product.stock_on_hand, p_actual_stock);
  end if;
  v_result := jsonb_build_object('id', p_product_id, 'quantity_delta', v_delta);
  return app.idempotency_finish(p_idempotency_key, p_product_id, v_result);
end;
$$;

create or replace function app.sale_item_values(p_product public.products, p_entry_mode text, p_quantity integer, p_price numeric default null)
returns table(base_units_per_entry integer, base_quantity integer, price_per_entry numeric, line_total numeric, cost_total_snapshot numeric)
language plpgsql
as $$
begin
  if p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  if p_entry_mode = 'box' then
    if not p_product.has_box then raise exception 'product does not support box mode'; end if;
    base_units_per_entry := p_product.box_units;
    price_per_entry := coalesce(p_price, p_product.box_sale_price);
    cost_total_snapshot := p_quantity * p_product.box_cost_price;
  elsif p_entry_mode = 'loose' then
    base_units_per_entry := 1;
    price_per_entry := coalesce(p_price, p_product.loose_sale_price);
    cost_total_snapshot := p_quantity * p_product.loose_cost_price;
  else
    raise exception 'invalid entry mode';
  end if;
  if price_per_entry < 0 then raise exception 'price cannot be negative'; end if;
  base_quantity := p_quantity * base_units_per_entry;
  line_total := p_quantity * price_per_entry;
  return next;
end;
$$;

create or replace function app.purchase_item_values(p_product public.products, p_entry_mode text, p_quantity integer, p_cost numeric default null)
returns table(base_units_per_entry integer, base_quantity integer, cost_per_entry numeric, line_total numeric)
language plpgsql
as $$
begin
  if p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  if p_entry_mode = 'box' then
    if not p_product.has_box then raise exception 'product does not support box mode'; end if;
    base_units_per_entry := p_product.box_units;
    cost_per_entry := coalesce(p_cost, p_product.box_cost_price);
  elsif p_entry_mode = 'loose' then
    base_units_per_entry := 1;
    cost_per_entry := coalesce(p_cost, p_product.loose_cost_price);
  else
    raise exception 'invalid entry mode';
  end if;
  if cost_per_entry < 0 then raise exception 'cost cannot be negative'; end if;
  base_quantity := p_quantity * base_units_per_entry;
  line_total := p_quantity * cost_per_entry;
  return next;
end;
$$;

create or replace function public.create_draft_sale(p_idempotency_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_replay jsonb; v_id uuid; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'create_draft_sale', p_payload);
  if v_replay is not null then return v_replay; end if;
  perform app.assert_contact_role(coalesce((p_payload ->> 'customer_id')::uuid, '00000000-0000-0000-0000-000000000001'), array['customer', 'walk_in']);
  insert into public.sales (sale_number, customer_id, sale_date, discount_amount, notes)
  values (
    'INV-' || lpad(nextval('public.sale_number_seq')::text, 6, '0'),
    coalesce((p_payload ->> 'customer_id')::uuid, '00000000-0000-0000-0000-000000000001'),
    coalesce((p_payload ->> 'sale_date')::date, current_date),
    coalesce((p_payload ->> 'discount_amount')::numeric, 0),
    p_payload ->> 'notes'
  ) returning id into v_id;
  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.add_sale_item(p_idempotency_key text, p_sale_id uuid, p_product_id uuid, p_entry_mode text, p_quantity integer, p_price_per_entry numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_sale public.sales%rowtype;
  v_product public.products%rowtype;
  v_values record;
  v_id uuid;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'add_sale_item', jsonb_build_object('sale_id', p_sale_id, 'product_id', p_product_id, 'entry_mode', p_entry_mode, 'quantity', p_quantity, 'price', p_price_per_entry));
  if v_replay is not null then return v_replay; end if;
  select * into v_sale from public.sales where id = p_sale_id;
  if not found or v_sale.status <> 'draft' then raise exception 'sale must be draft'; end if;
  select * into v_product from public.products where id = p_product_id and is_active;
  if not found then raise exception 'active product not found'; end if;
  select * into v_values from app.sale_item_values(v_product, p_entry_mode, p_quantity, p_price_per_entry);
  insert into public.sale_items (
    sale_id, product_id, product_name_snapshot, entry_mode, entered_quantity,
    base_units_per_entry, base_quantity, price_per_entry, line_total, cost_total_snapshot
  ) values (
    p_sale_id, p_product_id, v_product.name, p_entry_mode, p_quantity,
    v_values.base_units_per_entry, v_values.base_quantity, v_values.price_per_entry,
    v_values.line_total, v_values.cost_total_snapshot
  ) returning id into v_id;
  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.update_sale_item(p_idempotency_key text, p_sale_item_id uuid, p_entry_mode text, p_quantity integer, p_price_per_entry numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_item public.sale_items%rowtype; v_sale public.sales%rowtype;
  v_product public.products%rowtype; v_values record; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'update_sale_item', jsonb_build_object('item_id', p_sale_item_id, 'entry_mode', p_entry_mode, 'quantity', p_quantity, 'price', p_price_per_entry));
  if v_replay is not null then return v_replay; end if;
  select * into v_item from public.sale_items where id = p_sale_item_id;
  if not found then raise exception 'sale item not found'; end if;
  select * into v_sale from public.sales where id = v_item.sale_id;
  if v_sale.status <> 'draft' then raise exception 'sale item can be changed only in draft sales'; end if;
  select * into v_product from public.products where id = v_item.product_id;
  select * into v_values from app.sale_item_values(v_product, p_entry_mode, p_quantity, p_price_per_entry);
  update public.sale_items
  set entry_mode = p_entry_mode,
      entered_quantity = p_quantity,
      base_units_per_entry = v_values.base_units_per_entry,
      base_quantity = v_values.base_quantity,
      price_per_entry = v_values.price_per_entry,
      line_total = v_values.line_total,
      cost_total_snapshot = v_values.cost_total_snapshot
  where id = p_sale_item_id;
  v_result := jsonb_build_object('id', p_sale_item_id);
  return app.idempotency_finish(p_idempotency_key, p_sale_item_id, v_result);
end;
$$;

create or replace function public.remove_sale_item(p_idempotency_key text, p_sale_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_replay jsonb; v_sale_id uuid; v_status text; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'remove_sale_item', jsonb_build_object('item_id', p_sale_item_id));
  if v_replay is not null then return v_replay; end if;
  select si.sale_id, s.status into v_sale_id, v_status
  from public.sale_items si join public.sales s on s.id = si.sale_id
  where si.id = p_sale_item_id;
  if not found then raise exception 'sale item not found'; end if;
  if v_status <> 'draft' then raise exception 'sale item can be removed only from draft sales'; end if;
  delete from public.sale_items where id = p_sale_item_id;
  v_result := jsonb_build_object('id', p_sale_item_id);
  return app.idempotency_finish(p_idempotency_key, p_sale_item_id, v_result);
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

  if p_initial_payment is not null and coalesce((p_initial_payment ->> 'amount')::numeric, 0) > 0 then
    v_payment := public.record_payment(
      p_idempotency_key || ':initial-payment',
      jsonb_build_object(
        'contact_id', v_sale.customer_id,
        'direction', 'in',
        'amount', (p_initial_payment ->> 'amount')::numeric,
        'payment_method', coalesce(p_initial_payment ->> 'payment_method', 'cash'),
        'reference_number', p_initial_payment ->> 'reference_number',
        'notes', p_initial_payment ->> 'notes'
      )
    );
    perform public.allocate_payment(p_idempotency_key || ':initial-allocation', (v_payment ->> 'id')::uuid, p_sale_id, null, least((p_initial_payment ->> 'amount')::numeric, v_total));
  end if;

  v_result := jsonb_build_object('id', p_sale_id, 'total_amount', v_total);
  return app.idempotency_finish(p_idempotency_key, p_sale_id, v_result);
end;
$$;

create or replace function public.cancel_sale(p_idempotency_key text, p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_sale public.sales%rowtype; v_item record; v_product public.products%rowtype;
  v_allocated numeric; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'cancel_sale', jsonb_build_object('sale_id', p_sale_id, 'reason', p_reason));
  if v_replay is not null then return v_replay; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'cancellation reason is required'; end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or v_sale.status <> 'finalized' then raise exception 'sale must be finalized'; end if;
  select coalesce(sum(app.payment_signed_for_sale(p.direction, pa.allocated_amount)), 0) into v_allocated
  from public.payment_allocations pa join public.payments p on p.id = pa.payment_id
  where pa.sale_id = p_sale_id;
  if v_allocated <> 0 then
    raise exception 'sale has allocated payments; reverse payments before cancellation';
  end if;
  for v_item in select * from public.sale_items where sale_id = p_sale_id order by id loop
    select * into v_product from public.products where id = v_item.product_id for update;
    update public.products set stock_on_hand = stock_on_hand + v_item.base_quantity, version = v_product.version where id = v_product.id;
    insert into public.stock_movements (product_id, movement_type, quantity_delta, sale_item_id, reason, stock_before, stock_after)
    values (v_product.id, 'sale_cancellation', v_item.base_quantity, v_item.id, p_reason, v_product.stock_on_hand, v_product.stock_on_hand + v_item.base_quantity);
  end loop;
  update public.sales set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason, version = v_sale.version where id = p_sale_id;
  v_result := jsonb_build_object('id', p_sale_id);
  return app.idempotency_finish(p_idempotency_key, p_sale_id, v_result);
end;
$$;

create or replace function public.create_draft_purchase(p_idempotency_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_replay jsonb; v_id uuid; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'create_draft_purchase', p_payload);
  if v_replay is not null then return v_replay; end if;
  perform app.assert_contact_role((p_payload ->> 'supplier_id')::uuid, array['supplier']);
  insert into public.purchases (purchase_number, supplier_id, supplier_invoice_number, purchase_date, discount_amount, additional_cost, notes)
  values (
    'PUR-' || lpad(nextval('public.purchase_number_seq')::text, 6, '0'),
    (p_payload ->> 'supplier_id')::uuid,
    p_payload ->> 'supplier_invoice_number',
    coalesce((p_payload ->> 'purchase_date')::date, current_date),
    coalesce((p_payload ->> 'discount_amount')::numeric, 0),
    coalesce((p_payload ->> 'additional_cost')::numeric, 0),
    p_payload ->> 'notes'
  ) returning id into v_id;
  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.add_purchase_item(p_idempotency_key text, p_purchase_id uuid, p_product_id uuid, p_entry_mode text, p_quantity integer, p_cost_per_entry numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_purchase public.purchases%rowtype; v_product public.products%rowtype;
  v_values record; v_id uuid; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'add_purchase_item', jsonb_build_object('purchase_id', p_purchase_id, 'product_id', p_product_id, 'entry_mode', p_entry_mode, 'quantity', p_quantity, 'cost', p_cost_per_entry));
  if v_replay is not null then return v_replay; end if;
  select * into v_purchase from public.purchases where id = p_purchase_id;
  if not found or v_purchase.status <> 'draft' then raise exception 'purchase must be draft'; end if;
  select * into v_product from public.products where id = p_product_id and is_active;
  if not found then raise exception 'active product not found'; end if;
  select * into v_values from app.purchase_item_values(v_product, p_entry_mode, p_quantity, p_cost_per_entry);
  insert into public.purchase_items (
    purchase_id, product_id, product_name_snapshot, entry_mode, entered_quantity,
    base_units_per_entry, base_quantity, cost_per_entry, line_total
  ) values (
    p_purchase_id, p_product_id, v_product.name, p_entry_mode, p_quantity,
    v_values.base_units_per_entry, v_values.base_quantity, v_values.cost_per_entry, v_values.line_total
  ) returning id into v_id;
  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.update_purchase_item(p_idempotency_key text, p_purchase_item_id uuid, p_entry_mode text, p_quantity integer, p_cost_per_entry numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_item public.purchase_items%rowtype; v_purchase public.purchases%rowtype;
  v_product public.products%rowtype; v_values record; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'update_purchase_item', jsonb_build_object('item_id', p_purchase_item_id, 'entry_mode', p_entry_mode, 'quantity', p_quantity, 'cost', p_cost_per_entry));
  if v_replay is not null then return v_replay; end if;
  select * into v_item from public.purchase_items where id = p_purchase_item_id;
  if not found then raise exception 'purchase item not found'; end if;
  select * into v_purchase from public.purchases where id = v_item.purchase_id;
  if v_purchase.status <> 'draft' then raise exception 'purchase item can be changed only in draft purchases'; end if;
  select * into v_product from public.products where id = v_item.product_id;
  select * into v_values from app.purchase_item_values(v_product, p_entry_mode, p_quantity, p_cost_per_entry);
  update public.purchase_items
  set entry_mode = p_entry_mode,
      entered_quantity = p_quantity,
      base_units_per_entry = v_values.base_units_per_entry,
      base_quantity = v_values.base_quantity,
      cost_per_entry = v_values.cost_per_entry,
      line_total = v_values.line_total
  where id = p_purchase_item_id;
  v_result := jsonb_build_object('id', p_purchase_item_id);
  return app.idempotency_finish(p_idempotency_key, p_purchase_item_id, v_result);
end;
$$;

create or replace function public.remove_purchase_item(p_idempotency_key text, p_purchase_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status text; v_replay jsonb; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'remove_purchase_item', jsonb_build_object('item_id', p_purchase_item_id));
  if v_replay is not null then return v_replay; end if;
  select pu.status into v_status from public.purchase_items pi join public.purchases pu on pu.id = pi.purchase_id where pi.id = p_purchase_item_id;
  if not found then raise exception 'purchase item not found'; end if;
  if v_status <> 'draft' then raise exception 'purchase item can be removed only from draft purchases'; end if;
  delete from public.purchase_items where id = p_purchase_item_id;
  v_result := jsonb_build_object('id', p_purchase_item_id);
  return app.idempotency_finish(p_idempotency_key, p_purchase_item_id, v_result);
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
  v_item record; v_product public.products%rowtype; v_payment jsonb; v_result jsonb;
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

  if p_initial_payment is not null and coalesce((p_initial_payment ->> 'amount')::numeric, 0) > 0 then
    v_payment := public.record_payment(
      p_idempotency_key || ':initial-payment',
      jsonb_build_object(
        'contact_id', v_purchase.supplier_id,
        'direction', 'out',
        'amount', (p_initial_payment ->> 'amount')::numeric,
        'payment_method', coalesce(p_initial_payment ->> 'payment_method', 'cash'),
        'reference_number', p_initial_payment ->> 'reference_number',
        'notes', p_initial_payment ->> 'notes'
      )
    );
    perform public.allocate_payment(p_idempotency_key || ':initial-allocation', (v_payment ->> 'id')::uuid, null, p_purchase_id, least((p_initial_payment ->> 'amount')::numeric, v_total));
  end if;

  v_result := jsonb_build_object('id', p_purchase_id, 'total_amount', v_total);
  return app.idempotency_finish(p_idempotency_key, p_purchase_id, v_result);
end;
$$;

create or replace function public.cancel_purchase(p_idempotency_key text, p_purchase_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_purchase public.purchases%rowtype; v_item record; v_product public.products%rowtype;
  v_allocated numeric; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'cancel_purchase', jsonb_build_object('purchase_id', p_purchase_id, 'reason', p_reason));
  if v_replay is not null then return v_replay; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'cancellation reason is required'; end if;
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found or v_purchase.status <> 'finalized' then raise exception 'purchase must be finalized'; end if;
  select coalesce(sum(app.payment_signed_for_purchase(p.direction, pa.allocated_amount)), 0) into v_allocated
  from public.payment_allocations pa join public.payments p on p.id = pa.payment_id
  where pa.purchase_id = p_purchase_id;
  if v_allocated <> 0 then
    raise exception 'purchase has allocated payments; reverse payments before cancellation';
  end if;
  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id order by id loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if v_product.stock_on_hand < v_item.base_quantity then
      raise exception 'purchase cancellation would make stock negative for product %', v_product.name;
    end if;
    update public.products set stock_on_hand = stock_on_hand - v_item.base_quantity, version = v_product.version where id = v_product.id;
    insert into public.stock_movements (product_id, movement_type, quantity_delta, purchase_item_id, reason, stock_before, stock_after)
    values (v_product.id, 'purchase_cancellation', -v_item.base_quantity, v_item.id, p_reason, v_product.stock_on_hand, v_product.stock_on_hand - v_item.base_quantity);
  end loop;
  update public.purchases set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason, version = v_purchase.version where id = p_purchase_id;
  v_result := jsonb_build_object('id', p_purchase_id);
  return app.idempotency_finish(p_idempotency_key, p_purchase_id, v_result);
end;
$$;

create or replace function app.sale_due_for_update(p_sale_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(due_amount, 0) from public.sale_balances where sale_id = p_sale_id;
$$;

create or replace function app.purchase_due_for_update(p_purchase_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(due_amount, 0) from public.purchase_balances where purchase_id = p_purchase_id;
$$;

create or replace function public.allocate_payment(p_idempotency_key text, p_payment_id uuid, p_sale_id uuid default null, p_purchase_id uuid default null, p_amount numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_payment public.payments%rowtype; v_sale public.sales%rowtype; v_purchase public.purchases%rowtype;
  v_allocated numeric; v_due numeric; v_id uuid; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'allocate_payment', jsonb_build_object('payment_id', p_payment_id, 'sale_id', p_sale_id, 'purchase_id', p_purchase_id, 'amount', p_amount));
  if v_replay is not null then return v_replay; end if;
  if (p_sale_id is not null)::integer + (p_purchase_id is not null)::integer <> 1 then
    raise exception 'exactly one of sale_id or purchase_id is required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'allocation amount must be positive'; end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  select coalesce(sum(allocated_amount), 0) into v_allocated from public.payment_allocations where payment_id = p_payment_id;
  if v_allocated + p_amount > v_payment.amount then raise exception 'allocations exceed payment amount'; end if;

  if p_sale_id is not null then
    if v_payment.direction <> 'in' and v_payment.reversed_payment_id is null then raise exception 'customer sale allocations require incoming payments'; end if;
    select * into v_sale from public.sales where id = p_sale_id and status = 'finalized' for update;
    if not found then raise exception 'finalized sale not found'; end if;
    if v_sale.customer_id <> v_payment.contact_id then raise exception 'payment contact does not match sale customer'; end if;
    v_due := app.sale_due_for_update(p_sale_id);
    if p_amount > v_due and v_payment.reversed_payment_id is null then raise exception 'allocation exceeds sale due'; end if;
    insert into public.payment_allocations (payment_id, sale_id, allocated_amount)
    values (p_payment_id, p_sale_id, p_amount) returning id into v_id;
  else
    if v_payment.direction <> 'out' and v_payment.reversed_payment_id is null then raise exception 'supplier purchase allocations require outgoing payments'; end if;
    select * into v_purchase from public.purchases where id = p_purchase_id and status = 'finalized' for update;
    if not found then raise exception 'finalized purchase not found'; end if;
    if v_purchase.supplier_id <> v_payment.contact_id then raise exception 'payment contact does not match purchase supplier'; end if;
    v_due := app.purchase_due_for_update(p_purchase_id);
    if p_amount > v_due and v_payment.reversed_payment_id is null then raise exception 'allocation exceeds purchase due'; end if;
    insert into public.payment_allocations (payment_id, purchase_id, allocated_amount)
    values (p_payment_id, p_purchase_id, p_amount) returning id into v_id;
  end if;

  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.record_payment(p_idempotency_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb; v_id uuid; v_contact_id uuid; v_direction text; v_amount numeric(14,2);
  v_remaining numeric(14,2); v_doc record; v_alloc numeric(14,2); v_result jsonb;
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

create or replace function public.update_shop_settings(p_idempotency_key text, p_expected_version integer, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_replay jsonb; v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(p_idempotency_key, 'update_shop_settings', jsonb_build_object('version', p_expected_version, 'payload', p_payload));
  if v_replay is not null then return v_replay; end if;
  update public.shop_settings
  set owner_user_id = case when p_payload ? 'owner_user_id' then (p_payload ->> 'owner_user_id')::uuid else owner_user_id end,
      owner_email = case when p_payload ? 'owner_email' then p_payload ->> 'owner_email' else owner_email end,
      shop_name = coalesce(p_payload ->> 'shop_name', shop_name),
      owner_name = case when p_payload ? 'owner_name' then p_payload ->> 'owner_name' else owner_name end,
      phone = case when p_payload ? 'phone' then p_payload ->> 'phone' else phone end,
      address = case when p_payload ? 'address' then p_payload ->> 'address' else address end,
      invoice_prefix = coalesce(p_payload ->> 'invoice_prefix', invoice_prefix),
      purchase_prefix = coalesce(p_payload ->> 'purchase_prefix', purchase_prefix),
      currency = coalesce(p_payload ->> 'currency', currency),
      receipt_footer = case when p_payload ? 'receipt_footer' then p_payload ->> 'receipt_footer' else receipt_footer end,
      prices_include_tax = coalesce((p_payload ->> 'prices_include_tax')::boolean, prices_include_tax),
      default_payment_method = coalesce(p_payload ->> 'default_payment_method', default_payment_method),
      version = p_expected_version
  where id;
  v_result := jsonb_build_object('id', true);
  return app.idempotency_finish(p_idempotency_key, null, v_result);
end;
$$;

alter table public.contacts enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.stock_movements enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.shop_settings enable row level security;

create policy owner_all_contacts on public.contacts for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_products on public.products for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_sales on public.sales for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_sale_items on public.sale_items for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_purchases on public.purchases for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_purchase_items on public.purchase_items for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_payments on public.payments for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_payment_allocations on public.payment_allocations for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_stock_movements on public.stock_movements for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_idempotency_keys on public.idempotency_keys for all using (app.is_owner()) with check (app.is_owner());
create policy owner_all_shop_settings on public.shop_settings for all using (app.is_owner()) with check (app.is_owner());

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
