-- SAN-1: weekly slots and sessions pick their court from the courts list instead of typing a name.
-- court_id null means "the club's court". The typed venue_name is copied into the courts list,
-- and the column is kept so the app version already deployed keeps working until this one is merged.
-- Run once in Supabase: SQL Editor, paste this file, Run. Running it again does nothing new.

alter table session_schedules add column if not exists court_id uuid references courts(id) on delete restrict;
alter table sessions add column if not exists court_id uuid references courts(id) on delete restrict;
create index if not exists session_schedules_court_idx on session_schedules (court_id);
create index if not exists sessions_court_idx on sessions (court_id);

do $$
declare
  t record;
  court uuid;
begin
  for t in
    select distinct c.owner_id, trim(x.venue_name) as name
    from (
      select club_id, venue_name from session_schedules where court_id is null
      union all
      select club_id, venue_name from sessions where court_id is null
    ) x
    join clubs c on c.id = x.club_id
    where nullif(trim(x.venue_name), '') is not null
  loop
    select id into court from courts where owner_id = t.owner_id and name = t.name order by created_at limit 1;
    if court is null then
      insert into courts (owner_id, name) values (t.owner_id, t.name) returning id into court;
    end if;
    update session_schedules s set court_id = court
    from clubs c
    where c.id = s.club_id and c.owner_id = t.owner_id and s.court_id is null and trim(s.venue_name) = t.name;
    update sessions s set court_id = court
    from clubs c
    where c.id = s.club_id and c.owner_id = t.owner_id and s.court_id is null and trim(s.venue_name) = t.name;
  end loop;
end $$;
