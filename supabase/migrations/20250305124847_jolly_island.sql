/*
  # Initial Schema Setup for Emergency Response App

  1. Tables
    - users
      - Custom user data and preferences
    - contacts
      - Emergency contacts for each user
    - alerts
      - Emergency alerts with location and status
    - responders
      - Police and hospital staff accounts
    - responses
      - Response actions for alerts

  2. Security
    - RLS enabled on all tables
    - Policies for data access control
*/

-- Enable necessary extensions
create extension if not exists "postgis";

-- Create custom types
create type alert_type as enum ('police', 'medical', 'general');
create type alert_status as enum ('pending', 'acknowledged', 'responding', 'resolved');
create type responder_type as enum ('police', 'hospital');

-- Users table (extends auth.users)
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  phone_number text,
  medical_conditions text[],
  blood_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Emergency contacts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users on delete cascade,
  name text not null,
  relationship text,
  phone_number text not null,
  email text,
  is_primary boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Emergency responders (police/hospital staff)
create table if not exists public.responders (
  id uuid references auth.users on delete cascade primary key,
  organization_name text not null,
  responder_type responder_type not null,
  jurisdiction text,
  verification_status boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Emergency alerts
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users on delete cascade,
  type alert_type not null,
  status alert_status default 'pending',
  latitude double precision not null,
  longitude double precision not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Alert responses
create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references public.alerts on delete cascade,
  responder_id uuid references public.responders on delete cascade,
  action_taken text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.users enable row level security;
alter table public.contacts enable row level security;
alter table public.responders enable row level security;
alter table public.alerts enable row level security;
alter table public.responses enable row level security;

-- Policies

-- Users can read and update their own data
create policy "Users can read own data"
  on public.users
  for select
  using (auth.uid() = id);

create policy "Users can update own data"
  on public.users
  for update
  using (auth.uid() = id);

-- Contacts policies
create policy "Users can CRUD their contacts"
  on public.contacts
  for all
  using (auth.uid() = user_id);

-- Alerts policies
create policy "Users can create alerts"
  on public.alerts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view own alerts"
  on public.alerts
  for select
  using (auth.uid() = user_id);

create policy "Responders can view alerts"
  on public.alerts
  for select
  using (exists (
    select 1 from public.responders
    where responders.id = auth.uid()
    and verification_status = true
  ));

-- Responses policies
create policy "Responders can create responses"
  on public.responses
  for insert
  with check (exists (
    select 1 from public.responders
    where responders.id = auth.uid()
    and verification_status = true
  ));

create policy "Users can view responses to their alerts"
  on public.responses
  for select
  using (exists (
    select 1 from public.alerts
    where alerts.id = responses.alert_id
    and alerts.user_id = auth.uid()
  ));

-- Triggers for updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_users_updated_at
  before update on public.users
  for each row
  execute function update_updated_at();

create trigger update_contacts_updated_at
  before update on public.contacts
  for each row
  execute function update_updated_at();

create trigger update_responders_updated_at
  before update on public.responders
  for each row
  execute function update_updated_at();

create trigger update_alerts_updated_at
  before update on public.alerts
  for each row
  execute function update_updated_at();