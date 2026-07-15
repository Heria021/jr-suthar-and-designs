create table if not exists public.arch_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text not null check (length(trim(phone)) > 0),
  city text,
  pincode text,
  message text not null check (length(trim(message)) > 0),
  source_path text not null default '/architecture/contact',
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arch_inquiries_created_at_idx
on public.arch_inquiries(created_at desc);

create index if not exists arch_inquiries_status_created_at_idx
on public.arch_inquiries(status, created_at desc);

create index if not exists arch_inquiries_search_idx
on public.arch_inquiries using gin (
  to_tsvector(
    'simple',
    coalesce(name, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(pincode, '') || ' ' ||
    coalesce(message, '')
  )
);

drop trigger if exists arch_inquiries_touch_updated_at on public.arch_inquiries;
create trigger arch_inquiries_touch_updated_at
before update on public.arch_inquiries
for each row execute function app.touch_arch_updated_at();

alter table public.arch_inquiries enable row level security;

drop policy if exists owner_all_arch_inquiries on public.arch_inquiries;
drop policy if exists public_insert_arch_inquiries on public.arch_inquiries;

create policy owner_all_arch_inquiries
on public.arch_inquiries for all to authenticated
using (app.is_owner())
with check (app.is_owner());

create policy public_insert_arch_inquiries
on public.arch_inquiries for insert to anon, authenticated
with check (true);

grant insert on public.arch_inquiries to anon, authenticated;
grant select, update, delete on public.arch_inquiries to authenticated;
grant all on public.arch_inquiries to service_role;
