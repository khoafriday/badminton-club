-- TK: a fixed member's own login, made by the club owner. Members can only look at Tổng quan, Lịch and Quỹ.
-- password_hash is scrypt ("salt:hash", hex); the plain password is never stored.
create table if not exists member_accounts (
  member_id uuid primary key references members(id) on delete cascade,
  login_id text not null unique check (login_id = lower(trim(login_id)) and length(login_id) > 0),
  password_hash text not null,
  password_changed boolean not null default false,   -- false: ask to change it after logging in
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table member_accounts enable row level security;
