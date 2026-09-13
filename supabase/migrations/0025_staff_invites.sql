-- Staff invitations.
--
-- The schema has carried memberships.status = 'invited' and invited_by since
-- 0001, but nothing ever wrote them: there was no way to add a second person
-- to a farm at all. So max_users had nothing to enforce against, the
-- Professional plan's "staff accounts and roles" could not be used, and the
-- only route to a colleague's account was somebody typing SQL.
--
-- An invitation is a row holding a secret token. Whoever opens the link and
-- signs in with the invited address becomes a member. The token is the only
-- thing that grants anything, so it is generated in the database and never
-- derived from the email or the tenant.

create table edoshatch360_invites (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references edoshatch360_tenants (id) on delete cascade,
  email       text not null,
  role        edoshatch360_role not null default 'worker',
  token       text not null unique,
  invited_by  uuid references edoshatch360_users (id) on delete set null,
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references edoshatch360_users (id) on delete set null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index edoshatch360_invites_tenant_idx on edoshatch360_invites (tenant_id);
create index edoshatch360_invites_token_idx on edoshatch360_invites (token);

-- One live invitation per address per farm. Accepted and revoked rows are
-- excluded so the same person can be re-invited after leaving.
create unique index edoshatch360_invites_open_idx
  on edoshatch360_invites (tenant_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table edoshatch360_invites enable row level security;

-- Only someone who administers the farm may see or issue its invitations.
-- Note this policy deliberately does NOT let the invited person read their own
-- row: they are not a member yet, and matching on email would let anyone
-- enumerate invitations by signing up as the right address. The accept path
-- goes through the security-definer functions below instead, which require the
-- token.
create policy "invite admin" on edoshatch360_invites for all to authenticated
  using (tenant_id in (select edoshatch360_admin_tenant_ids()))
  with check (tenant_id in (select edoshatch360_admin_tenant_ids()));

/* ------------------------------------------------------------------ issue -- */

/**
 * Create an invitation and return its token.
 *
 * Security definer so the seat limit is counted against every membership on
 * the farm, not only the ones the caller can see. The caller still has to
 * administer the tenant — checked explicitly, because a definer function does
 * not get RLS for free.
 */
create or replace function edoshatch360_create_invite(
  p_tenant uuid,
  p_email  text,
  p_role   edoshatch360_role
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token   text;
  v_seats   integer;
  v_in_use  integer;
  v_email   text := lower(trim(p_email));
begin
  if not exists (
    select 1 from edoshatch360_memberships m
    where m.tenant_id = p_tenant
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'owner'
  ) and not edoshatch360_is_platform_admin() then
    raise exception 'Only the farm owner can invite people.'
      using errcode = 'HB001';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That does not look like an email address.'
      using errcode = 'HB001';
  end if;

  if exists (
    select 1 from edoshatch360_memberships m
    join edoshatch360_users u on u.id = m.user_id
    where m.tenant_id = p_tenant and lower(u.email) = v_email
  ) then
    raise exception '% is already on this farm.', v_email
      using errcode = 'HB001';
  end if;

  -- Seats are counted as members plus invitations still outstanding, so a
  -- farm cannot issue ten invitations against three seats and discover the
  -- problem only when people start accepting.
  select p.max_users into v_seats
  from edoshatch360_subscriptions s
  join edoshatch360_plans p on p.id = s.plan_id
  where s.tenant_id = p_tenant
  order by s.created_at desc
  limit 1;

  if v_seats is not null then
    select
      (select count(*) from edoshatch360_memberships m
        where m.tenant_id = p_tenant and m.status = 'active')
      + (select count(*) from edoshatch360_invites i
        where i.tenant_id = p_tenant
          and i.accepted_at is null and i.revoked_at is null
          and i.expires_at > now())
    into v_in_use;

    if v_in_use >= v_seats then
      raise exception 'Your plan covers % %, and all of them are taken. Upgrade to add more.',
        v_seats, case when v_seats = 1 then 'person' else 'people' end
        using errcode = 'HB001';
    end if;
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into edoshatch360_invites (tenant_id, email, role, token, invited_by)
  values (p_tenant, v_email, p_role, v_token, auth.uid());

  return v_token;
end;
$$;

/* ----------------------------------------------------------------- accept -- */

/**
 * What an invitation says, before anyone has signed in.
 *
 * Returns the farm and role so the accept page can say "Sunrise Poultry, as a
 * manager" to a signed-out visitor. Returns nothing at all for a token that is
 * wrong, spent, revoked or expired — the page cannot tell those apart, and
 * should not.
 */
create or replace function edoshatch360_invite_preview(p_token text)
returns table (tenant_name text, email text, role edoshatch360_role)
language sql
stable
security definer
set search_path = public
as $$
  select t.name, i.email, i.role
  from edoshatch360_invites i
  join edoshatch360_tenants t on t.id = i.tenant_id
  where i.token = p_token
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now();
$$;

/**
 * Redeem an invitation for the signed-in user.
 *
 * The address must match. The token is a secret, but a secret that travels by
 * email can be forwarded, and a membership grants access to a real farm's
 * money and records — so holding the link is not on its own enough.
 */
create or replace function edoshatch360_accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite edoshatch360_invites%rowtype;
  v_email  text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept an invitation.' using errcode = 'HB001';
  end if;

  select * into v_invite
  from edoshatch360_invites
  where token = p_token
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'That invitation has already been used, or it has expired.'
      using errcode = 'HB001';
  end if;

  select lower(u.email) into v_email
  from edoshatch360_users u where u.id = auth.uid();

  if v_email is distinct from lower(v_invite.email) then
    raise exception 'This invitation was sent to %. Sign in with that address to accept it.',
      v_invite.email using errcode = 'HB001';
  end if;

  insert into edoshatch360_memberships (tenant_id, user_id, role, status, invited_by)
  values (v_invite.tenant_id, auth.uid(), v_invite.role, 'active', v_invite.invited_by)
  on conflict (tenant_id, user_id)
  do update set status = 'active', role = excluded.role;

  update edoshatch360_invites
     set accepted_at = now(), accepted_by = auth.uid()
   where id = v_invite.id;

  -- Land them in the farm they just joined rather than wherever they were.
  update edoshatch360_users set last_tenant_id = v_invite.tenant_id
   where id = auth.uid();

  return v_invite.tenant_id;
end;
$$;

grant execute on function edoshatch360_create_invite(uuid, text, edoshatch360_role) to authenticated;
grant execute on function edoshatch360_accept_invite(text) to authenticated;
-- anon may look at an invitation so the page can explain itself before the
-- visitor has an account at all.
grant execute on function edoshatch360_invite_preview(text) to anon, authenticated;
