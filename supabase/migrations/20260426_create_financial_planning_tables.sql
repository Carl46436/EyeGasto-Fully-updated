create table if not exists public.category_budgets (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  limit_amount numeric(12, 2) not null check (limit_amount >= 0),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.debt_items (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  due_date date not null,
  person text,
  note text,
  is_paid boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists category_budgets_user_id_idx
  on public.category_budgets (user_id);

create index if not exists category_budgets_user_id_category_idx
  on public.category_budgets (user_id, lower(category));

create index if not exists debt_items_user_id_idx
  on public.debt_items (user_id);

create index if not exists debt_items_user_id_due_date_idx
  on public.debt_items (user_id, due_date);

alter table public.category_budgets enable row level security;
alter table public.debt_items enable row level security;

drop policy if exists "Users can select their category budgets"
  on public.category_budgets;
drop policy if exists "Users can insert their category budgets"
  on public.category_budgets;
drop policy if exists "Users can update their category budgets"
  on public.category_budgets;
drop policy if exists "Users can delete their category budgets"
  on public.category_budgets;

create policy "Users can select their category budgets"
  on public.category_budgets
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their category budgets"
  on public.category_budgets
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their category budgets"
  on public.category_budgets
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their category budgets"
  on public.category_budgets
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can select their debt items"
  on public.debt_items;
drop policy if exists "Users can insert their debt items"
  on public.debt_items;
drop policy if exists "Users can update their debt items"
  on public.debt_items;
drop policy if exists "Users can delete their debt items"
  on public.debt_items;

create policy "Users can select their debt items"
  on public.debt_items
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their debt items"
  on public.debt_items
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their debt items"
  on public.debt_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their debt items"
  on public.debt_items
  for delete
  using (auth.uid() = user_id);

insert into public.category_budgets (id, user_id, category, limit_amount, note)
select
  budget_item->>'id' as id,
  users.id as user_id,
  budget_item->>'category' as category,
  coalesce(nullif(budget_item->>'limit', '')::numeric, 0) as limit_amount,
  nullif(budget_item->>'note', '') as note
from auth.users as users
cross join lateral jsonb_array_elements(
  coalesce(users.raw_user_meta_data->'categoryBudgets', '[]'::jsonb)
) as budget_item
where budget_item ? 'id'
  and budget_item ? 'category'
on conflict (id) do nothing;

insert into public.debt_items (
  id,
  user_id,
  title,
  amount,
  due_date,
  person,
  note,
  is_paid,
  created_at
)
select
  debt_item->>'id' as id,
  users.id as user_id,
  debt_item->>'title' as title,
  coalesce(nullif(debt_item->>'amount', '')::numeric, 0) as amount,
  coalesce(
    nullif(debt_item->>'dueDate', '')::date,
    timezone('utc', now())::date
  ) as due_date,
  nullif(debt_item->>'person', '') as person,
  nullif(debt_item->>'note', '') as note,
  coalesce((debt_item->>'isPaid')::boolean, false) as is_paid,
  coalesce(
    nullif(debt_item->>'createdAt', '')::timestamptz,
    timezone('utc', now())
  ) as created_at
from auth.users as users
cross join lateral jsonb_array_elements(
  coalesce(users.raw_user_meta_data->'debtItems', '[]'::jsonb)
) as debt_item
where debt_item ? 'id'
  and debt_item ? 'title'
on conflict (id) do nothing;
