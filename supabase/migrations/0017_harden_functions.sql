-- Security hardening for the Hatch360 functions, from the database linter.
--
-- 1. Pin search_path on the four functions that were missing it. Without it a
--    caller can prepend a schema of their own and have an unqualified name
--    inside the body resolve to their object instead of ours — which matters
--    most for the SECURITY DEFINER ones.
-- 2. Postgres grants EXECUTE on new functions to PUBLIC by default, so every
--    helper was reachable by the anonymous role over /rest/v1/rpc. Revoke
--    that and grant deliberately.

alter function edoshatch360_touch_updated_at()      set search_path = public;
alter function edoshatch360_set_contact_dedupe()    set search_path = public;
alter function edoshatch360_flock_metrics(uuid)     set search_path = public;
alter function edoshatch360_farm_health(uuid)       set search_path = public;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'edoshatch360\_%'
  loop
    execute format('revoke all on function %s from public', fn.sig);
    execute format('revoke all on function %s from anon', fn.sig);
  end loop;
end $$;

-- RPCs the application calls directly.
grant execute on function edoshatch360_ensure_profile()                                to authenticated;
grant execute on function edoshatch360_create_tenant(text, text, text, edoshatch360_farm_mode) to authenticated;
grant execute on function edoshatch360_join_demo()                                     to authenticated;
grant execute on function edoshatch360_next_doc_number(uuid, edoshatch360_doc_type)    to authenticated;
grant execute on function edoshatch360_flock_metrics(uuid)                             to authenticated;
grant execute on function edoshatch360_farm_health(uuid)                               to authenticated;

-- Helpers referenced inside RLS policies. Policy expressions are evaluated as
-- the querying role, so the role must be able to execute them.
grant execute on function edoshatch360_is_platform_admin()        to authenticated;
grant execute on function edoshatch360_tenant_ids()               to authenticated;
grant execute on function edoshatch360_writable_tenant_ids()      to authenticated;
grant execute on function edoshatch360_admin_tenant_ids()         to authenticated;
grant execute on function edoshatch360_money_tenant_ids()         to authenticated;
grant execute on function edoshatch360_money_write_tenant_ids()   to authenticated;
grant execute on function edoshatch360_farm_ids()                 to authenticated;
grant execute on function edoshatch360_flock_ids()                to authenticated;

-- The CMS and contact-form policies are evaluated for signed-out visitors and
-- call edoshatch360_is_platform_admin(), so anon needs this one — and only
-- this one. It reads nothing an anonymous caller could act on: with no
-- auth.uid() it simply returns false.
grant execute on function edoshatch360_is_platform_admin() to anon;

-- Derived-value recomputation used by triggers. Granting to authenticated
-- keeps CREATE TRIGGER and any future re-creation working; both functions are
-- idempotent recomputations from rows that already exist, so a direct call
-- can neither leak nor corrupt anything.
grant execute on function edoshatch360_recount_flock(uuid) to authenticated;
grant execute on function edoshatch360_resum_sale(uuid)    to authenticated;
