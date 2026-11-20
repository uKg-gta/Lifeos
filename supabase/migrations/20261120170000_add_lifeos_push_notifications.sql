create table if not exists public.lifeos_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists lifeos_push_subscriptions_user_id_idx on public.lifeos_push_subscriptions(user_id);
alter table public.lifeos_push_subscriptions enable row level security;
drop policy if exists "Users manage their own push subscriptions" on public.lifeos_push_subscriptions;
create policy "Users manage their own push subscriptions" on public.lifeos_push_subscriptions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.lifeos_push_subscriptions to authenticated;

create table if not exists public.lifeos_push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  categories jsonb not null default '{"tasks":true,"study":true,"habits":true,"exams":true}'::jsonb,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz not null default now(),
  constraint lifeos_push_categories_object check (jsonb_typeof(categories) = 'object')
);
alter table public.lifeos_push_preferences enable row level security;
drop policy if exists "Users manage their own push preferences" on public.lifeos_push_preferences;
create policy "Users manage their own push preferences" on public.lifeos_push_preferences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.lifeos_push_preferences to authenticated;

create table if not exists public.lifeos_push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('tasks','study','habits','exams')),
  reminder_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, category, reminder_key)
);
alter table public.lifeos_push_delivery_log enable row level security;
revoke all on public.lifeos_push_delivery_log from anon, authenticated;
grant all on public.lifeos_push_delivery_log to service_role;
