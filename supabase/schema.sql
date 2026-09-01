-- The Interior — Supabase schema (issue #8, 0.1)
-- Run once: Supabase Dashboard → SQL Editor → paste → Run.

create table public.entries (
  id text primary key,
  n integer,
  title text not null default '',
  category text,
  date text,
  note text,
  image text,                               -- reserved: covers (#11) / photos (#37)
  favourite boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  extra jsonb not null default '{}'::jsonb, -- round-trips any future top-level fields
  owner uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "owner reads"   on public.entries for select using (owner = auth.uid());
create policy "owner inserts" on public.entries for insert with check (owner = auth.uid());
create policy "owner updates" on public.entries for update
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner deletes" on public.entries for delete using (owner = auth.uid());

create or replace function public.touch_updated_at() returns trigger
language plpgsql security definer set search_path = public as
$$ begin new.updated_at = now(); return new; end $$;

create trigger entries_touch before update on public.entries
for each row execute function public.touch_updated_at();

-- Storage bucket for photos (5.1) — created now so images are purely additive later.
insert into storage.buckets (id, name, public) values ('images', 'images', false);

create policy "auth storage read"   on storage.objects for select
  using (bucket_id = 'images' and auth.role() = 'authenticated');
create policy "auth storage insert" on storage.objects for insert
  with check (bucket_id = 'images' and auth.role() = 'authenticated');
create policy "auth storage update" on storage.objects for update
  using (bucket_id = 'images' and auth.role() = 'authenticated');
create policy "auth storage delete" on storage.objects for delete
  using (bucket_id = 'images' and auth.role() = 'authenticated');
