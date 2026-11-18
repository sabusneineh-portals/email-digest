-- Reference for a NEW project. Portal test already contains this schema.
begin;
create table public.allowed_users (
  email text primary key check (email = lower(email)),
  full_name text not null,
  role text not null check (role in ('admin','viewer'))
);
create table public.email_summaries (
  id bigint generated always as identity primary key,
  sender_name text not null,
  sender_email text not null,
  receiver_email text,
  gmail_message_id text check (gmail_message_id is null or gmail_message_id ~ '^[0-9a-f]{10,32}$'),
  subject text not null,
  received_at timestamptz not null,
  summary text not null check (char_length(summary) between 1 and 350),
  category text not null check (category in ('Request','Update','Meeting','Other')),
  priority text not null check (priority in ('High','Medium','Low')),
  action_needed boolean not null,
  created_at timestamptz not null default now()
);
alter table public.allowed_users enable row level security;
alter table public.email_summaries enable row level security;
revoke all on public.allowed_users, public.email_summaries from anon, authenticated;
grant select on public.allowed_users, public.email_summaries to authenticated;
-- A logged-in person can read only the row for their verified email.
create policy read_own_allowlist_entry on public.allowed_users
for select to authenticated
using (email = lower((select auth.jwt() ->> 'email')));
-- A logged-in person can read summaries only if their verified email is allowed.
create policy read_summaries_when_allowed on public.email_summaries
for select to authenticated
using (exists (select 1 from public.allowed_users where email = lower((select auth.jwt() ->> 'email'))));
insert into public.allowed_users (email, full_name, role) values
('s.abusneineh@xpandpros.com','Saja','viewer'),
('n.mahmoud@xpandpros.com','N. Mahmoud','admin'),
('malek@xpandpros.com','Malek','viewer'),
('m.ali@xpandpros.com','Mohammad Ali','viewer');
commit;
