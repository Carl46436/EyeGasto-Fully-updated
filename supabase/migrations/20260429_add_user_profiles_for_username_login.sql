create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  email text not null,
  full_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_profiles_username_format
    check (username ~ '^[a-z0-9_]{3,24}$')
);

alter table public.user_profiles
  add column if not exists full_name text;

create unique index if not exists user_profiles_username_lower_idx
  on public.user_profiles (lower(username));

create unique index if not exists user_profiles_email_lower_idx
  on public.user_profiles (lower(email));

alter table public.user_profiles enable row level security;

create or replace function public.build_login_username(
  requested_username text,
  fallback_email text,
  fallback_user_id uuid
)
returns text
language plpgsql
as $$
declare
  cleaned_requested text;
  cleaned_fallback text;
  fallback_suffix text;
  generated_username text;
begin
  cleaned_requested := lower(
    regexp_replace(coalesce(trim(requested_username), ''), '[^a-zA-Z0-9_]', '', 'g')
  );

  if length(cleaned_requested) between 3 and 24 then
    return cleaned_requested;
  end if;

  fallback_suffix := '_' || left(fallback_user_id::text, 6);
  cleaned_fallback := lower(
    regexp_replace(
      split_part(coalesce(fallback_email, ''), '@', 1),
      '[^a-zA-Z0-9_]',
      '',
      'g'
    )
  );

  if cleaned_fallback = '' then
    cleaned_fallback := 'user';
  end if;

  generated_username :=
    left(cleaned_fallback, greatest(1, 24 - length(fallback_suffix))) || fallback_suffix;

  if length(generated_username) < 3 then
    generated_username := 'user_' || left(fallback_user_id::text, 8);
  end if;

  return generated_username;
end;
$$;

drop policy if exists "Users can view their own profile lookup"
  on public.user_profiles;
drop policy if exists "Users can insert their own profile lookup"
  on public.user_profiles;
drop policy if exists "Users can update their own profile lookup"
  on public.user_profiles;

create policy "Users can view their own profile lookup"
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile lookup"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile lookup"
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.sync_user_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_username text;
begin
  normalized_username := public.build_login_username(
    new.raw_user_meta_data->>'username',
    new.email,
    new.id
  );

  insert into public.user_profiles (user_id, username, email, full_name, created_at, updated_at)
  values (
    new.id,
    normalized_username,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), coalesce(new.email, '')),
    coalesce(new.created_at, timezone('utc', now())),
    timezone('utc', now())
  )
  on conflict (user_id) do update
  set
    username = excluded.username,
    email = excluded.email,
    full_name = excluded.full_name,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;

create trigger on_auth_user_profile_sync
after insert or update of email, raw_user_meta_data
on auth.users
for each row
execute function public.sync_user_profile_from_auth();

insert into public.user_profiles (user_id, username, email, full_name, created_at, updated_at)
select
  users.id,
  public.build_login_username(
    users.raw_user_meta_data->>'username',
    users.email,
    users.id
  ) as username,
  coalesce(users.email, '') as email,
  coalesce(nullif(trim(users.raw_user_meta_data->>'name'), ''), coalesce(users.email, '')) as full_name,
  coalesce(users.created_at, timezone('utc', now())) as created_at,
  timezone('utc', now()) as updated_at
from auth.users as users
on conflict (user_id) do update
set
  username = excluded.username,
  email = excluded.email,
  full_name = excluded.full_name,
  updated_at = timezone('utc', now());

create or replace function public.resolve_login_email(login_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_identifier text;
  resolved_email text;
begin
  if login_identifier is null or btrim(login_identifier) = '' then
    return null;
  end if;

  if position('@' in login_identifier) > 0 then
    return lower(btrim(login_identifier));
  end if;

  normalized_identifier := lower(
    regexp_replace(btrim(login_identifier), '[^a-zA-Z0-9_]', '', 'g')
  );

  select email
  into resolved_email
  from public.user_profiles
  where lower(username) = normalized_identifier
  limit 1;

  return resolved_email;
end;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;
