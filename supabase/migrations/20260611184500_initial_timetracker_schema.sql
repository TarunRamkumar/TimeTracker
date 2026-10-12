create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.categories (
  id text primary key,
  name text not null,
  description text,
  color text not null,
  icon text not null,
  active boolean not null default true,
  hourly_rate numeric(10, 2),
  currency text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint categories_hourly_rate_check check (hourly_rate is null or hourly_rate >= 0)
);

create table if not exists public.tags (
  id text primary key,
  name text not null unique,
  color text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text not null default '',
  status text not null default 'active',
  category_id text not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_status_check check (status in ('active', 'archived', 'completed'))
);

create table if not exists public.tasks (
  id text primary key,
  title text not null,
  description text not null default '',
  status text not null default 'inbox',
  priority text not null default 'medium',
  project_id text references public.projects(id) on delete set null,
  category_id text not null references public.categories(id) on delete restrict,
  due_date timestamptz,
  estimated_minutes integer,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_minutes integer not null default 0,
  calendar_block_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tasks_status_check check (status in ('inbox', 'next', 'doing', 'waiting', 'done')),
  constraint tasks_priority_check check (priority in ('low', 'medium', 'high')),
  constraint tasks_actual_minutes_check check (actual_minutes >= 0),
  constraint tasks_estimated_minutes_check check (estimated_minutes is null or estimated_minutes >= 0),
  constraint tasks_schedule_range_check check (
    scheduled_start is null
    or scheduled_end is null
    or scheduled_end > scheduled_start
  )
);

create table if not exists public.time_blocks (
  id text primary key,
  title text not null,
  description text not null default '',
  category_id text not null references public.categories(id) on delete restrict,
  task_id text references public.tasks(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  planned_minutes integer not null default 0,
  actual_minutes integer not null default 0,
  source text not null default 'manual',
  status text not null default 'scheduled',
  recurrence_frequency text,
  recurrence_days_of_week smallint[],
  recurrence_end_type text,
  recurrence_until timestamptz,
  recurrence_count integer,
  recurrence_exclusion_dates timestamptz[],
  recurrence_series_id text,
  recurrence_index integer,
  google_event_id text,
  calendar_id text,
  hourly_rate numeric(10, 2),
  currency text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint time_blocks_range_check check (end_at > start_at),
  constraint time_blocks_planned_minutes_check check (planned_minutes >= 0),
  constraint time_blocks_actual_minutes_check check (actual_minutes >= 0),
  constraint time_blocks_source_check check (source in ('manual', 'google-calendar', 'task', 'pomodoro')),
  constraint time_blocks_status_check check (status in ('scheduled', 'in-progress', 'completed', 'cancelled')),
  constraint time_blocks_recurrence_frequency_check check (
    recurrence_frequency is null
    or recurrence_frequency in ('weekly')
  ),
  constraint time_blocks_recurrence_end_type_check check (
    recurrence_end_type is null
    or recurrence_end_type in ('onDate', 'afterOccurrences')
  ),
  constraint time_blocks_hourly_rate_check check (hourly_rate is null or hourly_rate >= 0)
);

alter table public.tasks
  add constraint tasks_calendar_block_id_fkey
  foreign key (calendar_block_id)
  references public.time_blocks(id)
  on delete set null
  deferrable initially deferred;

create table if not exists public.task_tags (
  task_id text not null references public.tasks(id) on delete cascade,
  tag_id text not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (task_id, tag_id)
);

create table if not exists public.time_block_tags (
  time_block_id text not null references public.time_blocks(id) on delete cascade,
  tag_id text not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (time_block_id, tag_id)
);

create table if not exists public.timer_sessions (
  id text primary key,
  task_id text references public.tasks(id) on delete set null,
  category_id text not null references public.categories(id) on delete restrict,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_minutes integer not null default 0,
  pomodoro_mode boolean not null default false,
  source text not null default 'web',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint timer_sessions_duration_minutes_check check (duration_minutes >= 0),
  constraint timer_sessions_source_check check (source in ('web', 'extension')),
  constraint timer_sessions_time_range_check check (end_time is null or end_time >= start_time)
);

create table if not exists public.task_progress_entries (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  time_block_id text references public.time_blocks(id) on delete set null,
  timer_session_id text references public.timer_sessions(id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer not null default 0,
  note text not null default '',
  source text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint task_progress_entries_duration_minutes_check check (duration_minutes >= 0),
  constraint task_progress_entries_source_check check (source in ('timer', 'manual', 'block-note')),
  constraint task_progress_entries_time_range_check check (
    started_at is null
    or ended_at is null
    or ended_at >= started_at
  )
);

create table if not exists public.time_block_notes (
  id text primary key,
  time_block_id text not null references public.time_blocks(id) on delete cascade,
  content text not null,
  duration_minutes integer not null default 0,
  kind text not null default 'recap',
  task_progress_entry_id text references public.task_progress_entries(id) on delete set null,
  timer_session_id text references public.timer_sessions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint time_block_notes_duration_minutes_check check (duration_minutes >= 0),
  constraint time_block_notes_kind_check check (kind in ('work-note', 'recap'))
);

create table if not exists public.integration_accounts (
  id text primary key,
  provider text not null unique,
  status text not null default 'disconnected',
  external_account_id text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint integration_accounts_provider_check check (
    provider in ('google-calendar', 'notion', 'clockify')
  ),
  constraint integration_accounts_status_check check (
    status in ('connected', 'disconnected', 'error', 'syncing')
  )
);

create index if not exists projects_category_id_idx on public.projects (category_id);
create index if not exists tasks_category_id_idx on public.tasks (category_id);
create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_calendar_block_id_idx on public.tasks (calendar_block_id);
create index if not exists time_blocks_task_id_idx on public.time_blocks (task_id);
create index if not exists time_blocks_category_id_idx on public.time_blocks (category_id);
create index if not exists time_blocks_start_at_idx on public.time_blocks (start_at);
create unique index if not exists time_blocks_google_event_id_idx
  on public.time_blocks (google_event_id)
  where google_event_id is not null;
create index if not exists timer_sessions_task_id_idx on public.timer_sessions (task_id);
create index if not exists timer_sessions_start_time_idx on public.timer_sessions (start_time desc);
create index if not exists task_progress_entries_task_id_idx on public.task_progress_entries (task_id);
create index if not exists task_progress_entries_time_block_id_idx
  on public.task_progress_entries (time_block_id);
create index if not exists time_block_notes_time_block_id_idx on public.time_block_notes (time_block_id);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
before update on public.tags
for each row
execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists time_blocks_set_updated_at on public.time_blocks;
create trigger time_blocks_set_updated_at
before update on public.time_blocks
for each row
execute function public.set_updated_at();

drop trigger if exists timer_sessions_set_updated_at on public.timer_sessions;
create trigger timer_sessions_set_updated_at
before update on public.timer_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists task_progress_entries_set_updated_at on public.task_progress_entries;
create trigger task_progress_entries_set_updated_at
before update on public.task_progress_entries
for each row
execute function public.set_updated_at();

drop trigger if exists time_block_notes_set_updated_at on public.time_block_notes;
create trigger time_block_notes_set_updated_at
before update on public.time_block_notes
for each row
execute function public.set_updated_at();

drop trigger if exists integration_accounts_set_updated_at on public.integration_accounts;
create trigger integration_accounts_set_updated_at
before update on public.integration_accounts
for each row
execute function public.set_updated_at();

insert into public.categories (id, name, description, color, icon, active, hourly_rate, currency)
values
  ('cat-work', 'Work', null, '#3B82F6', 'briefcase', true, null, null),
  ('cat-sports', 'Sports', null, '#10B981', 'activity', true, null, null),
  ('cat-internship', 'Internship', null, '#8B5CF6', 'book-open', true, 25, 'USD'),
  ('cat-study', 'Study', null, '#F59E0B', 'book', true, null, null),
  ('cat-personal', 'Personal', null, '#F97316', 'heart', true, null, null),
  ('cat-social', 'Social', null, '#EC4899', 'users', true, null, null)
on conflict (id) do nothing;

insert into public.tags (id, name, color)
values
  ('tag-urgent', 'Urgent', '#EF4444'),
  ('tag-meeting', 'Meeting', '#3B82F6'),
  ('tag-review', 'Review', '#8B5CF6'),
  ('tag-bug', 'Bug', '#F97316'),
  ('tag-feature', 'Feature', '#10B981'),
  ('tag-documentation', 'Documentation', '#6366F1')
on conflict (id) do nothing;

insert into public.projects (id, name, description, status, category_id)
values
  ('proj-website', 'Website Redesign', 'Q2 website modernization', 'active', 'cat-work'),
  ('proj-api', 'API Integration', 'Third-party API integrations', 'active', 'cat-work'),
  ('proj-ml', 'ML Research', 'Research project at internship', 'active', 'cat-internship'),
  ('proj-fitness', 'Fitness Goals', 'Personal fitness tracking', 'active', 'cat-personal')
on conflict (id) do nothing;

insert into public.integration_accounts (id, provider, status, external_account_id, last_synced_at)
values
  (
    'integration-google-calendar',
    'google-calendar',
    'connected',
    'google-account-primary',
    timezone('utc', now())
  ),
  (
    'integration-notion',
    'notion',
    'disconnected',
    'notion-workspace-sandbox',
    null
  ),
  (
    'integration-clockify',
    'clockify',
    'disconnected',
    'clockify-workspace-sandbox',
    null
  )
on conflict (id) do nothing;
