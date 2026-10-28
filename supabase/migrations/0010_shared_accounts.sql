-- TK: one login per person, shared by every club they play in. account_members links the login to the
-- person's member row in each club. member_accounts (0009) is copied here and no longer read by the app;
-- it stays so the app version already deployed keeps working until this one is merged.
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique check (login_id = lower(trim(login_id)) and length(login_id) > 0),
  password_hash text not null,                      -- scrypt "salt:hash", hex
  password_changed boolean not null default false,  -- false: ask to change it after logging in
  last_club_id uuid,                                -- the club Tổng quan and Quỹ last showed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists account_members (
  member_id uuid primary key references members(id) on delete cascade,   -- a member row has at most one login
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists account_members_account_idx on account_members (account_id);

alter table accounts enable row level security;
alter table account_members enable row level security;

insert into accounts (login_id, password_hash, password_changed, created_at)
select login_id, password_hash, password_changed, created_at from member_accounts
on conflict (login_id) do nothing;

insert into account_members (member_id, account_id)
select ma.member_id, a.id from member_accounts ma join accounts a on a.login_id = ma.login_id
on conflict (member_id) do nothing;
