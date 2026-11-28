-- Food counter: per-item grams, fiber and source (photo | text | manual | recent).
alter table ironpulse.food_logs add column if not exists grams numeric(7,1);
alter table ironpulse.food_logs add column if not exists fiber_g numeric(6,2);
alter table ironpulse.food_logs add column if not exists source text default 'manual';
