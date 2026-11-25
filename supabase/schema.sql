-- IronPulse lives in its own schema `ironpulse` inside the ML.Quest Supabase
-- project (zgpfkkalgbbbskdxuztx). ML.Quest's tables stay in `public`.
-- All access goes through Next.js API routes using the service-role key.
create schema if not exists ironpulse;

create table if not exists ironpulse.user_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id text not null unique,
  gender text not null,
  goal text not null,
  level text not null,
  days_per_week integer not null default 4,
  training_days text[] default '{}',
  equipment text[] default '{}',
  age integer,
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  target_calories integer,
  target_protein integer,
  target_carbs integer,
  target_fat integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ironpulse.workout_plans (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  plan jsonb not null,
  created_at timestamptz default now()
);

create table if not exists ironpulse.workout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  date date not null,
  day_name text,
  sets jsonb default '[]',
  duration_minutes integer,
  notes text,
  created_at timestamptz default now(),
  constraint workout_logs_user_date_unique unique (user_id, date)
);

create table if not exists ironpulse.food_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  date date not null,
  meal_type text not null,
  food_name text not null,
  calories integer not null,
  protein_g numeric(6,2) default 0,
  carbs_g numeric(6,2) default 0,
  fat_g numeric(6,2) default 0,
  quantity text,
  created_at timestamptz default now()
);

create table if not exists ironpulse.body_measurements (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  date date not null,
  weight_kg numeric(5,2),
  chest_cm numeric(5,2),
  waist_cm numeric(5,2),
  hips_cm numeric(5,2),
  bicep_cm numeric(5,2),
  thigh_cm numeric(5,2),
  created_at timestamptz default now()
);

-- Cardio sessions (manual or scanned from a machine's summary screen).
create table if not exists ironpulse.cardio_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  date date not null,
  machine text not null,              -- treadmill | bike | stair_climber | rower | elliptical | other
  duration_min numeric(6,2) not null,
  calories_machine integer,           -- as shown on the console
  calories integer,                   -- recomputed with the user's real body weight
  distance_km numeric(7,3),
  floors integer,
  steps integer,
  avg_hr integer,
  max_hr integer,
  mets numeric(4,1),
  avg_speed text,
  incline_pct numeric(4,1),
  resistance numeric(5,1),
  source text default 'manual',       -- manual | photo
  raw jsonb,                          -- full model reading, for debugging
  created_at timestamptz default now()
);

create index if not exists workout_logs_user_date on ironpulse.workout_logs (user_id, date desc);
create index if not exists food_logs_user_date on ironpulse.food_logs (user_id, date);
create index if not exists cardio_logs_user_date on ironpulse.cardio_logs (user_id, date desc);
create index if not exists body_measurements_user_date on ironpulse.body_measurements (user_id, date);

alter table ironpulse.user_profiles enable row level security;
alter table ironpulse.workout_plans enable row level security;
alter table ironpulse.workout_logs enable row level security;
alter table ironpulse.food_logs enable row level security;
alter table ironpulse.body_measurements enable row level security;
alter table ironpulse.cardio_logs enable row level security;

-- Only the service role (server-side API routes) may touch IronPulse data.
grant usage on schema ironpulse to service_role;
grant all on all tables in schema ironpulse to service_role;
alter default privileges in schema ironpulse grant all on tables to service_role;
