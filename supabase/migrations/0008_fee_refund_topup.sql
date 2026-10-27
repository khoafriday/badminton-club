-- PHI: money already received for a month before its fee went up. amount_due is then only the difference still owed.
alter table membership_fees add column if not exists prepaid_amount bigint not null default 0 check (prepaid_amount >= 0);

-- Expense written by the app when a member who paid ahead stops (Nghỉ): the months after are paid back.
insert into transaction_categories (club_id, type, code, is_system)
select null, 'expense', 'fee_refund', true
where not exists (select 1 from transaction_categories where code = 'fee_refund' and club_id is null);
