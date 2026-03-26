-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- User profiles
create table public.user_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null unique,
  gender text not null,
  goal text not null,
  level text not null,
  days_per_week integer not null default 4,
  equipment text[] default '{}',
  age integer,
  weight_kg decimal(5,2),
  height_cm decimal(5,2),
  target_calories integer,
  target_protein integer,
  target_carbs integer,
  target_fat integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Workout plans
create table public.workout_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  plan jsonb not null,
  created_at timestamp with time zone default now()
);

-- Workout logs
create table public.workout_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  date date not null,
  day_name text,
  sets jsonb default '[]',
  duration_minutes integer,
  notes text,
  created_at timestamp with time zone default now(),
  constraint workout_logs_user_date_unique unique (user_id, date)
);

-- Food logs
create table public.food_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  date date not null,
  meal_type text not null,
  food_name text not null,
  calories integer not null,
  protein_g decimal(6,2) default 0,
  carbs_g decimal(6,2) default 0,
  fat_g decimal(6,2) default 0,
  quantity text,
  created_at timestamp with time zone default now()
);

-- Body measurements
create table public.body_measurements (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  date date not null,
  weight_kg decimal(5,2),
  chest_cm decimal(5,2),
  waist_cm decimal(5,2),
  hips_cm decimal(5,2),
  bicep_cm decimal(5,2),
  thigh_cm decimal(5,2),
  created_at timestamp with time zone default now()
);

-- Personal records view
create or replace view public.personal_records as
select 
  user_id,
  exercise_name,
  max(weight_kg) as max_weight_kg,
  date
from (
  select 
    wl.user_id,
    s->>'exercise_name' as exercise_name,
    (s->>'weight_kg')::decimal as weight_kg,
    wl.date
  from workout_logs wl,
  jsonb_array_elements(wl.sets) as s
  where s->>'weight_kg' is not null
) sub
group by user_id, exercise_name, date;

-- RLS Policies
alter table public.user_profiles enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_logs enable row level security;
alter table public.food_logs enable row level security;
alter table public.body_measurements enable row level security;

-- Allow service role to bypass RLS (for API routes)
-- All inserts/reads go through API with service role key
