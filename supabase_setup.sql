begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.societies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'General',
  password text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  cms_id text unique,
  section text not null default '',
  role text not null default 'student' check (role in ('student', 'organizer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('workshop', 'concert', 'competition', 'seminar')),
  society_id uuid not null references public.societies(id) on delete restrict,
  date text not null,
  venue text not null,
  capacity integer not null check (capacity > 0),
  description text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'delayed', 'expected')),
  registration_url text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, student_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  feedback text not null default '',
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, student_id)
);

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_events_set_updated_at on public.events;
create trigger trg_events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists trg_reviews_set_updated_at on public.reviews;
create trigger trg_reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

alter table public.societies enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.reviews enable row level security;

drop policy if exists societies_select_all on public.societies;
create policy societies_select_all
on public.societies
for select
using (true);

drop policy if exists events_select_all on public.events;
create policy events_select_all
on public.events
for select
using (true);

-- Demo policy for your current organizer flow (organizer auth is not wired yet).
drop policy if exists events_insert_all_demo on public.events;
create policy events_insert_all_demo
on public.events
for insert
with check (true);

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
on public.profiles
for select
using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists registrations_select_all on public.registrations;
create policy registrations_select_all
on public.registrations
for select
using (true);

drop policy if exists registrations_insert_own on public.registrations;
create policy registrations_insert_own
on public.registrations
for insert
to authenticated
with check (auth.uid() = student_id);

drop policy if exists registrations_delete_own on public.registrations;
create policy registrations_delete_own
on public.registrations
for delete
to authenticated
using (auth.uid() = student_id);

drop policy if exists reviews_select_all on public.reviews;
create policy reviews_select_all
on public.reviews
for select
using (true);

drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own
on public.reviews
for insert
to authenticated
with check (auth.uid() = student_id);

drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own
on public.reviews
for update
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own
on public.reviews
for delete
to authenticated
using (auth.uid() = student_id);

grant usage on schema public to anon, authenticated;
grant select on public.societies, public.events, public.profiles, public.registrations, public.reviews to anon, authenticated;
grant insert on public.events to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, delete on public.registrations to authenticated;
grant insert, update, delete on public.reviews to authenticated;

insert into public.societies (name, category, password)
values
  ('NUST Music Society', 'Cultural', 'nms123'),
  ('RIC', 'Fundraiser', 'ric123'),
  ('NEC', 'Technical', 'nec123'),
  ('ACM', 'Technical', 'acm123'),
  ('Vyro.ai', 'Technical', 'vyro123'),
  ('IEEE', 'Technical', 'ieee123'),
  ('SOULS', 'Cultural', 'souls123'),
  ('AND', 'Technical', 'and123')
on conflict (name) do nothing;

insert into public.events (title, type, society_id, date, venue, capacity, description, status, registration_url, details)
select
  'NUST Music Fest (NMF)',
  'concert',
  s.id,
  'DELAYED - Originally 21-22 Apr 2026',
  'NUST Amphitheatre',
  500,
  'NUST annual music festival. Currently delayed.',
  'delayed',
  '',
  '{"performer":"Various Artists","genre":"Live Music / Multi-Genre"}'::jsonb
from public.societies s
where s.name = 'NUST Music Society'
and not exists (
  select 1 from public.events e
  where e.title = 'NUST Music Fest (NMF)' and e.society_id = s.id
);

insert into public.events (title, type, society_id, date, venue, capacity, description, status, registration_url, details)
select
  'HAAMI 2026',
  'concert',
  s.id,
  'DELAYED - Originally 2-3 Apr 2026',
  'NUST Main Campus',
  1000,
  'Fundraiser with Hassan Raheem. Postponed.',
  'delayed',
  '',
  '{"performer":"Hassan Raheem","genre":"Pop / R&B"}'::jsonb
from public.societies s
where s.name = 'RIC'
and not exists (
  select 1 from public.events e
  where e.title = 'HAAMI 2026' and e.society_id = s.id
);

insert into public.events (title, type, society_id, date, venue, capacity, description, status, registration_url, details)
select
  'AIcon 2026',
  'competition',
  s.id,
  'Expected: End of April 2026',
  'SEECS, NUST',
  150,
  'AI-focused hackathon.',
  'expected',
  '',
  '{"prizePool":"TBA","teamSize":3}'::jsonb
from public.societies s
where s.name = 'NEC'
and not exists (
  select 1 from public.events e
  where e.title = 'AIcon 2026' and e.society_id = s.id
);

insert into public.events (title, type, society_id, date, venue, capacity, description, status, registration_url, details)
select
  'VYROTHON 2026',
  'competition',
  s.id,
  '18-Apr-2026',
  'Vyro Office, NSTP NUST H-12',
  100,
  'In-house hackathon with around $5000 prize pool.',
  'scheduled',
  'https://vyrothon.vyro.ai/',
  '{"prizePool":"~$5,000 USD","teamSize":3}'::jsonb
from public.societies s
where s.name = 'Vyro.ai'
and not exists (
  select 1 from public.events e
  where e.title = 'VYROTHON 2026' and e.society_id = s.id
);

commit;
