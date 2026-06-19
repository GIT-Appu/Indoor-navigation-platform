-- Campus Navigator — Supabase schema. Run in the Supabase SQL editor.

-- 1. Organizations (tenants)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 2. Profiles link auth users to an organization
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete set null,
  email text,
  role text default 'admin',
  created_at timestamptz default now()
);

-- 3. Campuses
create table if not exists campuses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- 4. Buildings
create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid references campuses(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- 5. Floors
create table if not exists floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete cascade,
  name text not null,
  level int default 0,
  floor_plan_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 6. Nodes (rooms, corridors, stairs, lifts, entrances, POIs)
create table if not exists nodes (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid references floors(id) on delete cascade,
  type text not null default 'room',
  label text,
  x double precision not null,
  y double precision not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 7. Edges (walkable connections; treated as bidirectional)
create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  from_node_id uuid references nodes(id) on delete cascade,
  to_node_id uuid references nodes(id) on delete cascade,
  weight double precision default 1,
  created_at timestamptz default now()
);

-- Performance indices
create index if not exists idx_profiles_org_id on profiles(org_id);
create index if not exists idx_campuses_org_id on campuses(org_id);
create index if not exists idx_buildings_campus_id on buildings(campus_id);
create index if not exists idx_floors_building_id on floors(building_id);
create index if not exists idx_nodes_floor_id on nodes(floor_id);
create index if not exists idx_edges_from_node_id on edges(from_node_id);
create index if not exists idx_edges_to_node_id on edges(to_node_id);

-- Helper: the current user's organization id
create or replace function current_org_id()
returns uuid language sql security definer stable set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- Auto-create an organization + profile when a user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org uuid;
begin
  insert into public.organizations (name)
  values (coalesce(new.email, 'New organization'))
  returning id into new_org;

  insert into public.profiles (id, org_id, email)
  values (new.id, new_org, new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-stamp org_id on new campuses (and auto-provision profile/org if missing)
create or replace function set_campus_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  user_org uuid;
begin
  -- Get the organization ID for the current user
  select org_id into user_org from public.profiles where id = auth.uid();
  
  -- If the profile or organization does not exist, create it on the fly!
  if user_org is null then
    -- Check if a profile exists at all
    if not exists (select 1 from public.profiles where id = auth.uid()) then
      -- Create organization
      insert into public.organizations (name)
      values (coalesce(auth.jwt() ->> 'email', 'New organization'))
      returning id into user_org;
      
      -- Create profile
      insert into public.profiles (id, org_id, email)
      values (auth.uid(), user_org, auth.jwt() ->> 'email');
    else
      -- Profile exists but org_id is null, create organization and link it
      insert into public.organizations (name)
      values (coalesce(auth.jwt() ->> 'email', 'New organization'))
      returning id into user_org;
      
      update public.profiles
      set org_id = user_org
      where id = auth.uid();
    end if;
  end if;

  if new.org_id is null then
    new.org_id := user_org;
  end if;
  return new;
end;
$$;

drop trigger if exists campuses_set_org on campuses;
create trigger campuses_set_org
  before insert on campuses
  for each row execute function set_campus_org();

-- Row Level Security (multi-tenant isolation)
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table campuses enable row level security;
alter table buildings enable row level security;
alter table floors enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;

-- Policies
create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own org" on organizations
  for all using (id = current_org_id()) with check (id = current_org_id());

-- Campuses
create policy "public select campuses" on campuses
  for select using (true);
create policy "org write campuses" on campuses
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Buildings
create policy "public select buildings" on buildings
  for select using (true);
create policy "org write buildings" on buildings
  for all
  using (campus_id in (select id from campuses where org_id = current_org_id()))
  with check (campus_id in (select id from campuses where org_id = current_org_id()));

-- Floors
create policy "public select floors" on floors
  for select using (true);
create policy "org write floors" on floors
  for all
  using (building_id in (
    select b.id from buildings b
    join campuses c on b.campus_id = c.id
    where c.org_id = current_org_id()
  ))
  with check (building_id in (
    select b.id from buildings b
    join campuses c on b.campus_id = c.id
    where c.org_id = current_org_id()
  ));

-- Nodes
create policy "public select nodes" on nodes
  for select using (true);
create policy "org write nodes" on nodes
  for all
  using (floor_id in (
    select f.id from floors f
    join buildings b on f.building_id = b.id
    join campuses c on b.campus_id = c.id
    where c.org_id = current_org_id()
  ))
  with check (floor_id in (
    select f.id from floors f
    join buildings b on f.building_id = b.id
    join campuses c on b.campus_id = c.id
    where c.org_id = current_org_id()
  ));

-- Edges
create policy "public select edges" on edges
  for select using (true);
create policy "org write edges" on edges
  for all
  using (from_node_id in (
    select n.id from nodes n
    join floors f on n.floor_id = f.id
    join buildings b on f.building_id = b.id
    join campuses c on b.campus_id = c.id
    where c.org_id = current_org_id()
  ))
  with check (from_node_id in (
    select n.id from nodes n
    join floors f on n.floor_id = f.id
    join buildings b on f.building_id = b.id
    join campuses c on b.campus_id = c.id
    where c.org_id = current_org_id()
  ));
