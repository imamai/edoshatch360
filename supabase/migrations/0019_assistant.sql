-- Hatch360 Assistant: saved conversations over the farm's own records.

create table edoshatch360_ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references edoshatch360_tenants (id) on delete cascade,
  user_id    uuid not null references edoshatch360_users (id) on delete cascade,
  title      text not null default 'New conversation',
  is_pinned  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table edoshatch360_ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references edoshatch360_ai_conversations (id) on delete cascade,
  tenant_id       uuid not null references edoshatch360_tenants (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  body            text not null,
  -- The figures the answer was derived from, kept so a reply can always be
  -- traced back to the records that produced it rather than being taken on
  -- trust. Also what a future language-model layer would be handed.
  evidence        jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index edoshatch360_ai_conv_user_idx
  on edoshatch360_ai_conversations (tenant_id, user_id, updated_at desc);
create index edoshatch360_ai_msg_conv_idx
  on edoshatch360_ai_messages (conversation_id, created_at);

create trigger edoshatch360_ai_conv_touch before update on edoshatch360_ai_conversations
  for each row execute function edoshatch360_touch_updated_at();

alter table edoshatch360_ai_conversations enable row level security;
alter table edoshatch360_ai_messages      enable row level security;

-- A conversation is private to the person who had it, not shared across the
-- organisation: it can quote figures their colleagues may not be allowed to
-- see, and it is a working scratchpad rather than a farm record.
create policy "conv own" on edoshatch360_ai_conversations for all to authenticated
  using (user_id = (select auth.uid()) and tenant_id in (select edoshatch360_tenant_ids()))
  with check (user_id = (select auth.uid()) and tenant_id in (select edoshatch360_tenant_ids()));

create policy "msg own" on edoshatch360_ai_messages for all to authenticated
  using (
    conversation_id in (
      select c.id from edoshatch360_ai_conversations c
      where c.user_id = (select auth.uid())
    )
  )
  with check (
    tenant_id in (select edoshatch360_tenant_ids())
    and conversation_id in (
      select c.id from edoshatch360_ai_conversations c
      where c.user_id = (select auth.uid())
    )
  );
