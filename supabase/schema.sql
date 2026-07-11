-- Finance Dashboard starter schema.
-- Run this once in Supabase SQL Editor before using persistent data.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null default 'demo',
  name text not null,
  category text not null,
  source text,
  date text not null,
  month text not null default '2025-06',
  amount numeric(14, 2) not null check (amount >= 0),
  type text not null check (type in ('income', 'expense')),
  icon text not null default '*',
  color text not null default 'peach',
  created_at timestamptz not null default now()
);

alter table public.transactions add column if not exists month text not null default '2025-06';

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null default 'demo',
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  color text not null default 'teal',
  created_at timestamptz not null default now(),
  unique (owner_key, name)
);

alter table public.transactions enable row level security;
alter table public.categories enable row level security;

drop policy if exists "demo transactions read" on public.transactions;
drop policy if exists "demo transactions insert" on public.transactions;
drop policy if exists "demo categories read" on public.categories;
drop policy if exists "demo categories insert" on public.categories;

create policy "demo transactions read" on public.transactions for select to anon, authenticated using (owner_key = 'demo');
create policy "demo transactions insert" on public.transactions for insert to anon, authenticated with check (owner_key = 'demo');
create policy "demo categories read" on public.categories for select to anon, authenticated using (owner_key = 'demo');
create policy "demo categories insert" on public.categories for insert to anon, authenticated with check (owner_key = 'demo');

insert into public.categories (name, kind, color)
values
  ('Groceries', 'expense', 'orange'),
  ('Transport', 'expense', 'blue'),
  ('Subscriptions', 'expense', 'purple'),
  ('Freelance', 'income', 'green'),
  ('Other income', 'income', 'teal')
on conflict (owner_key, name) do nothing;

-- Gmail OAuth refresh tokens are server-only data. Do not expose this table through the browser.
create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null default 'demo',
  gmail_address text not null,
  refresh_token text not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_key, gmail_address)
);

alter table public.gmail_connections enable row level security;
revoke all on public.gmail_connections from anon, authenticated;
grant select, insert, update on public.gmail_connections to service_role;
