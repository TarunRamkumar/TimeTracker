alter table public.projects
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz;

alter table public.projects
  drop constraint if exists projects_date_range_check;

alter table public.projects
  add constraint projects_date_range_check check (
    start_date is null
    or end_date is null
    or end_date >= start_date
  );

alter table public.time_blocks
  add column if not exists project_id text references public.projects(id) on delete set null,
  add column if not exists project_boundary_type text;

alter table public.time_blocks
  drop constraint if exists time_blocks_project_boundary_type_check;

alter table public.time_blocks
  add constraint time_blocks_project_boundary_type_check check (
    project_boundary_type is null
    or project_boundary_type in ('start', 'end')
  );

alter table public.time_blocks
  drop constraint if exists time_blocks_project_boundary_requires_project_check;

alter table public.time_blocks
  add constraint time_blocks_project_boundary_requires_project_check check (
    project_boundary_type is null
    or project_id is not null
  );

create index if not exists projects_start_date_idx on public.projects (start_date);
create index if not exists projects_end_date_idx on public.projects (end_date);
create index if not exists time_blocks_project_id_idx on public.time_blocks (project_id);

create unique index if not exists time_blocks_project_boundary_unique_idx
  on public.time_blocks (project_id, project_boundary_type)
  where project_id is not null and project_boundary_type is not null;
