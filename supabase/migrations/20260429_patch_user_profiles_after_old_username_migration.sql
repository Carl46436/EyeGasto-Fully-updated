alter table public.user_profiles
  add column if not exists full_name text;

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

  insert into public.user_profiles (
    user_id,
    username,
    email,
    full_name,
    created_at,
    updated_at
  )
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

insert into public.user_profiles (
  user_id,
  username,
  email,
  full_name,
  created_at,
  updated_at
)
select
  users.id,
  public.build_login_username(
    users.raw_user_meta_data->>'username',
    users.email,
    users.id
  ) as username,
  coalesce(users.email, '') as email,
  coalesce(
    nullif(trim(users.raw_user_meta_data->>'name'), ''),
    coalesce(users.email, '')
  ) as full_name,
  coalesce(users.created_at, timezone('utc', now())) as created_at,
  timezone('utc', now()) as updated_at
from auth.users as users
on conflict (user_id) do update
set
  username = excluded.username,
  email = excluded.email,
  full_name = excluded.full_name,
  updated_at = timezone('utc', now());

update public.user_profiles
set full_name = coalesce(
  nullif(trim(full_name), ''),
  email
)
where full_name is null
   or trim(full_name) = '';

alter table public.user_profiles
  alter column full_name set not null;
