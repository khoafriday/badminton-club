-- TK-7: Cài đặt > Tài khoản shows when each member login was last used. Null until the next login.
alter table accounts add column if not exists last_login_at timestamptz;
