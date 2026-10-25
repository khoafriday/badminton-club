-- Remembers how far each weekly schedule has already created sessions, so a session the admin
-- deleted (LICH-7) is not created again the next time the app fills the coming weeks (LICH-2).
-- Run once in Supabase: SQL Editor, paste this file, Run.
alter table session_schedules add column if not exists generated_until date;
