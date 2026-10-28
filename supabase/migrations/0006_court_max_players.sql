-- SAN-1: how many players the court holds. Shown for reference only; nothing is limited by it.
alter table courts add column if not exists max_players integer check (max_players > 0);
