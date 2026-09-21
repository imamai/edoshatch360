-- Replace the 3 coarse ISA Brown checkpoints (week 6/12/18, from the cage
-- production systems product guide) with the full week-by-week rearing chart
-- ("Rearing Chart ISA Brown Final Product") — 18 checkpoints instead of 3,
-- so the expected-range interpolation in src/lib/weight-benchmark.ts needs
-- to guess across a 6-week gap far less often. Bovans Brown is untouched —
-- no equivalent chart for it was available, so it keeps its 3 checkpoints.

delete from public.edoshatch360_weight_benchmarks
where bird_type = 'layer' and breed = 'Isa Brown';

insert into public.edoshatch360_weight_benchmarks
  (bird_type, breed, age_days, weight_low_grams, weight_high_grams, source)
values
  ('layer', 'Isa Brown', 7,   65,   68,   'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 14,  110,  120,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 21,  195,  210,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 28,  285,  305,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 35,  380,  400,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 42,  470,  500,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 49,  560,  590,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 56,  650,  680,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 63,  740,  775,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 70,  830,  865,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 77,  920,  960,  'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 84,  1010, 1050, 'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 91,  1095, 1140, 'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 98,  1180, 1230, 'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 105, 1265, 1320, 'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 112, 1350, 1410, 'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 119, 1430, 1505, 'ISA, Rearing Chart — ISA Brown Final Product'),
  ('layer', 'Isa Brown', 126, 1500, 1600, 'ISA, Rearing Chart — ISA Brown Final Product')
on conflict (bird_type, breed, age_days) do update
  set weight_low_grams = excluded.weight_low_grams,
      weight_high_grams = excluded.weight_high_grams,
      source = excluded.source;
