create table if not exists public.arch_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arch_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.arch_clients(id) on delete restrict,
  project_type text not null check (
    project_type in (
      'residential',
      'commercial',
      'interior',
      'renovation',
      'visualization',
      'other'
    )
  ),
  location text,
  description text,
  is_public boolean not null default false,
  is_featured boolean not null default false,
  slug text unique,
  sort_order integer not null default 0,
  public_title text,
  public_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_public = false or slug is not null),
  check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.arch_project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.arch_projects(id) on delete cascade,
  file_path text not null check (length(trim(file_path)) > 0),
  caption text,
  phase text check (phase in ('before', 'during', 'after')),
  is_public boolean not null default false,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists arch_clients_search_idx
on public.arch_clients using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(phone, '')));

create index if not exists arch_projects_client_idx on public.arch_projects(client_id, created_at desc);
create index if not exists arch_projects_public_idx on public.arch_projects(is_public, is_featured, sort_order, created_at desc);
create index if not exists arch_projects_type_idx on public.arch_projects(project_type);
create index if not exists arch_project_media_project_idx on public.arch_project_media(project_id, sort_order, created_at);
create unique index if not exists arch_project_media_file_path_uidx on public.arch_project_media(file_path);
create unique index if not exists idx_one_cover_per_project
on public.arch_project_media(project_id)
where is_cover = true;

create or replace function app.touch_arch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists arch_clients_touch_updated_at on public.arch_clients;
create trigger arch_clients_touch_updated_at
before update on public.arch_clients
for each row execute function app.touch_arch_updated_at();

drop trigger if exists arch_projects_touch_updated_at on public.arch_projects;
create trigger arch_projects_touch_updated_at
before update on public.arch_projects
for each row execute function app.touch_arch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arch-project-media',
  'arch-project-media',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.create_arch_client(p_idempotency_key text, p_payload jsonb)
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
  v_replay := app.idempotency_get_result(p_idempotency_key, 'create_arch_client', p_payload);
  if v_replay is not null then return v_replay; end if;

  insert into public.arch_clients (name, phone)
  values (p_payload ->> 'name', p_payload ->> 'phone')
  returning id into v_id;

  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.update_arch_client(p_idempotency_key text, p_client_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(
    p_idempotency_key,
    'update_arch_client',
    jsonb_build_object('id', p_client_id, 'payload', p_payload)
  );
  if v_replay is not null then return v_replay; end if;

  update public.arch_clients
  set name = coalesce(p_payload ->> 'name', name),
      phone = case when p_payload ? 'phone' then p_payload ->> 'phone' else phone end
  where id = p_client_id;

  if not found then raise exception 'architecture client not found'; end if;

  v_result := jsonb_build_object('id', p_client_id);
  return app.idempotency_finish(p_idempotency_key, p_client_id, v_result);
end;
$$;

create or replace function public.delete_arch_client(p_idempotency_key text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(
    p_idempotency_key,
    'delete_arch_client',
    jsonb_build_object('id', p_client_id)
  );
  if v_replay is not null then return v_replay; end if;

  if exists (select 1 from public.arch_projects where client_id = p_client_id) then
    raise exception 'client has projects and cannot be deleted';
  end if;

  delete from public.arch_clients where id = p_client_id;
  if not found then raise exception 'architecture client not found'; end if;

  v_result := jsonb_build_object('id', p_client_id);
  return app.idempotency_finish(p_idempotency_key, p_client_id, v_result);
end;
$$;

create or replace function public.create_arch_project(p_idempotency_key text, p_payload jsonb)
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
  v_replay := app.idempotency_get_result(p_idempotency_key, 'create_arch_project', p_payload);
  if v_replay is not null then return v_replay; end if;

  insert into public.arch_projects (
    client_id,
    project_type,
    location,
    description,
    is_public,
    is_featured,
    slug,
    sort_order,
    public_title,
    public_description
  )
  values (
    (p_payload ->> 'client_id')::uuid,
    p_payload ->> 'project_type',
    p_payload ->> 'location',
    p_payload ->> 'description',
    coalesce((p_payload ->> 'is_public')::boolean, false),
    coalesce((p_payload ->> 'is_featured')::boolean, false),
    nullif(p_payload ->> 'slug', ''),
    coalesce((p_payload ->> 'sort_order')::integer, 0),
    p_payload ->> 'public_title',
    p_payload ->> 'public_description'
  )
  returning id into v_id;

  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.update_arch_project(p_idempotency_key text, p_project_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(
    p_idempotency_key,
    'update_arch_project',
    jsonb_build_object('id', p_project_id, 'payload', p_payload)
  );
  if v_replay is not null then return v_replay; end if;

  update public.arch_projects
  set client_id = coalesce((p_payload ->> 'client_id')::uuid, client_id),
      project_type = coalesce(p_payload ->> 'project_type', project_type),
      location = case when p_payload ? 'location' then p_payload ->> 'location' else location end,
      description = case when p_payload ? 'description' then p_payload ->> 'description' else description end,
      is_public = coalesce((p_payload ->> 'is_public')::boolean, is_public),
      is_featured = coalesce((p_payload ->> 'is_featured')::boolean, is_featured),
      slug = case when p_payload ? 'slug' then nullif(p_payload ->> 'slug', '') else slug end,
      sort_order = coalesce((p_payload ->> 'sort_order')::integer, sort_order),
      public_title = case when p_payload ? 'public_title' then p_payload ->> 'public_title' else public_title end,
      public_description = case when p_payload ? 'public_description' then p_payload ->> 'public_description' else public_description end
  where id = p_project_id;

  if not found then raise exception 'architecture project not found'; end if;

  v_result := jsonb_build_object('id', p_project_id);
  return app.idempotency_finish(p_idempotency_key, p_project_id, v_result);
end;
$$;

create or replace function public.delete_arch_project(p_idempotency_key text, p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_file_paths text[];
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(
    p_idempotency_key,
    'delete_arch_project',
    jsonb_build_object('id', p_project_id)
  );
  if v_replay is not null then return v_replay; end if;

  select coalesce(array_agg(file_path), array[]::text[])
  into v_file_paths
  from public.arch_project_media
  where project_id = p_project_id;

  delete from public.arch_projects where id = p_project_id;
  if not found then raise exception 'architecture project not found'; end if;

  v_result := jsonb_build_object('id', p_project_id, 'file_paths', v_file_paths);
  return app.idempotency_finish(p_idempotency_key, p_project_id, v_result);
end;
$$;

create or replace function public.create_arch_project_media(p_idempotency_key text, p_project_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_replay jsonb;
  v_id uuid;
  v_is_cover boolean := coalesce((p_payload ->> 'is_cover')::boolean, false);
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(
    p_idempotency_key,
    'create_arch_project_media',
    jsonb_build_object('project_id', p_project_id, 'payload', p_payload)
  );
  if v_replay is not null then return v_replay; end if;

  if not exists (select 1 from public.arch_projects where id = p_project_id) then
    raise exception 'architecture project not found';
  end if;

  if v_is_cover then
    update public.arch_project_media
    set is_cover = false
    where project_id = p_project_id and is_cover;
  end if;

  insert into public.arch_project_media (
    project_id,
    file_path,
    caption,
    phase,
    is_public,
    is_cover,
    sort_order
  )
  values (
    p_project_id,
    p_payload ->> 'file_path',
    p_payload ->> 'caption',
    nullif(p_payload ->> 'phase', ''),
    coalesce((p_payload ->> 'is_public')::boolean, false),
    v_is_cover,
    coalesce((p_payload ->> 'sort_order')::integer, 0)
  )
  returning id into v_id;

  v_result := jsonb_build_object('id', v_id);
  return app.idempotency_finish(p_idempotency_key, v_id, v_result);
end;
$$;

create or replace function public.update_arch_project_media(p_idempotency_key text, p_media_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_media public.arch_project_media%rowtype;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(
    p_idempotency_key,
    'update_arch_project_media',
    jsonb_build_object('id', p_media_id, 'payload', p_payload)
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_media from public.arch_project_media where id = p_media_id for update;
  if not found then raise exception 'architecture project media not found'; end if;

  if coalesce((p_payload ->> 'is_cover')::boolean, false) then
    update public.arch_project_media
    set is_cover = false
    where project_id = v_media.project_id and id <> p_media_id and is_cover;
  end if;

  update public.arch_project_media
  set caption = case when p_payload ? 'caption' then p_payload ->> 'caption' else caption end,
      phase = case when p_payload ? 'phase' then nullif(p_payload ->> 'phase', '') else phase end,
      is_public = coalesce((p_payload ->> 'is_public')::boolean, is_public),
      is_cover = coalesce((p_payload ->> 'is_cover')::boolean, is_cover),
      sort_order = coalesce((p_payload ->> 'sort_order')::integer, sort_order)
  where id = p_media_id;

  v_result := jsonb_build_object('id', p_media_id);
  return app.idempotency_finish(p_idempotency_key, p_media_id, v_result);
end;
$$;

create or replace function public.delete_arch_project_media(p_idempotency_key text, p_media_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_media public.arch_project_media%rowtype;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(
    p_idempotency_key,
    'delete_arch_project_media',
    jsonb_build_object('id', p_media_id)
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_media from public.arch_project_media where id = p_media_id;
  if not found then raise exception 'architecture project media not found'; end if;

  delete from public.arch_project_media where id = p_media_id;

  v_result := jsonb_build_object('id', p_media_id, 'file_path', v_media.file_path);
  return app.idempotency_finish(p_idempotency_key, p_media_id, v_result);
end;
$$;

create or replace function public.reorder_arch_project_media(p_idempotency_key text, p_project_id uuid, p_media_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replay jsonb;
  v_media record;
  v_result jsonb;
begin
  perform app.assert_owner();
  v_replay := app.idempotency_get_result(
    p_idempotency_key,
    'reorder_arch_project_media',
    jsonb_build_object('project_id', p_project_id, 'media_ids', p_media_ids)
  );
  if v_replay is not null then return v_replay; end if;

  if not exists (select 1 from public.arch_projects where id = p_project_id) then
    raise exception 'architecture project not found';
  end if;

  for v_media in
    select media_id, ordinality
    from unnest(p_media_ids) with ordinality as ordered_media(media_id, ordinality)
  loop
    update public.arch_project_media
    set sort_order = v_media.ordinality - 1
    where id = v_media.media_id and project_id = p_project_id;

    if not found then
      raise exception 'media item % does not belong to project', v_media.media_id;
    end if;
  end loop;

  v_result := jsonb_build_object('id', p_project_id);
  return app.idempotency_finish(p_idempotency_key, p_project_id, v_result);
end;
$$;

create or replace function public.list_public_arch_projects()
returns table (
  id uuid,
  slug text,
  project_type text,
  location text,
  public_title text,
  public_description text,
  is_featured boolean,
  sort_order integer,
  cover_file_path text,
  cover_caption text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.slug,
    p.project_type,
    p.location,
    p.public_title,
    p.public_description,
    p.is_featured,
    p.sort_order,
    cover.file_path as cover_file_path,
    cover.caption as cover_caption
  from public.arch_projects p
  left join lateral (
    select m.file_path, m.caption
    from public.arch_project_media m
    where m.project_id = p.id
      and m.is_public
    order by m.is_cover desc, m.sort_order, m.created_at
    limit 1
  ) cover on true
  where p.is_public
  order by p.is_featured desc, p.sort_order, p.created_at desc;
$$;

create or replace function public.get_public_arch_project(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.id is null then null
    else jsonb_build_object(
      'project',
      jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'project_type', p.project_type,
        'location', p.location,
        'public_title', p.public_title,
        'public_description', p.public_description,
        'is_featured', p.is_featured,
        'sort_order', p.sort_order
      ),
      'media',
      coalesce(media.items, '[]'::jsonb)
    )
  end
  from public.arch_projects p
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'file_path', m.file_path,
        'caption', m.caption,
        'phase', m.phase,
        'is_cover', m.is_cover,
        'sort_order', m.sort_order
      )
      order by m.is_cover desc, m.sort_order, m.created_at
    ) as items
    from public.arch_project_media m
    where m.project_id = p.id
      and m.is_public
  ) media on true
  where p.slug = p_slug
    and p.is_public;
$$;

alter table public.arch_clients enable row level security;
alter table public.arch_projects enable row level security;
alter table public.arch_project_media enable row level security;

drop policy if exists owner_all_arch_clients on public.arch_clients;
drop policy if exists owner_all_arch_projects on public.arch_projects;
drop policy if exists owner_all_arch_project_media on public.arch_project_media;
drop policy if exists public_select_arch_projects on public.arch_projects;
drop policy if exists public_select_arch_project_media on public.arch_project_media;

create policy owner_all_arch_clients
on public.arch_clients for all to authenticated
using (app.is_owner())
with check (app.is_owner());

create policy owner_all_arch_projects
on public.arch_projects for all to authenticated
using (app.is_owner())
with check (app.is_owner());

create policy owner_all_arch_project_media
on public.arch_project_media for all to authenticated
using (app.is_owner())
with check (app.is_owner());

create policy public_select_arch_projects
on public.arch_projects for select to anon, authenticated
using (is_public);

create policy public_select_arch_project_media
on public.arch_project_media for select to anon, authenticated
using (
  is_public
  and exists (
    select 1
    from public.arch_projects p
    where p.id = arch_project_media.project_id
      and p.is_public
  )
);

drop policy if exists owner_all_arch_project_media_objects on storage.objects;
drop policy if exists public_select_arch_project_media_objects on storage.objects;

create policy owner_all_arch_project_media_objects
on storage.objects for all to authenticated
using (bucket_id = 'arch-project-media' and app.is_owner())
with check (bucket_id = 'arch-project-media' and app.is_owner());

create policy public_select_arch_project_media_objects
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'arch-project-media'
  and exists (
    select 1
    from public.arch_project_media m
    join public.arch_projects p on p.id = m.project_id
    where m.file_path = storage.objects.name
      and m.is_public
      and p.is_public
  )
);

grant select on public.arch_clients, public.arch_projects, public.arch_project_media to authenticated;
grant select on public.arch_projects, public.arch_project_media to anon;
grant all on public.arch_clients, public.arch_projects, public.arch_project_media to service_role;

revoke execute on function public.create_arch_client(text, jsonb) from public, anon;
revoke execute on function public.update_arch_client(text, uuid, jsonb) from public, anon;
revoke execute on function public.delete_arch_client(text, uuid) from public, anon;
revoke execute on function public.create_arch_project(text, jsonb) from public, anon;
revoke execute on function public.update_arch_project(text, uuid, jsonb) from public, anon;
revoke execute on function public.delete_arch_project(text, uuid) from public, anon;
revoke execute on function public.create_arch_project_media(text, uuid, jsonb) from public, anon;
revoke execute on function public.update_arch_project_media(text, uuid, jsonb) from public, anon;
revoke execute on function public.delete_arch_project_media(text, uuid) from public, anon;
revoke execute on function public.reorder_arch_project_media(text, uuid, uuid[]) from public, anon;

grant execute on function public.create_arch_client(text, jsonb) to authenticated, service_role;
grant execute on function public.update_arch_client(text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.delete_arch_client(text, uuid) to authenticated, service_role;
grant execute on function public.create_arch_project(text, jsonb) to authenticated, service_role;
grant execute on function public.update_arch_project(text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.delete_arch_project(text, uuid) to authenticated, service_role;
grant execute on function public.create_arch_project_media(text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.update_arch_project_media(text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.delete_arch_project_media(text, uuid) to authenticated, service_role;
grant execute on function public.reorder_arch_project_media(text, uuid, uuid[]) to authenticated, service_role;

grant execute on function public.list_public_arch_projects() to anon, authenticated, service_role;
grant execute on function public.get_public_arch_project(text) to anon, authenticated, service_role;
