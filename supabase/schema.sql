-- Daymark / Daily Routine & Student Task Tracker
-- Run in the Supabase SQL editor after enabling email or OAuth auth.

create extension if not exists "uuid-ossp";

create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule (
  id uuid primary key default uuid_generate_v4(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  user_id uuid not null references auth.users(id) on delete cascade,
  unique(subject_id, day_of_week)
);

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  is_completed boolean not null default false,
  due_date date,
  recurring_days integer[] not null default '{}',
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.library_books (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  author text,
  issued_on date,
  return_by date,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists subjects_user_id_idx on public.subjects(user_id);
create index if not exists schedule_user_id_idx on public.schedule(user_id);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);
create index if not exists library_books_user_idx on public.library_books(user_id);

alter table public.subjects enable row level security;
alter table public.schedule enable row level security;
alter table public.tasks enable row level security;
alter table public.library_books enable row level security;

drop policy if exists "subjects are private" on public.subjects;
create policy "subjects are private" on public.subjects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "schedule is private" on public.schedule;
create policy "schedule is private" on public.schedule for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks are private" on public.tasks;
create policy "tasks are private" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "library books are private" on public.library_books;
create policy "library books are private" on public.library_books for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Smart due-date reference function.
-- Pass a subject and date; returns today if it is a class day, otherwise the next class date.
create or replace function public.next_subject_due_date(
  p_subject_id uuid,
  p_from_date date default current_date
) returns date
language sql
stable
as $$
  with days as (
    select day_of_week
    from public.schedule
    where subject_id = p_subject_id and user_id = auth.uid()
  ), offsets as (
    select generate_series(0, 7) as offset
  )
  select (p_from_date + offsets.offset)::date
  from offsets
  join days on extract(dow from (p_from_date + offsets.offset)::date) = days.day_of_week
  order by offsets.offset
  limit 1;
$$;