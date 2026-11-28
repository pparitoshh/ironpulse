create table if not exists ironpulse.session_catalog (
  id uuid default gen_random_uuid() primary key,
  user_id text,                       -- null = built-in, else a user's own video
  type text not null,                 -- hiit | yoga | core | mobility | stretch | walk
  title text not null,
  channel text,
  youtube_id text not null,
  duration_min integer not null,
  level text default 'beginner',      -- beginner | intermediate | advanced
  met numeric(4,1) not null,          -- intensity, for kcal = MET x kg x h
  equipment text default 'none',
  low_impact boolean default false,
  embeddable boolean default true,
  created_at timestamptz default now()
);
create unique index if not exists session_catalog_uniq on ironpulse.session_catalog (coalesce(user_id,''), youtube_id);
alter table ironpulse.session_catalog enable row level security;
alter table ironpulse.cardio_logs add column if not exists catalog_id uuid references ironpulse.session_catalog(id) on delete set null;
alter table ironpulse.cardio_logs add column if not exists title text;
grant all on ironpulse.session_catalog to service_role;

insert into ironpulse.session_catalog (user_id,type,title,channel,youtube_id,duration_min,level,met,equipment,low_impact,embeddable) values
(null,'hiit','BEST 15 min Beginner Workout for Fat Burning (NO JUMPING HIIT!!!)','emi wong','bleOTMDa3_4',17,'beginner',6.0,'none',true,true),
(null,'hiit','15 Min Intense HIIT Workout For Fat Burn & Cardio (No Equipment, No Repeats)','Oliver Sjostrom','J212vz33gU4',15,'beginner',6.0,'none',false,true),
(null,'hiit','30 MIN FULL BODY HIIT (No Jumping + No Equipment)','MadFit','rI_6l992GrA',32,'advanced',9.0,'none',true,true),
(null,'hiit','No Equipment INTENSE FULL BODY CRUSHER - HIIT WORKOUT I no repeat I stronger together','growingannanas','-YpRYNREDV8',31,'advanced',9.0,'none',false,true),
(null,'hiit','12-Minute Full Body Tabata Workout | Tabata Songs','Tabata Songs','ttkq49P_7ds',12,'intermediate',8.0,'none',false,true),
(null,'hiit','10 MIN FULL BODY WORKOUT TABATA (Fat Burning) ADVANCED','재호 - Fitness','wk4-TDsTF_8',11,'intermediate',8.0,'none',false,false),
(null,'hiit','20 Minute Dumbbell Full Body Workout - No Repeat | Caroline Girvan','Caroline Girvan','l9_SoClAO5g',24,'intermediate',7.0,'dumbbells',false,true),
(null,'hiit','20 Minute Full Body Dumbbell Workout NO REPEAT (Strength & Conditioning)','Juice & Toya','mf1xQS_Zlkc',23,'intermediate',7.0,'dumbbells',false,true),
(null,'walk','FAST Walking in 30 minutes | Fitness Videos','Walk at Home','enYITYwvPAQ',32,'beginner',5.0,'none',true,true),
(null,'walk','30 Minute Boosted Fitness Walk | Walk at Home','Walk at Home','cvEJ5WFk2KE',30,'beginner',5.0,'none',true,true),
(null,'core','15 MIN SIXPACK WORKOUT - intense ab workout / No Equipment I Pamela Reif','Pamela Reif','EfJ4aB_enVE',16,'intermediate',4.5,'none',false,true),
(null,'core','15 MIN TOTAL CORE/AB WORKOUT (At Home No Equipment)','MadFit','glxrwC9zsHY',17,'intermediate',4.5,'none',false,true),
(null,'core','10 MIN AB WORKOUT // No Equipment | Pamela Reif','Pamela Reif','AnYl6Nk9GOA',10,'beginner',3.8,'none',false,true),
(null,'hiit','20 MIN CARDIO HIIT WORKOUT - ALL STANDING - Full Body, No Equipment, No Repeats','Nobadaddiction','FeR-4_Opt-g',28,'intermediate',8.0,'none',true,true),
(null,'hiit','20 Min Fat Burning HIIT Workout -  Full body Cardio, No Equipment, No Repeat','Oliver Sjostrom','-hSma-BRzoo',20,'intermediate',8.0,'none',false,true),
(null,'yoga','Yoga For Complete Beginners - 20 Minute Home Yoga Workout!','Yoga With Adriene','v7AYKMP6rOE',24,'beginner',2.5,'none',true,true),
(null,'yoga','Yoga To Feel Your Best  |  22-Minute Home Yoga','Yoga With Adriene','BPK9WNtpBgk',23,'beginner',2.5,'none',true,true),
(null,'yoga','Yoga Ganzkörper Flow | Bauch Beine Po & Rücken | 30 Min. Workout','Mady Morrison','TAbH1yusgRo',29,'intermediate',3.0,'none',true,true),
(null,'yoga','30-Minute Power Yoga Flow For Tight Abs and a Toned Butt','PS Fit ','S9p5yhE6_fk',29,'intermediate',3.0,'none',true,true),
(null,'yoga','15 Minute Beginner Stretch Flexibility Routine! (FOLLOW ALONG)','Tom Merrick','L_xrDAtykMI',15,'beginner',2.5,'none',true,true),
(null,'yoga','Back Pain Relief Stretches |  10 min. Yoga for Relaxation & Recovery','Mady Morrison','2eA2Koq6pTI',12,'beginner',2.3,'none',true,true),
(null,'mobility','15 Min. Full Body Stretch | Daily Routine for Flexibility, Mobility & Relaxation | DAY 7','Mady Morrison','g_tea8ZNk5A',17,'beginner',2.5,'none',true,true),
(null,'mobility','15 MIN FULL BODY STRETCH - Improve Mobility and Flexibility','growingannanas','i6TzP2COtow',16,'beginner',2.5,'none',true,true),
(null,'mobility','The PERFECT Mobility Routine To Get Your Sh*t Together! (Based On Your Body)','Jeremy Ethier','TSIbzfcnv_8',9,'beginner',2.3,'none',true,true),
(null,'stretch','15-minute POST-WORKOUT STRETCH for Injury Prevention & Flexibility','Kaleigh Cohen Strength','7_Gmj7awnWY',16,'beginner',2.3,'none',true,true),
(null,'stretch','DAY 7 Back to Basics - 15 MIN FULL BODY STRETCH For Rest Day, Improve Mobility & Flexibility','growingannanas','aO1boUJhjvk',16,'beginner',2.3,'none',true,true),
(null,'yoga','Wind Down Yoga   |  12-Minute Bedtime Yoga','Yoga With Adriene','BiWDsfZ3zbo',12,'beginner',2.0,'none',true,true)
on conflict do nothing;
alter table ironpulse.session_catalog add constraint session_catalog_user_video unique (user_id, youtube_id);

-- User prefers Yoga with Kassandra: replace other built-in yoga
delete from ironpulse.session_catalog where user_id is null and type='yoga' and channel not ilike '%kassandra%' and youtube_id <> (select youtube_id from ironpulse.session_catalog where channel='Tom Merrick' limit 1);
update ironpulse.session_catalog set type='stretch' where channel='Tom Merrick';
insert into ironpulse.session_catalog (user_id,type,title,channel,youtube_id,duration_min,level,met,equipment,low_impact,embeddable) values
(null,'yoga','10 min Morning Yoga Full Body Stretch - Yoga with Kassandra','Yoga with Kassandra','4pKly2JojMw',11,'beginner',2.5,'none',true,true),
(null,'yoga','10 min Gentle Morning Yoga for Beginners (NO PROPS)','Yoga with Kassandra','C2RAjUEAoLI',11,'beginner',2.3,'none',true,true),
(null,'yoga','10 min Morning Yoga Stretch for an ENERGY BOOST','Yoga with Kassandra','BPRE9o1cEgk',10,'beginner',2.5,'none',true,true),
(null,'yoga','10 min Morning Yoga For Hips & Lower Back – Day #19 (HIPS & BACK MORNING YOGA)','Yoga with Kassandra','rBfdsyk8UK0',12,'beginner',2.3,'none',true,true),
(null,'yoga','10 min Morning Yoga For Neck & Upper Back Relief – Day #10 (NECK & BACK YOGA STRETCH)','Yoga with Kassandra','SEOy2n_uarc',13,'beginner',2.3,'none',true,true),
(null,'yoga','20 min Yoga for Flexibility - Sweet Release Feel Good Flow','Yoga with Kassandra','s-1vMbAgYWU',19,'beginner',2.5,'none',true,true),
(null,'yoga','20 min Morning Yoga Workout - Strength & Energy Yoga Flow','Yoga with Kassandra','CM43AZaRXNw',19,'intermediate',3.3,'none',true,true),
(null,'yoga','20 min Full Body Yoga - Intermediate Vinyasa Yoga','Yoga with Kassandra','5wUC4HlQwZc',21,'intermediate',3.3,'none',true,true),
(null,'yoga','30 min Full Body Yoga - Intermediate Vinyasa Yoga','Yoga with Kassandra','Z6jRKThDCBU',35,'intermediate',3.5,'none',true,true),
(null,'yoga','20 min Neck & Shoulder Yoga Release (NECK & SHOULDER STRETCHES)','Yoga with Kassandra','IlplXfNE45U',24,'beginner',2.3,'none',true,true),
(null,'yoga','30 min Yoga for Flexibility - DEEP STRETCH VINYASA','Yoga with Kassandra','q1vPLx1YZ-s',29,'intermediate',3.0,'none',true,true),
(null,'yoga','30 min Yin Yoga for Your Nervous System','Yoga with Kassandra','sVqH6qPDdh0',29,'beginner',2.0,'none',true,true),
(null,'yoga','30 min Yin Yoga for Upper Back Knots - Beginner Yin for Upper Body Pain','Yoga with Kassandra','94hMk05dTws',32,'beginner',2.0,'none',true,true),
(null,'yoga','35 min Morning Yoga to STRETCH & ENERGIZE','Yoga with Kassandra','ZgHo2xL3vX0',38,'intermediate',3.0,'none',true,true)
on conflict do nothing;

-- User's chosen warm-up and cool-down videos
insert into ironpulse.session_catalog (user_id,type,title,channel,youtube_id,duration_min,level,met,equipment,low_impact,embeddable) values
(null,'warmup','5-minute PRE-WORKOUT WARM UP for Injury Prevention','Kaleigh Cohen Strength','OcPs3x1vX1A',7,'beginner',3.5,'none',true,true),
(null,'cooldown','5 MIN FULL BODY COOL DOWN STRETCHES (Recovery & Flexibility)','MadFit','gfzC9XMEypg',7,'beginner',2.3,'none',true,true)
on conflict do nothing;
