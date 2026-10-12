alter table public.categories
  add column if not exists parent_category_ids text[] not null default '{}'::text[];

update public.categories
set parent_category_ids = case
  when parent_category_id is null then '{}'::text[]
  else array[parent_category_id]
end
where coalesce(array_length(parent_category_ids, 1), 0) = 0;

drop index if exists categories_parent_category_id_idx;

create index if not exists categories_parent_category_ids_idx
  on public.categories using gin (parent_category_ids);

alter table public.categories
  drop column if exists parent_category_id;
