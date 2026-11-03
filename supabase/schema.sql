-- ============================================================================
-- Zcore web – baza za blog i "Vjeruju nam" (Supabase / Postgres)
-- Pokreće se jednom na novom projektu. Pristup:
--   * svi: čitaju samo objavljene objave i vidljive klijente
--   * admin (e-pošta u admin_emails, potvrđena): sve
-- ============================================================================

-- Admini (po e-pošti)
create table if not exists public.admin_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admin_emails enable row level security;
-- nema politika: tabelu čitaju samo funkcije ispod i vlasnik baze

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_emails a on a.email = lower(u.email)
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Automatsko vrijeme izmjene
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Objave
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text check (excerpt is null or char_length(excerpt) <= 300),
  content text not null default '',
  cover_url text,
  category text not null default 'Vijesti',
  author text not null default 'Zcore',
  published boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_published_idx on public.posts (published, published_at desc);
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();
alter table public.posts enable row level security;

drop policy if exists "posts: javno čitanje objavljenih" on public.posts;
create policy "posts: javno čitanje objavljenih" on public.posts
  for select to anon, authenticated
  using ((published and published_at <= now()) or (select public.is_admin()));
drop policy if exists "posts: admin dodaje" on public.posts;
create policy "posts: admin dodaje" on public.posts
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "posts: admin mijenja" on public.posts;
create policy "posts: admin mijenja" on public.posts
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "posts: admin briše" on public.posts;
create policy "posts: admin briše" on public.posts
  for delete to authenticated using ((select public.is_admin()));

-- Klijenti ("Vjeruju nam")
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  logo_url text,
  website text,
  sort integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists clients_sort_idx on public.clients (visible, sort);
alter table public.clients enable row level security;

drop policy if exists "clients: javno čitanje vidljivih" on public.clients;
create policy "clients: javno čitanje vidljivih" on public.clients
  for select to anon, authenticated
  using (visible or (select public.is_admin()));
drop policy if exists "clients: admin dodaje" on public.clients;
create policy "clients: admin dodaje" on public.clients
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "clients: admin mijenja" on public.clients;
create policy "clients: admin mijenja" on public.clients
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "clients: admin briše" on public.clients;
create policy "clients: admin briše" on public.clients
  for delete to authenticated using ((select public.is_admin()));

-- Slike (javni bucket "media"; pišu samo admini)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: admin dodaje" on storage.objects;
create policy "media: admin dodaje" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and (select public.is_admin()));
drop policy if exists "media: admin mijenja" on storage.objects;
create policy "media: admin mijenja" on storage.objects
  for update to authenticated using (bucket_id = 'media' and (select public.is_admin()));
drop policy if exists "media: admin briše" on storage.objects;
create policy "media: admin briše" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (select public.is_admin()));
