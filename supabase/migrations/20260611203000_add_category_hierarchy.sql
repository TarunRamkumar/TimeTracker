alter table public.categories
  add column if not exists parent_category_id text references public.categories(id) on delete set null;

create index if not exists categories_parent_category_id_idx
  on public.categories (parent_category_id);
