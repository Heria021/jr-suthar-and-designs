alter table public.contacts
add column if not exists address text;

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

  insert into public.contacts (name, phone, address, contact_type, opening_balance, opening_balance_date, notes)
  values (
    p_payload ->> 'name',
    p_payload ->> 'phone',
    p_payload ->> 'address',
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
      address = case when p_payload ? 'address' then p_payload ->> 'address' else address end,
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
