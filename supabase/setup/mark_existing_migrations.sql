-- Run once in Supabase (SQL Editor, paste, Run) before the first automatic run of
-- .github/workflows/supabase-migrations.yml.
-- 0001 to 0004 were run by hand. This records them as done, so the workflow does not run them again.
-- Same table and columns the Supabase CLI uses for its migration list. Running it again does nothing new.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0001', 'init'),
  ('0002', 'schedule_generated_until'),
  ('0003', 'courts'),
  ('0004', 'session_courts')
on conflict (version) do nothing;
-- Not exposed through the API (outside the public schema). RLS on anyway; the CLI connects as the
-- table owner, which RLS does not restrict.
alter table supabase_migrations.schema_migrations enable row level security;
