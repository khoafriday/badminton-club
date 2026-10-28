-- QUY-1: the Phí tháng lines written by one "Thu tiền sân" share a batch id, so the whole payment can be undone at once.
alter table transactions add column if not exists batch_id uuid;
create index if not exists transactions_batch_idx on transactions (batch_id) where batch_id is not null;
