-- Data quality rules, enforced where they cannot be walked around.
--
-- Every constraint on these tables until now was a single-column floor check:
-- mortality >= 0, amount_cents >= 0, and so on. Nothing said a flock could not
-- lose more birds than it has, that a day could not be recorded before the
-- birds arrived, or that eggs could not outnumber the hens.
--
-- Why this has to live in Postgres rather than in a server action: a daily
-- record is written by the browser straight to PostgREST, because the app is
-- offline-first and the queue in IndexedDB syncs directly when the phone finds
-- signal. There is no server action in that path to validate anything. A rule
-- that is not in the database is not enforced at all for the app's single most
-- important form.
--
-- Impossible only. Unusual-but-possible belongs in the interface, where it can
-- be explained and overridden — see src/lib/data-quality.ts. A farm having a
-- genuinely terrible day is exactly what these records exist to capture, and a
-- database that refuses to record it teaches people to type whatever the form
-- will accept.
--
-- Messages are written for the farmer holding the phone, not for a developer
-- reading a log. They are raised with SQLSTATE HB001 so the client can tell
-- "this sentence is meant to be shown" from a genuine fault.
--
-- Checked against every existing row before writing this: no current record in
-- any tenant violates any rule below.

/* ------------------------------------------------------- daily records -- */

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

drop trigger if exists edoshatch360_daily_records_validate on public.edoshatch360_daily_records;
create trigger edoshatch360_daily_records_validate
  before insert or update on public.edoshatch360_daily_records
  for each row execute function public.edoshatch360_validate_daily_record();

/* --------------------------------------------------------------- flocks -- */

create or replace function public.edoshatch360_validate_flock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.placement_date > current_date then
    raise exception 'Birds cannot be placed on a future date. If they are arriving later, add the flock on the day they arrive.'
      using errcode = 'HB001';
  end if;

  if new.current_count > new.placement_count then
    raise exception 'A flock cannot hold more birds than were placed in it: % now against % placed. Birds added later belong in their own batch, so each one keeps its own age and costs.',
      new.current_count, new.placement_count
      using errcode = 'HB001';
  end if;

  if new.expected_harvest_date is not null
     and new.expected_harvest_date < new.placement_date then
    raise exception 'The harvest date is before the birds arrived.' using errcode = 'HB001';
  end if;

  return new;
end;
$function$;

drop trigger if exists edoshatch360_flocks_validate on public.edoshatch360_flocks;
create trigger edoshatch360_flocks_validate
  before insert or update on public.edoshatch360_flocks
  for each row execute function public.edoshatch360_validate_flock();

/* ---------------------------------------------------------------- sales -- */

create or replace function public.edoshatch360_validate_sale()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.sale_date > current_date then
    raise exception 'A sale cannot be dated in the future.' using errcode = 'HB001';
  end if;

  if new.due_date is not null and new.due_date < new.sale_date then
    raise exception 'Payment cannot be due before the sale was made.' using errcode = 'HB001';
  end if;

  return new;
end;
$function$;

drop trigger if exists edoshatch360_sales_validate on public.edoshatch360_sales;
create trigger edoshatch360_sales_validate
  before insert or update on public.edoshatch360_sales
  for each row execute function public.edoshatch360_validate_sale();

-- Deliberately NOT enforced here: amount_paid_cents <= total_cents.
-- edoshatch360_resum_sale writes the paid total and the sale total in two
-- separate statements, so a legitimate payment passes through a moment where
-- paid briefly exceeds a total that has not been recomputed yet. Overpayment
-- is caught in recordPayment, against the outstanding balance, where the
-- farmer can be told what the balance actually is.
