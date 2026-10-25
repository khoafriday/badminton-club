-- SAN-1: courts become their own list in Settings, shared by every club of the same owner.
-- A club can use several courts later; the MVP screen lets it pick one.
-- clubs.venue_name / venue_address are copied here and no longer read by the app. They are kept
-- so the app version already deployed keeps working until this one is merged.
-- Run once in Supabase: SQL Editor, paste this file, Run. Running it again does nothing new.

create table if not exists courts (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references profiles(id),
  name text not null check (length(trim(name)) > 0),
  address text,
  price bigint not null default 0 check (price >= 0),   -- rent per hour, whole VND
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists courts_owner_idx on courts (owner_id);

create table if not exists club_courts (
  club_id uuid not null references clubs(id) on delete cascade,
  court_id uuid not null references courts(id) on delete restrict,   -- a court in use cannot be deleted
  created_at timestamptz not null default now(),
  primary key (club_id, court_id)
);
create index if not exists club_courts_court_idx on club_courts (court_id);

alter table courts enable row level security;
alter table club_courts enable row level security;

-- Move each club's typed court into the list, reusing a court the same owner already has.
do $$
declare
  c record;
  court uuid;
begin
  for c in
    select id, owner_id, trim(venue_name) as name, nullif(trim(venue_address), '') as address
    from clubs
    where nullif(trim(venue_name), '') is not null
      and not exists (select 1 from club_courts cc where cc.club_id = clubs.id)
  loop
    select id into court from courts
    where owner_id = c.owner_id and name = c.name and address is not distinct from c.address
    limit 1;
    if court is null then
      insert into courts (owner_id, name, address) values (c.owner_id, c.name, c.address) returning id into court;
    end if;
    insert into club_courts (club_id, court_id) values (c.id, court) on conflict do nothing;
  end loop;
end $$;
