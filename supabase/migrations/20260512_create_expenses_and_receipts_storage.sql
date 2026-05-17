create extension if not exists pgcrypto with schema extensions;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null check (btrim(description) <> ''),
  amount numeric(12, 2) not null check (amount > 0),
  date timestamptz not null default timezone('utc', now()),
  category text,
  notes text,
  image_url text,
  receipt_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists expenses_user_id_idx
  on public.expenses (user_id);

create index if not exists expenses_user_id_date_idx
  on public.expenses (user_id, date desc);

create index if not exists expenses_user_id_category_idx
  on public.expenses (user_id, lower(category))
  where category is not null;

create or replace function public.set_current_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_expenses_updated_at on public.expenses;

create trigger set_expenses_updated_at
before update on public.expenses
for each row
execute function public.set_current_updated_at();

alter table public.expenses enable row level security;

drop policy if exists "Users can select their expenses"
  on public.expenses;
drop policy if exists "Users can insert their expenses"
  on public.expenses;
drop policy if exists "Users can update their expenses"
  on public.expenses;
drop policy if exists "Users can delete their expenses"
  on public.expenses;

create policy "Users can select their expenses"
  on public.expenses
  for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their expenses"
  on public.expenses
  for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their expenses"
  on public.expenses
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their expenses"
  on public.expenses
  for delete
  using ((select auth.uid()) = user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'receipts',
  'receipts',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their receipt files"
  on storage.objects;
drop policy if exists "Users can update their receipt files"
  on storage.objects;
drop policy if exists "Users can delete their receipt files"
  on storage.objects;
drop policy if exists "Anyone can read public receipt files"
  on storage.objects;

create policy "Anyone can read public receipt files"
  on storage.objects
  for select
  using (bucket_id = 'receipts');

create policy "Users can upload their receipt files"
  on storage.objects
  for insert
  with check (
    bucket_id = 'receipts'
    and (
      name like 'all-receipts/' || (select auth.uid())::text || '-%'
      or name like 'avatars/' || (select auth.uid())::text || '-%'
    )
  );

create policy "Users can update their receipt files"
  on storage.objects
  for update
  using (
    bucket_id = 'receipts'
    and (
      name like 'all-receipts/' || (select auth.uid())::text || '-%'
      or name like 'avatars/' || (select auth.uid())::text || '-%'
    )
  )
  with check (
    bucket_id = 'receipts'
    and (
      name like 'all-receipts/' || (select auth.uid())::text || '-%'
      or name like 'avatars/' || (select auth.uid())::text || '-%'
    )
  );

create policy "Users can delete their receipt files"
  on storage.objects
  for delete
  using (
    bucket_id = 'receipts'
    and (
      name like 'all-receipts/' || (select auth.uid())::text || '-%'
      or name like 'avatars/' || (select auth.uid())::text || '-%'
    )
  );
