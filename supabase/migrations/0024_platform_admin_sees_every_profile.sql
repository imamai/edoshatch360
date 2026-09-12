-- The platform console exists to find people who are stranded: an account
-- that belongs to no organisation cannot reach anything from inside the app,
-- and nobody but EDOS can rescue it.
--
-- "profile read" could not show them. Its second branch resolves to
--   select m.user_id from edoshatch360_memberships m ...
-- which, by construction, only ever returns people who hold a membership.
-- A platform admin therefore saw every profile except exactly the ones the
-- screen was built to surface, and the console's "accounts belonging to no
-- farm" warning could never fire.
--
-- Adding the platform-admin branch that every other table already carries.
-- This widens nothing for ordinary users: the first two branches are
-- unchanged, so a farmer still sees only themselves and their colleagues.

drop policy if exists "profile read" on edoshatch360_users;

create policy "profile read" on edoshatch360_users for select to authenticated
  using (
    id = (select auth.uid())
    or id in (
      select m.user_id from edoshatch360_memberships m
      where m.tenant_id in (select edoshatch360_tenant_ids())
    )
    or (select edoshatch360_is_platform_admin())
  );
