-- TV-5: a fixed member switched from Nghỉ back to Đang chơi keeps their first fixed_since (history);
-- the return day is kept here, and billing starts over from it (mid-month return: per session that month).
alter table members add column if not exists rejoined_on date;
