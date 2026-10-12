alter table public.time_blocks
  add column if not exists parent_block_id text;

alter table public.time_blocks
  drop constraint if exists time_blocks_parent_block_id_fkey;

alter table public.time_blocks
  add constraint time_blocks_parent_block_id_fkey
  foreign key (parent_block_id)
  references public.time_blocks(id)
  on delete cascade
  deferrable initially deferred;

alter table public.time_blocks
  drop constraint if exists time_blocks_parent_block_self_check;

alter table public.time_blocks
  add constraint time_blocks_parent_block_self_check check (
    parent_block_id is null
    or parent_block_id <> id
  );

create index if not exists time_blocks_parent_block_id_idx
  on public.time_blocks (parent_block_id);
