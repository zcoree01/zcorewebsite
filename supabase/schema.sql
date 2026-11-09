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
  pinned boolean not null default false,  -- objava na vrhu bloga (najviše jedna, vidi okidač ispod)
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

-- Upiti s kontakt obrasca (vidljivi samo u admin panelu)
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  company text not null check (char_length(company) between 1 and 200),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  employees text check (employees is null or char_length(employees) <= 40),
  message text check (message is null or char_length(message) <= 5000),
  consent boolean not null check (consent),
  status text not null default 'novo' check (status in ('novo', 'procitano', 'odgovoreno', 'arhiva')),
  note text check (note is null or char_length(note) <= 5000),
  created_at timestamptz not null default now()
);
create index if not exists inquiries_created_idx on public.inquiries (status, created_at desc);
alter table public.inquiries enable row level security;

drop policy if exists "inquiries: javno slanje" on public.inquiries;
create policy "inquiries: javno slanje" on public.inquiries
  for insert to anon, authenticated with check (status = 'novo' and note is null);
drop policy if exists "inquiries: admin čita" on public.inquiries;
create policy "inquiries: admin čita" on public.inquiries
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "inquiries: admin mijenja" on public.inquiries;
create policy "inquiries: admin mijenja" on public.inquiries
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "inquiries: admin briše" on public.inquiries;
create policy "inquiries: admin briše" on public.inquiries
  for delete to authenticated using ((select public.is_admin()));

-- Zaštita od poplave spama: najviše 30 upita u 10 minuta za cijelu stranicu
create or replace function public.inquiries_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.inquiries where created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Previše upita u kratkom vremenu. Pokušajte malo kasnije.';
  end if;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.inquiries_rate_limit() from public, anon, authenticated;
drop trigger if exists inquiries_rate_limit on public.inquiries;
create trigger inquiries_rate_limit before insert on public.inquiries
  for each row execute function public.inquiries_rate_limit();

-- Najviše jedna objava „na vrhu”: kad se jedna uključi, ostale se isključe.
create or replace function public.posts_single_pinned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pinned then
    update public.posts set pinned = false where pinned and id <> new.id;
  end if;
  return new;
end $$;
create trigger posts_single_pinned before insert or update of pinned on public.posts
for each row when (new.pinned) execute function public.posts_single_pinned();
create unique index posts_one_pinned on public.posts (pinned) where pinned;
