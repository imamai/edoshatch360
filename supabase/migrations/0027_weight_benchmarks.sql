-- Expected weight range, by breed and age.
--
-- Every figure here is copied from that breed's own published performance
-- objectives / management guide, never invented — see the source column on
-- each row. Broiler breeders (Cobb, Aviagen, Hubbard) publish a single
-- as-hatched target weight per day rather than a range, so low = high for
-- those; layer breeders (Hendrix Genetics, Lohmann, Hy-Line) publish a real
-- min-max rearing-weight band, which is stored as given.
--
-- Deliberately narrow: only breeds with a standardized, publicly published
-- growth curve are seeded here — five commercial broiler lines and four of
-- the six commercial layer lines already in BREEDS (src/lib/catalogues.ts).
-- Local and dual-purpose breeds (kienyeji, improved kienyeji, Kenbro,
-- Kuroiler, Sasso, Rainbow Rooster) have no single standardized guide —
-- growth varies too much by rearing system to publish one — so they have no
-- rows here, and the app shows "no benchmark for this breed yet" rather than
-- a guessed number. Same for Shaver Brown and White Leghorn: their official
-- guides could not be reached to source real figures, so they are left out
-- rather than filled in with a guess.

create table if not exists public.edoshatch360_weight_benchmarks (
  id                 uuid primary key default gen_random_uuid(),
  bird_type          edoshatch360_bird_type not null,
  breed              text not null,
  age_days           integer not null check (age_days >= 0),
  weight_low_grams   numeric(10, 2) not null check (weight_low_grams >= 0),
  weight_high_grams  numeric(10, 2) not null check (weight_high_grams >= weight_low_grams),
  source             text not null,
  created_at         timestamptz not null default now(),
  unique (bird_type, breed, age_days)
);

alter table public.edoshatch360_weight_benchmarks enable row level security;

-- Reference data, not tenant data: every signed-in user may read it, and it
-- is only ever written by a migration, never by the app itself.
create policy edoshatch360_weight_benchmarks_read
  on public.edoshatch360_weight_benchmarks
  for select
  to authenticated
  using (true);

insert into public.edoshatch360_weight_benchmarks
  (bird_type, breed, age_days, weight_low_grams, weight_high_grams, source)
values
  -- Broilers — as-hatched (mixed sex) target body weight.
  ('broiler', 'Cobb 500', 7,  202,  202,  'Cobb-Vantress, Cobb500 Broiler Performance & Nutrition Supplement (2022)'),
  ('broiler', 'Cobb 500', 14, 570,  570,  'Cobb-Vantress, Cobb500 Broiler Performance & Nutrition Supplement (2022)'),
  ('broiler', 'Cobb 500', 21, 1116, 1116, 'Cobb-Vantress, Cobb500 Broiler Performance & Nutrition Supplement (2022)'),
  ('broiler', 'Cobb 500', 28, 1783, 1783, 'Cobb-Vantress, Cobb500 Broiler Performance & Nutrition Supplement (2022)'),
  ('broiler', 'Cobb 500', 35, 2521, 2521, 'Cobb-Vantress, Cobb500 Broiler Performance & Nutrition Supplement (2022)'),
  ('broiler', 'Cobb 500', 42, 3278, 3278, 'Cobb-Vantress, Cobb500 Broiler Performance & Nutrition Supplement (2022)'),

  ('broiler', 'Ross 308', 7,  213,  213,  'Aviagen, Ross 308 Broiler Performance Objectives (2022)'),
  ('broiler', 'Ross 308', 14, 533,  533,  'Aviagen, Ross 308 Broiler Performance Objectives (2022)'),
  ('broiler', 'Ross 308', 21, 1012, 1012, 'Aviagen, Ross 308 Broiler Performance Objectives (2022)'),
  ('broiler', 'Ross 308', 28, 1616, 1616, 'Aviagen, Ross 308 Broiler Performance Objectives (2022)'),
  ('broiler', 'Ross 308', 35, 2296, 2296, 'Aviagen, Ross 308 Broiler Performance Objectives (2022)'),
  ('broiler', 'Ross 308', 42, 2998, 2998, 'Aviagen, Ross 308 Broiler Performance Objectives (2022)'),

  ('broiler', 'Arbor Acres', 7,  209,  209,  'Aviagen, Arbor Acres Plus Broiler Performance Objectives (2022)'),
  ('broiler', 'Arbor Acres', 14, 527,  527,  'Aviagen, Arbor Acres Plus Broiler Performance Objectives (2022)'),
  ('broiler', 'Arbor Acres', 21, 1006, 1006, 'Aviagen, Arbor Acres Plus Broiler Performance Objectives (2022)'),
  ('broiler', 'Arbor Acres', 28, 1611, 1611, 'Aviagen, Arbor Acres Plus Broiler Performance Objectives (2022)'),
  ('broiler', 'Arbor Acres', 35, 2287, 2287, 'Aviagen, Arbor Acres Plus Broiler Performance Objectives (2022)'),
  ('broiler', 'Arbor Acres', 42, 2981, 2981, 'Aviagen, Arbor Acres Plus Broiler Performance Objectives (2022)'),

  ('broiler', 'Indian River', 7,  211,  211,  'Aviagen, Indian River Broiler Performance Objectives (2022)'),
  ('broiler', 'Indian River', 14, 531,  531,  'Aviagen, Indian River Broiler Performance Objectives (2022)'),
  ('broiler', 'Indian River', 21, 1010, 1010, 'Aviagen, Indian River Broiler Performance Objectives (2022)'),
  ('broiler', 'Indian River', 28, 1616, 1616, 'Aviagen, Indian River Broiler Performance Objectives (2022)'),
  ('broiler', 'Indian River', 35, 2295, 2295, 'Aviagen, Indian River Broiler Performance Objectives (2022)'),
  ('broiler', 'Indian River', 42, 2995, 2995, 'Aviagen, Indian River Broiler Performance Objectives (2022)'),

  ('broiler', 'Hubbard', 7,  216,  216,  'Hubbard, Broiler Performance Objectives — Efficiency Plus, as-hatched (2023)'),
  ('broiler', 'Hubbard', 14, 541,  541,  'Hubbard, Broiler Performance Objectives — Efficiency Plus, as-hatched (2023)'),
  ('broiler', 'Hubbard', 21, 1035, 1035, 'Hubbard, Broiler Performance Objectives — Efficiency Plus, as-hatched (2023)'),
  ('broiler', 'Hubbard', 28, 1647, 1647, 'Hubbard, Broiler Performance Objectives — Efficiency Plus, as-hatched (2023)'),
  ('broiler', 'Hubbard', 35, 2330, 2330, 'Hubbard, Broiler Performance Objectives — Efficiency Plus, as-hatched (2023)'),
  ('broiler', 'Hubbard', 42, 3028, 3028, 'Hubbard, Broiler Performance Objectives — Efficiency Plus, as-hatched (2023)'),

  -- Layers — rearing-period body weight band, by age in days (week 6/12/18).
  ('layer', 'Isa Brown', 42,  459,  483,  'Hendrix Genetics, ISA Brown Product Guide — Cage Production Systems'),
  ('layer', 'Isa Brown', 84,  1054, 1099, 'Hendrix Genetics, ISA Brown Product Guide — Cage Production Systems'),
  ('layer', 'Isa Brown', 126, 1455, 1545, 'Hendrix Genetics, ISA Brown Product Guide — Cage Production Systems'),

  ('layer', 'Bovans Brown', 42,  459,  483,  'Hendrix Genetics, Bovans Brown Product Guide — Cage Production Systems'),
  ('layer', 'Bovans Brown', 84,  1054, 1099, 'Hendrix Genetics, Bovans Brown Product Guide — Cage Production Systems'),
  ('layer', 'Bovans Brown', 126, 1455, 1545, 'Hendrix Genetics, Bovans Brown Product Guide — Cage Production Systems'),

  ('layer', 'Lohmann Brown', 42,  455,  483,  'Lohmann Tierzucht, Lohmann Brown-Classic Management Guide — Body Weight Development'),
  ('layer', 'Lohmann Brown', 84,  1016, 1078, 'Lohmann Tierzucht, Lohmann Brown-Classic Management Guide — Body Weight Development'),
  ('layer', 'Lohmann Brown', 126, 1448, 1538, 'Lohmann Tierzucht, Lohmann Brown-Classic Management Guide — Body Weight Development'),

  ('layer', 'Hy-Line Brown', 42,  266,  281,  'Hy-Line International, Hy-Line Brown Commercial Layers Management Guide — Rearing Period Performance Table'),
  ('layer', 'Hy-Line Brown', 84,  871,  921,  'Hy-Line International, Hy-Line Brown Commercial Layers Management Guide — Rearing Period Performance Table'),
  ('layer', 'Hy-Line Brown', 119, 1357, 1434, 'Hy-Line International, Hy-Line Brown Commercial Layers Management Guide — Rearing Period Performance Table')
on conflict (bird_type, breed, age_days) do nothing;
