-- Create saved_analyses table
-- Links authenticated users to events they have saved to their account history.
-- Existing events remain publicly readable; ownership is only through this join table.

create table public.saved_analyses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- Enable RLS
alter table public.saved_analyses enable row level security;

-- Policies: authenticated users can only touch their own rows
create policy "Users can read their own saved analyses"
  on public.saved_analyses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved analyses"
  on public.saved_analyses for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved analyses"
  on public.saved_analyses for delete
  using (auth.uid() = user_id);

-- Grant basic access to authenticated role
grant select, insert, delete on public.saved_analyses to authenticated;

-- Service role retains full access for backend administration
