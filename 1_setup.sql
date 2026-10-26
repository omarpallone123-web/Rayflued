-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- BEFORE running: replace VIEWER_PASSWORD and ADMIN_PASSWORD.
--   VIEWER_PASSWORD = people who can only VIEW/COPY files
--   ADMIN_PASSWORD  = you: can also UPLOAD and DELETE files
-- (Use two different long passwords, 16+ characters.)

drop table if exists public.vault_config;

create table public.vault_config (
  id int primary key default 1,
  viewer_hash text not null,
  admin_hash text not null
);

create table if not exists public.vault_fails (
  ip text primary key,
  fails int not null default 0,
  blocked_until timestamptz
);

-- Lock the tables: nobody from outside can read them.
alter table public.vault_config enable row level security;
alter table public.vault_fails enable row level security;
revoke all on public.vault_config from anon, authenticated;
revoke all on public.vault_fails from anon, authenticated;

insert into public.vault_config (id, viewer_hash, admin_hash)
values (
  1,
  encode(extensions.digest('VIEWER_PASSWORD', 'sha256'), 'hex'),
  encode(extensions.digest('ADMIN_PASSWORD', 'sha256'), 'hex')
);

-- Private storage bucket for your files (not public).
insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do nothing;
