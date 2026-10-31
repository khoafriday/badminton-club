-- TV-1: a nickname (biệt danh) set on the member's edit screen, shown next to the name when adding someone
-- already in the app to another club. Copied to the new member row along with the name, gender and phone.
alter table members add column if not exists nickname text;
