import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Answer } from "./answer";
import type { Evidence, Insight } from "./insights";

/**
 * Saved edos.ai conversations — each person's own, never a colleague's.
 *
 * Read and written under the signed-in user's own session, which is what
 * `conv own` / `msg own` in 0019_assistant.sql actually enforce: RLS already
 * restricts every query here to rows `auth.uid()` owns, so this module does
 * not re-check ownership on top of it — except where a stale conversation id
 * from the client has to be confirmed still exists (see `saveExchange`).
 *
 * This was three copies of the same three queries, split across the page and
 * the action, each free to drift from the others. One copy, here.
 */

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  createdAt: string;
  evidence: Evidence[];
  insights: Insight[];
  needsVet: boolean;
}

interface StoredEvidence {
  evidence?: Evidence[];
  insights?: Insight[];
  needsVet?: boolean;
}

/**
 * Wrapped in `cache()` — the same reasoning as `getSession` in
 * `lib/data/session.ts` — because the sidebar now reads this on every page
 * under `/app`, and the assistant page reads it again for itself in the same
 * request. Without it, opening edos.ai would run the query twice.
 */
export const listConversations = cache(async (): Promise<Conversation[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_ai_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30)
    .returns<{ id: string; title: string; updated_at: string }[]>();

  return (data ?? []).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }));
});

export async function loadMessages(conversationId: string): Promise<StoredMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_ai_messages")
    .select("id, role, body, evidence, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at")
    .returns<{ id: string; role: "user" | "assistant"; body: string; evidence: StoredEvidence | null; created_at: string }[]>();

  // RLS returns an empty set rather than an error for a conversation that is
  // not this user's, so a wrong id in the URL yields no messages, not a leak.
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    body: m.body,
    createdAt: m.created_at,
    evidence: m.evidence?.evidence ?? [],
    insights: m.evidence?.insights ?? [],
    needsVet: m.evidence?.needsVet ?? false,
  }));
}

/**
 * Keep one exchange, starting a conversation first if this is its first
 * message. `tenantId` and `userId` come from the caller's already-resolved
 * session rather than being looked up again here.
 */
export async function saveExchange(input: {
  tenantId: string;
  userId: string;
  conversationId: string | null;
  title: string;
  question: string;
  answer: Answer;
}): Promise<string | null> {
  const supabase = await createClient();
  let id = input.conversationId;

  if (id) {
    // A stale id — the conversation was deleted from another tab, say — is
    // treated as "start a new one" rather than an error.
    const { data: owner } = await supabase.from("edoshatch360_ai_conversations").select("id").eq("id", id).maybeSingle();
    if (!owner) id = null;
  }

  if (!id) {
    const { data, error } = await supabase
      .from("edoshatch360_ai_conversations")
      .insert({ tenant_id: input.tenantId, user_id: input.userId, title: input.title })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) {
      console.error("edoshatch360: could not start a conversation", error);
      return null;
    }
    id = data.id;
  }

  const { error } = await supabase.from("edoshatch360_ai_messages").insert([
    { conversation_id: id, tenant_id: input.tenantId, role: "user", body: input.question, evidence: [] },
    {
      conversation_id: id,
      tenant_id: input.tenantId,
      role: "assistant",
      body: input.answer.body,
      evidence: { evidence: input.answer.evidence, insights: input.answer.insights, needsVet: input.answer.needsVet ?? false },
    },
  ]);

  if (error) {
    // The reply was already worked out and shown; only the record of it
    // failed. Still return the id — losing the conversation on top of a
    // logging failure would be a second, needless loss.
    console.error("edoshatch360: could not save assistant exchange", error);
    return id;
  }

  // Bumped so the conversation sorts to the top of the saved list.
  await supabase.from("edoshatch360_ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return id;
}

export async function deleteConversation(id: string): Promise<void> {
  const supabase = await createClient();
  // RLS restricts this to a conversation the caller owns.
  await supabase.from("edoshatch360_ai_conversations").delete().eq("id", id);
}
