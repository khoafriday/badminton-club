-- Badminton Club: initial schema (10 tables) and the payment ledger functions.
-- Run once in Supabase: SQL Editor, paste this file, Run.
-- Money is whole VND (bigint). Every table except profiles carries club_id.

create extension if not exists pgcrypto;

create type gender as enum ('male', 'female');
create type member_type as enum ('fixed', 'guest');
create type member_status as enum ('active', 'inactive');
create type charge_mode as enum ('monthly', 'per_session');
create type payment_status as enum ('unpaid', 'paid', 'exempt');
create type fee_status as enum ('unpaid', 'paid', 'waived');
create type payment_method as enum ('cash', 'transfer');
create type session_status as enum ('active', 'cancelled');
create type tx_type as enum ('income', 'expense');
create type tx_source as enum ('manual', 'attendance', 'membership_fee');
create type app_locale as enum ('vi', 'en');

create table profiles (
  id text primary key,                       -- equals the login ID
  display_name text,
  locale app_locale not null default 'vi',
  last_club_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references profiles(id),
  name text not null check (length(trim(name)) > 0),
  description text,
  logo_url text,
  venue_name text,                           -- MVP: one court per club (SAN-1)
  venue_address text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_last_club_fk foreign key (last_club_id) references clubs(id) on delete set null;

create table club_settings (
  club_id uuid primary key references clubs(id) on delete cascade,
  monthly_fee_male bigint not null default 0 check (monthly_fee_male >= 0),
  monthly_fee_female bigint not null default 0 check (monthly_fee_female >= 0),
  guest_price_male bigint not null default 0 check (guest_price_male >= 0),
  guest_price_female bigint not null default 0 check (guest_price_female >= 0),
  currency text not null default 'VND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  gender gender not null,
  phone text,
  member_type member_type not null,
  status member_status not null default 'active',
  fixed_since date,                          -- PHI-2: day the member became fixed
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_type = 'guest' or fixed_since is not null)
);
create index members_club_idx on members (club_id, member_type, status);

create table membership_fees (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  member_id uuid not null references members(id) on delete restrict,
  period_month date not null check (extract(day from period_month) = 1),
  billing_mode charge_mode not null,
  amount_due bigint not null check (amount_due >= 0),
  payment_status fee_status not null default 'unpaid',
  waive_reason text,
  paid_at timestamptz,
  payment_method payment_method,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, period_month)
);

create table session_schedules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),   -- 1 = Monday
  start_time time not null,
  end_time time not null check (end_time > start_time),
  venue_name text,                           -- null = club venue
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  schedule_id uuid references session_schedules(id) on delete set null,
  session_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  venue_name text,
  status session_status not null default 'active',
  cancel_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, session_date)
);
create index sessions_club_date_idx on sessions (club_id, session_date);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete restrict,   -- LICH-7: no delete once used
  member_id uuid not null references members(id) on delete restrict,
  member_type_snapshot member_type not null,
  gender_snapshot gender not null,
  is_present boolean not null default true,
  charge_mode charge_mode not null,
  amount_due bigint not null default 0 check (amount_due >= 0),
  price_note text,                           -- GIA-3: reason for a custom price
  payment_status payment_status not null default 'unpaid',
  paid_at timestamptz,
  payment_method payment_method,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, member_id)
);

create table transaction_categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete cascade,   -- null = shared default
  type tx_type not null,
  code text,                                 -- translated by the UI when set
  name text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code is not null or name is not null)
);
create unique index transaction_categories_code_idx on transaction_categories (code) where club_id is null;

create table transactions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  type tx_type not null,
  category_id uuid not null references transaction_categories(id),
  amount bigint not null check (amount > 0),
  occurred_on date not null,
  description text,
  session_id uuid references sessions(id) on delete set null,
  source_type tx_source not null default 'manual',
  source_id uuid,
  attachment_url text,
  created_by text references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source_type = 'manual') = (source_id is null))
);
create unique index transactions_source_idx on transactions (source_type, source_id) where source_id is not null;
create index transactions_club_date_idx on transactions (club_id, occurred_on);

insert into transaction_categories (club_id, type, code, is_system) values
  (null, 'expense', 'court_rent', false),
  (null, 'expense', 'shuttlecocks', false),
  (null, 'expense', 'drinks', false),
  (null, 'expense', 'social_match', false),
  (null, 'expense', 'tournament', false),
  (null, 'expense', 'other_expense', false),
  (null, 'income', 'sponsorship', false),
  (null, 'income', 'penalty', false),
  (null, 'income', 'extra_contribution', false),
  (null, 'income', 'other_income', false),
  (null, 'income', 'guest_fee', true),
  (null, 'income', 'membership_fee', true),
  (null, 'income', 'opening_balance', true);

-- The browser never talks to the database: the app uses the service role key on the server only.
-- RLS on with no policies blocks the public anon key completely.
alter table profiles enable row level security;
alter table clubs enable row level security;
alter table club_settings enable row level security;
alter table members enable row level security;
alter table membership_fees enable row level security;
alter table session_schedules enable row level security;
alter table sessions enable row level security;
alter table attendance enable row level security;
alter table transaction_categories enable row level security;
alter table transactions enable row level security;

-- Mark one attendance line paid or unpaid, and keep the ledger in step in the same transaction.
create or replace function set_attendance_payment(
  p_attendance_id uuid,
  p_paid boolean,
  p_method payment_method default 'cash',
  p_actor text default null
) returns void
language plpgsql
as $$
declare
  a attendance;
  s sessions;
begin
  select * into a from attendance where id = p_attendance_id for update;
  if not found then
    raise exception 'attendance % not found', p_attendance_id;
  end if;
  select * into s from sessions where id = a.session_id;

  if p_paid then
    update attendance
       set payment_status = 'paid', paid_at = now(), payment_method = p_method, updated_at = now()
     where id = a.id;
    if a.amount_due > 0 then
      insert into transactions (club_id, type, category_id, amount, occurred_on, description,
                                session_id, source_type, source_id, created_by)
      values (s.club_id, 'income',
              (select id from transaction_categories where code = 'guest_fee' and club_id is null),
              a.amount_due, s.session_date, null, s.id, 'attendance', a.id, p_actor)
      on conflict (source_type, source_id) where source_id is not null
      do update set amount = excluded.amount, updated_at = now();
    end if;
  else
    update attendance
       set payment_status = 'unpaid', paid_at = null, payment_method = null, updated_at = now()
     where id = a.id;
    delete from transactions where source_type = 'attendance' and source_id = a.id;
  end if;
end;
$$;

-- Same for a monthly fee slip.
create or replace function set_fee_payment(
  p_fee_id uuid,
  p_paid boolean,
  p_method payment_method default 'cash',
  p_actor text default null
) returns void
language plpgsql
as $$
declare
  f membership_fees;
begin
  select * into f from membership_fees where id = p_fee_id for update;
  if not found then
    raise exception 'membership fee % not found', p_fee_id;
  end if;

  if p_paid then
    update membership_fees
       set payment_status = 'paid', paid_at = now(), payment_method = p_method,
           waive_reason = null, updated_at = now()
     where id = f.id;
    if f.amount_due > 0 then
      insert into transactions (club_id, type, category_id, amount, occurred_on, description,
                                source_type, source_id, created_by)
      values (f.club_id, 'income',
              (select id from transaction_categories where code = 'membership_fee' and club_id is null),
              f.amount_due, current_date, null, 'membership_fee', f.id, p_actor)
      on conflict (source_type, source_id) where source_id is not null
      do update set amount = excluded.amount, updated_at = now();
    end if;
  else
    update membership_fees
       set payment_status = 'unpaid', paid_at = null, payment_method = null, updated_at = now()
     where id = f.id;
    delete from transactions where source_type = 'membership_fee' and source_id = f.id;
  end if;
end;
$$;

-- Ledger functions are for the server (service role) only.
revoke execute on function set_attendance_payment(uuid, boolean, payment_method, text) from public, anon, authenticated;
revoke execute on function set_fee_payment(uuid, boolean, payment_method, text) from public, anon, authenticated;
