-- EDOS Hatch360 — derived performance metrics.
--
-- These live in SQL rather than the app so the dashboard, the reports module
-- and any future AI layer all read the SAME numbers. RLS still applies: these
-- are INVOKER-rights functions, so a caller only ever aggregates rows their
-- policies already let them see.

create or replace function edoshatch360_flock_metrics(p_flock uuid)
returns jsonb
language sql
stable
as $$
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
    select d.avg_weight_grams
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
$$;

-- Farm Health Score (spec §11). Each component scores 0-100 or is omitted
-- when there is no data to judge it on — an unscored component is never
-- silently counted as zero, which would punish a brand-new farm for having
-- no history yet.
create or replace function edoshatch360_farm_health(p_farm uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_parts     jsonb := '[]'::jsonb;
  v_sum       numeric := 0;
  v_weight    numeric := 0;
  v_score     integer;
  v_mort      numeric;
  v_lay       numeric;
  v_fcr       numeric;
  v_vacc      numeric;
  v_alerts    integer;
  v_recording numeric;

  procedure_placeholder boolean;
begin
  -- Mortality across active flocks, benchmarked at 5% cumulative.
  select round(avg(nullif((m ->> 'mortality_pct')::numeric, null)), 2)
  into v_mort
  from edoshatch360_flocks f
  cross join lateral edoshatch360_flock_metrics(f.id) m
  where f.farm_id = p_farm and f.status not in ('closed', 'harvested');

  if v_mort is not null then
    declare s numeric := greatest(0, least(100, 100 - (v_mort / 5.0) * 50));
    begin
      v_parts := v_parts || jsonb_build_object(
        'key', 'mortality', 'label', 'Mortality',
        'value', v_mort, 'unit', '%', 'target', 5, 'score', round(s));
      v_sum := v_sum + s * 1.5; v_weight := v_weight + 1.5;
    end;
  end if;

  -- Laying rate for layer-type flocks, benchmarked at 85%.
  select round(avg((m ->> 'lay_pct')::numeric), 2) into v_lay
  from edoshatch360_flocks f
  cross join lateral edoshatch360_flock_metrics(f.id) m
  where f.farm_id = p_farm
    and f.bird_type in ('layer', 'kienyeji', 'improved_kienyeji', 'breeder')
    and f.status not in ('closed', 'harvested')
    and (m ->> 'lay_pct') is not null;

  if v_lay is not null then
    declare s numeric := greatest(0, least(100, (v_lay / 85.0) * 100));
    begin
      v_parts := v_parts || jsonb_build_object(
        'key', 'production', 'label', 'Egg production',
        'value', v_lay, 'unit', '%', 'target', 85, 'score', round(s));
      v_sum := v_sum + s * 1.5; v_weight := v_weight + 1.5;
    end;
  end if;

  -- Feed conversion, benchmarked at 1.8.
  select round(avg((m ->> 'fcr')::numeric), 2) into v_fcr
  from edoshatch360_flocks f
  cross join lateral edoshatch360_flock_metrics(f.id) m
  where f.farm_id = p_farm and f.status not in ('closed', 'harvested')
    and (m ->> 'fcr') is not null;

  if v_fcr is not null then
    declare s numeric := greatest(0, least(100, (1.8 / nullif(v_fcr, 0)) * 100));
    begin
      v_parts := v_parts || jsonb_build_object(
        'key', 'fcr', 'label', 'Feed conversion',
        'value', v_fcr, 'unit', '', 'target', 1.8, 'score', round(s));
      v_sum := v_sum + s; v_weight := v_weight + 1;
    end;
  end if;

  -- Vaccination compliance: share of due doses actually administered.
  select case when count(*) = 0 then null
              else round((count(*) filter (where v.status = 'done')::numeric / count(*)) * 100, 0)
         end
  into v_vacc
  from edoshatch360_vaccinations v
  join edoshatch360_flocks f on f.id = v.flock_id
  where f.farm_id = p_farm and v.due_date <= current_date;

  if v_vacc is not null then
    v_parts := v_parts || jsonb_build_object(
      'key', 'vaccination', 'label', 'Vaccination compliance',
      'value', v_vacc, 'unit', '%', 'target', 100, 'score', v_vacc);
    v_sum := v_sum + v_vacc * 1.5; v_weight := v_weight + 1.5;
  end if;

  -- Open high/critical health incidents in the last 30 days.
  select count(*) into v_alerts
  from edoshatch360_health_records h
  join edoshatch360_flocks f on f.id = h.flock_id
  where f.farm_id = p_farm
    and h.event_type = 'disease_incident'
    and h.severity in ('high', 'critical')
    and h.occurred_on > current_date - 30;

  declare s numeric := greatest(0, 100 - v_alerts * 25);
  begin
    v_parts := v_parts || jsonb_build_object(
      'key', 'disease', 'label', 'Disease alerts',
      'value', v_alerts, 'unit', ' open', 'target', 0, 'score', round(s));
    v_sum := v_sum + s; v_weight := v_weight + 1;
  end;

  -- Record-keeping discipline across active flocks.
  select round(avg((m ->> 'recording_rate')::numeric), 0) into v_recording
  from edoshatch360_flocks f
  cross join lateral edoshatch360_flock_metrics(f.id) m
  where f.farm_id = p_farm and f.status not in ('closed', 'harvested');

  if v_recording is not null then
    v_parts := v_parts || jsonb_build_object(
      'key', 'records', 'label', 'Record keeping',
      'value', v_recording, 'unit', '%', 'target', 100, 'score', least(100, v_recording));
    v_sum := v_sum + least(100, v_recording); v_weight := v_weight + 1;
  end if;

  v_score := case when v_weight > 0 then round(v_sum / v_weight) else null end;

  return jsonb_build_object(
    'farm_id', p_farm,
    'score', v_score,
    'band', case
      when v_score is null then 'unknown'
      when v_score >= 85 then 'excellent'
      when v_score >= 70 then 'good'
      when v_score >= 50 then 'attention'
      else 'critical' end,
    'components', v_parts
  );
end;
$$;

grant execute on function edoshatch360_flock_metrics(uuid) to authenticated;
grant execute on function edoshatch360_farm_health(uuid) to authenticated;
