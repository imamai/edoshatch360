-- Surface the highest/lowest weighing (added in 0026) through the same RPC
-- edos.ai and the flock page already call, so the assistant's flock_metrics
-- tool can report a spread, not just the average.
--
-- Pulled from the same row as avg_weight_g (the latest weighing that has an
-- average), not a separately-latest highest/lowest — a farmer weighs a
-- sample once and records all three together, so they should read as one
-- weighing, not three independent ones that might land on different days.
create or replace function public.edoshatch360_flock_metrics(p_flock uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with f as (
    select * from edoshatch360_flocks where id = p_flock
  ),
  agg as (
    select
      coalesce(sum(d.mortality), 0)::int              as mortality,
      coalesce(sum(d.culls), 0)::int                  as culls,
      coalesce(sum(d.birds_sold), 0)::int             as birds_sold,
      coalesce(sum(d.eggs_collected), 0)::int         as eggs_total,
      coalesce(sum(d.eggs_broken), 0)::int            as eggs_broken,
      coalesce(sum(d.eggs_rejected), 0)::int          as eggs_rejected,
      coalesce(sum(d.feed_consumed_kg), 0)::numeric   as feed_kg,
      coalesce(sum(d.water_consumed_liters), 0)::numeric as water_l,
      count(*)::int                                   as days_recorded,
      max(d.record_date)                              as last_record_date
    from edoshatch360_daily_records d where d.flock_id = p_flock
  ),
  latest_weight as (
    select d.avg_weight_grams, d.weight_highest_grams, d.weight_lowest_grams
    from edoshatch360_daily_records d
    where d.flock_id = p_flock and d.avg_weight_grams is not null
    order by d.record_date desc limit 1
  ),
  recent as (
    select
      coalesce(sum(d.eggs_collected), 0)::int as eggs_7,
      coalesce(sum(d.mortality + d.culls), 0)::int as deaths_7,
      coalesce(sum(d.feed_consumed_kg), 0)::numeric as feed_7
    from edoshatch360_daily_records d
    where d.flock_id = p_flock and d.record_date > current_date - 7
  )
  select jsonb_build_object(
    'flock_id',        f.id,
    'code',            f.code,
    'bird_type',       f.bird_type,
    'status',          f.status,
    'age_days',        greatest(0, current_date - f.placement_date),
    'placed',          f.placement_count,
    'current',         f.current_count,
    'mortality',       agg.mortality,
    'culls',           agg.culls,
    'birds_sold',      agg.birds_sold,
    'mortality_pct',   case when f.placement_count > 0
                         then round(((agg.mortality + agg.culls)::numeric / f.placement_count) * 100, 2)
                         else 0 end,
    'eggs_total',      agg.eggs_total,
    'eggs_broken',     agg.eggs_broken,
    'eggs_rejected',   agg.eggs_rejected,
    'eggs_saleable',   greatest(0, agg.eggs_total - agg.eggs_broken - agg.eggs_rejected),
    'eggs_last_7',     recent.eggs_7,
    -- Hen-day production: eggs per live bird per day over the last week.
    'lay_pct',         case when f.current_count > 0
                         then round((recent.eggs_7::numeric / (f.current_count * 7)) * 100, 2)
                         else null end,
    'feed_kg',         round(agg.feed_kg, 2),
    'feed_last_7_kg',  round(recent.feed_7, 2),
    'water_liters',    round(agg.water_l, 2),
    'avg_weight_g',    (select avg_weight_grams from latest_weight),
    'weight_highest_g', (select weight_highest_grams from latest_weight),
    'weight_lowest_g',  (select weight_lowest_grams from latest_weight),
    -- Feed Conversion Ratio: kg feed per kg of live weight standing.
    'fcr',             case
                         when (select avg_weight_grams from latest_weight) is not null
                          and f.current_count > 0
                          and agg.feed_kg > 0
                         then round(
                           agg.feed_kg /
                           nullif((f.current_count * (select avg_weight_grams from latest_weight) / 1000.0), 0), 2)
                         else null end,
    -- Average daily gain, assuming a ~40 g day-old chick.
    'adg_g',           case
                         when (select avg_weight_grams from latest_weight) is not null
                          and (current_date - f.placement_date) > 0
                         then round(
                           ((select avg_weight_grams from latest_weight) - 40)
                           / (current_date - f.placement_date), 1)
                         else null end,
    'days_recorded',   agg.days_recorded,
    'last_record_date', agg.last_record_date,
    -- How disciplined is the record-keeping? Drives the nudges on the
    -- daily-entry screen.
    'recording_rate',  case when (current_date - f.placement_date) > 0
                         then round((agg.days_recorded::numeric
                              / least(greatest(1, current_date - f.placement_date), 365)) * 100, 0)
                         else 100 end
  )
  from f, agg, recent;
$function$;
