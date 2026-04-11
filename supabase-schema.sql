-- G2 Proposal Builder — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run

-- Proposals table (one row per customer proposal)
create table proposals (
  id           uuid default gen_random_uuid() primary key,
  name         text not null,
  customer     text,
  rep          text,
  grand_total  numeric default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Version snapshots (full JSON state saved each time)
create table proposal_versions (
  id           uuid default gen_random_uuid() primary key,
  proposal_id  uuid references proposals(id) on delete cascade,
  version_num  integer not null,
  snapshot     jsonb not null,
  notes        text,
  created_at   timestamptz default now()
);

-- Index for fast version lookups per proposal
create index on proposal_versions (proposal_id, version_num desc);

-- Allow public read/write (no auth — anyone with the anon key can access)
alter table proposals enable row level security;
alter table proposal_versions enable row level security;

create policy "public_all" on proposals for all using (true) with check (true);
create policy "public_all" on proposal_versions for all using (true) with check (true);

-- Rate cards (shared team rate card with volume discounts)
create table if not exists rate_cards (
  id           uuid default gen_random_uuid() primary key,
  card_data    jsonb not null default '{}',
  updated_at   timestamptz default now()
);

alter table rate_cards enable row level security;
create policy "public_all" on rate_cards for all using (true) with check (true);
