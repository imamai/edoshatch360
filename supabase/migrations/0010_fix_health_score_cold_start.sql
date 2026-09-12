-- Fix: a farm with no flocks and no records scored 100 / "excellent", because
-- the only component that evaluated was "zero disease alerts" — trivially
-- perfect when nothing exists. A score is now withheld ('unknown') until the
-- farm has an active flock AND at least two components with real data behind
-- them, so the dial never flatters an empty farm.
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
  v_flocks    integer;
begin
  select count(*) into v_flocks
  from edoshatch360_flocks f
  where f.farm_id = p_farm and f.status not in ('closed', 'harvested');

  if v_flocks = 0 then
    return jsonb_build_object(
      'farm_id', p_farm, 'score', null, 'band', 'unknown',
      'components', '[]'::jsonb,
      'reason', 'No active flocks yet');
  end if;

  select round(avg((m ->> 'mortality_pct')::numeric), 2) into v_mort
  from edoshatch360_flocks f
  cross join lateral edoshatch360_flock_metrics(f.id) m
  where f.farm_id = p_farm and f.status not in ('closed', 'harvested')
    and (m ->> 'days_recorded')::int > 0;

  if v_mort is not null then
    declare s numeric := greatest(0, least(100, 100 - (v_mort / 5.0) * 50));
    begin
      v_parts := v_parts || jsonb_build_object(
        'key', 'mortality', 'label', 'Mortality',
        'value', v_mort, 'unit', '%', 'target', 5, 'score', round(s));
      v_sum := v_sum + s * 1.5; v_weight := v_weight + 1.5;
    end;
  end if;

  select round(avg((m ->> 'lay_pct')::numeric), 2) into v_lay
  from edoshatch360_flocks f
  cross join lateral edoshatch360_flock_metrics(f.id) m
  where f.farm_id = p_farm
    and f.bird_type in ('layer', 'kienyeji', 'improved_kienyeji', 'breeder')
    and f.status not in ('closed', 'harvested')
    and (m ->> 'lay_pct') is not null
    and (m ->> 'eggs_last_7')::int > 0;

  if v_lay is not null then
    declare s numeric := greatest(0, least(100, (v_lay / 85.0) * 100));
    begin
      v_parts := v_parts || jsonb_build_object(
        'key', 'production', 'label', 'Egg production',
        'value', v_lay, 'unit', '%', 'target', 85, 'score', round(s));
      v_sum := v_sum + s * 1.5; v_weight := v_weight + 1.5;
    end;
  end if;

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

  -- Disease alerts only count once something else is measurable: on its own,
  -- "no incidents recorded" is the absence of data, not evidence of health.
  if v_weight > 0 then
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
  end if;

  select round(avg((m ->> 'recording_rate')::numeric), 0) into v_recording
  from edoshatch360_flocks f
  cross join lateral edoshatch360_flock_metrics(f.id) m
  where f.farm_id = p_farm and f.status not in ('closed', 'harvested')
    and (m ->> 'days_recorded')::int > 0;

  if v_recording is not null then
    v_parts := v_parts || jsonb_build_object(
      'key', 'records', 'label', 'Record keeping',
      'value', v_recording, 'unit', '%', 'target', 100, 'score', least(100, v_recording));
    v_sum := v_sum + least(100, v_recording); v_weight := v_weight + 1;
  end if;

  -- Need at least two substantiated components before publishing a number.
  v_score := case when v_weight >= 2 then round(v_sum / v_weight) else null end;

  return jsonb_build_object(
    'farm_id', p_farm,
    'score', v_score,
    'band', case
      when v_score is null then 'unknown'
      when v_score >= 85 then 'excellent'
      when v_score >= 70 then 'good'
      when v_score >= 50 then 'attention'
      else 'critical' end,
    'components', v_parts,
    'reason', case when v_score is null then 'Not enough records yet' else null end
  );
end;
$$;

grant execute on function edoshatch360_farm_health(uuid) to authenticated;
