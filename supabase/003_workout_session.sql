-- Workout start/end timestamps and estimated strength-training calories.
alter table ironpulse.workout_logs add column if not exists started_at timestamptz;
alter table ironpulse.workout_logs add column if not exists ended_at timestamptz;
alter table ironpulse.workout_logs add column if not exists calories integer;
