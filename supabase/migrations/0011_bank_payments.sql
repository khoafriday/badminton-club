-- QR chuyển khoản: a member taps "Đóng tiền nợ", the app shows a VietQR for everything they owe with a code of its own
-- as the transfer note. SePay calls /api/webhooks/sepay when the money reaches the club's TPBank account, and
-- confirm_payment_request marks the debts Đã nộp (TT-3) and writes their income lines (QUY-1).

-- The account money is paid into. bank_bin is the NAPAS bank id; 970423 is TPBank.
alter table club_settings add column if not exists bank_bin text not null default '970423';
alter table club_settings add column if not exists bank_account_no text;
alter table club_settings add column if not exists bank_account_name text;

-- One QR. status: pending (waiting for the money), superseded (the debt changed and a newer QR replaced it; a transfer
-- that still fits is accepted), paid, needs_review (money came but did not fit; the admin settles it).
create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  code text not null unique,
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'superseded', 'paid', 'needs_review')),
  received_amount bigint,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payment_requests_member_idx on payment_requests (member_id, created_at desc);

-- What the QR pays for, fixed when it was made: unpaid monthly slips and unpaid session lines.
create table if not exists payment_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references payment_requests(id) on delete cascade,
  membership_fee_id uuid references membership_fees(id) on delete cascade,
  attendance_id uuid references attendance(id) on delete cascade,
  amount bigint not null check (amount > 0),
  check ((membership_fee_id is null) <> (attendance_id is null))
);
create index if not exists payment_request_items_request_idx on payment_request_items (request_id);

-- Transfers SePay reported that carry one of our codes. Other money on the account is never stored.
-- status: matched (paid a QR), overpaid (paid a QR with money left over), unmatched (no QR has this code),
-- needs_review (the QR's debts changed or the amount was short), resolved (the admin dealt with it).
create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_tx_id text not null,
  club_id uuid references clubs(id) on delete cascade,
  request_id uuid references payment_requests(id) on delete set null,
  account_no text,
  amount bigint not null,
  content text not null default '',
  occurred_at timestamptz not null,
  status text not null default 'unmatched'
    check (status in ('matched', 'overpaid', 'unmatched', 'needs_review', 'resolved')),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_tx_id)
);
create index if not exists bank_transactions_club_status_idx on bank_transactions (club_id, status);

alter table payment_requests enable row level security;
alter table payment_request_items enable row level security;
alter table bank_transactions enable row level security;

-- Settles one transfer against one QR, all in one transaction. Returns the bank transaction's new status.
-- Every item must still be unpaid at the amount it had, and the money must cover the QR; otherwise nothing is paid.
create or replace function confirm_payment_request(p_request_id uuid, p_bank_tx_id uuid)
returns text
language plpgsql
as $$
declare
  r payment_requests;
  t bank_transactions;
  item payment_request_items;
  fee_ids uuid[] := '{}';
  attendance_ids uuid[] := '{}';
  still_owed boolean := true;
  result text;
begin
  select * into r from payment_requests where id = p_request_id for update;
  select * into t from bank_transactions where id = p_bank_tx_id for update;
  if r.id is null or t.id is null then
    raise exception 'payment request % or bank transaction % not found', p_request_id, p_bank_tx_id;
  end if;

  if r.status not in ('pending', 'superseded') then
    still_owed := false;
  end if;
  for item in select * from payment_request_items where request_id = r.id loop
    if item.membership_fee_id is not null then
      fee_ids := fee_ids || item.membership_fee_id;
      perform 1 from membership_fees
        where id = item.membership_fee_id and payment_status = 'unpaid' and amount_due = item.amount for update;
    else
      attendance_ids := attendance_ids || item.attendance_id;
      perform 1 from attendance
        where id = item.attendance_id and payment_status = 'unpaid' and amount_due = item.amount for update;
    end if;
    if not found then
      still_owed := false;
    end if;
  end loop;

  if not still_owed or t.amount < r.amount then
    update bank_transactions set status = 'needs_review', club_id = r.club_id, request_id = r.id where id = t.id;
    if r.status in ('pending', 'superseded') then
      update payment_requests set status = 'needs_review', received_amount = t.amount where id = r.id;
    end if;
    return 'needs_review';
  end if;

  for i in 1 .. coalesce(array_length(fee_ids, 1), 0) loop
    perform set_fee_payment(fee_ids[i], true, 'transfer', null);
  end loop;
  for i in 1 .. coalesce(array_length(attendance_ids, 1), 0) loop
    perform set_attendance_payment(attendance_ids[i], true, 'transfer', null);
  end loop;
  -- Monthly fee lines take the transfer's day and share a batch, like "Thu tiền sân", so they can be undone together.
  -- Session lines keep the session's day, as when they are ticked on the session screen.
  update transactions
     set occurred_on = (t.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date,
         batch_id = r.id,
         description = 'Chuyển khoản ' || r.code,
         updated_at = now()
   where source_type = 'membership_fee' and source_id = any(fee_ids);
  update transactions
     set description = 'Chuyển khoản ' || r.code, updated_at = now()
   where source_type = 'attendance' and source_id = any(attendance_ids);

  result := case when t.amount > r.amount then 'overpaid' else 'matched' end;
  update payment_requests set status = 'paid', received_amount = t.amount, paid_at = now() where id = r.id;
  update bank_transactions set status = result, club_id = r.club_id, request_id = r.id where id = t.id;
  return result;
end;
$$;
revoke execute on function confirm_payment_request(uuid, uuid) from public, anon, authenticated;
