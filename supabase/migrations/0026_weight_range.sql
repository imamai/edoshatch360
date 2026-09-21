-- Highest and lowest bird weight, alongside the average already recorded.
--
-- A farmer weighing a sample already sees the spread, not just the mean — two
-- birds at 1.2kg and 1.8kg on the same day tells a different story than a flat
-- 1.5kg average, even though the average is the same. Both are optional and
-- additive: every existing row keeps its average exactly as it was, and a
-- farmer who only ever wants the average can keep entering only that.
--
-- Expected range (breed/age benchmark weights) is deliberately not part of
-- this migration — that needs real breed growth-curve data, not a guess.

alter table public.edoshatch360_daily_records
  add column if not exists weight_highest_grams numeric(10, 2)
    check (weight_highest_grams is null or weight_highest_grams >= 0),
  add column if not exists weight_lowest_grams numeric(10, 2)
    check (weight_lowest_grams is null or weight_lowest_grams >= 0);

-- Same ceiling and the same "lowest cannot exceed highest" sanity check as
-- the rest of edoshatch360_validate_daily_record — impossible only, the
-- merely unusual stays the interface's business (src/lib/data-quality.ts).
create or replace function public.edoshatch360_validate_daily_record()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_flock      edoshatch360_flocks%rowtype;
  v_lost       integer;
  v_available  integer;
  v_prior      integer := 0;
  v_collected  integer;
  v_birds_after integer;
begin
  select * into v_flock from edoshatch360_flocks where id = new.flock_id;
  if not found then
    raise exception 'That flock no longer exists.' using errcode = 'HB001';
  end if;

  -- Dates ---------------------------------------------------------------
  if new.record_date > current_date then
    raise exception 'This day has not happened yet. A record dated in the future would count towards your averages and feed costs before the birds have eaten anything.'
      using errcode = 'HB001';
  end if;

  if new.record_date < v_flock.placement_date then
    raise exception '% was not on the farm on %. These birds arrived on %, so a record before that belongs to a different batch.',
      v_flock.code, new.record_date, v_flock.placement_date
      using errcode = 'HB001';
  end if;

  -- Losses --------------------------------------------------------------
  -- An edit to an existing day must be measured against the flock as it was
  -- before that day was counted, or correcting yesterday fails against itself.
  if tg_op = 'UPDATE' then
    v_prior := old.mortality + old.culls + old.birds_sold;
  else
    select coalesce(mortality + culls + birds_sold, 0) into v_prior
    from edoshatch360_daily_records
    where flock_id = new.flock_id and record_date = new.record_date;
    v_prior := coalesce(v_prior, 0);
  end if;

  v_lost := new.mortality + new.culls + new.birds_sold;
  v_available := v_flock.current_count + v_prior;

  if v_lost > v_available then
    raise exception 'That is % birds leaving a flock of %. % cannot lose more birds than it has — check whether one of these numbers belongs to another house.',
      v_lost, v_available, v_flock.code
      using errcode = 'HB001';
  end if;

  -- Eggs ----------------------------------------------------------------
  v_collected := coalesce(new.eggs_collected, 0);
  v_birds_after := greatest(0, v_available - v_lost);

  if coalesce(new.eggs_broken, 0) + coalesce(new.eggs_rejected, 0) > v_collected then
    raise exception '% broken and rejected out of % collected. Broken and rejected eggs are part of what was collected, not extra to it.',
      coalesce(new.eggs_broken, 0) + coalesce(new.eggs_rejected, 0), v_collected
      using errcode = 'HB001';
  end if;

  if v_collected > v_birds_after and v_birds_after > 0 then
    raise exception '% eggs from % birds. A hen lays at most one egg a day, so this is more eggs than there are birds to lay them. If you are entering trays, multiply by 30.',
      v_collected, v_birds_after
      using errcode = 'HB001';
  end if;

  -- Measurements --------------------------------------------------------
  -- Wide bounds: these catch a decimal point in the wrong place, not a
  -- farmer's judgement. Anything merely unusual is the interface's business.
  if new.avg_weight_grams is not null and new.avg_weight_grams > 20000 then
    raise exception '% g is heavier than any farmed bird. This field is the average weight of one bird in grams — a 2 kg broiler is 2000.',
      new.avg_weight_grams
      using errcode = 'HB001';
  end if;

  if new.weight_highest_grams is not null and new.weight_highest_grams > 20000 then
    raise exception '% g is heavier than any farmed bird. Check the highest-weight figure.',
      new.weight_highest_grams
      using errcode = 'HB001';
  end if;

  if new.weight_lowest_grams is not null and new.weight_lowest_grams > 20000 then
    raise exception '% g is heavier than any farmed bird. Check the lowest-weight figure.',
      new.weight_lowest_grams
      using errcode = 'HB001';
  end if;

  if new.weight_highest_grams is not null and new.weight_lowest_grams is not null
     and new.weight_lowest_grams > new.weight_highest_grams then
    raise exception 'The lowest weight (% g) is higher than the highest weight (% g). Check which is which.',
      new.weight_lowest_grams, new.weight_highest_grams
      using errcode = 'HB001';
  end if;

  if new.temperature_c is not null
     and (new.temperature_c < -10 or new.temperature_c > 55) then
    raise exception '% °C is outside anything a poultry house reaches. Check the figure.',
      new.temperature_c
      using errcode = 'HB001';
  end if;

  if new.humidity_pct is not null
     and (new.humidity_pct < 0 or new.humidity_pct > 100) then
    raise exception 'Humidity is a percentage, so it cannot be %.', new.humidity_pct
      using errcode = 'HB001';
  end if;

  return new;
end;
$function$;
