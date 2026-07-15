insert into public.contacts (id, name, contact_type, opening_balance, opening_balance_date)
values ('00000000-0000-0000-0000-000000000001', 'Walk-in Customer', 'walk_in', 0, current_date)
on conflict (id) do nothing;

insert into public.shop_settings (id, owner_email)
values (true, 'owner@example.com')
on conflict (id) do nothing;
