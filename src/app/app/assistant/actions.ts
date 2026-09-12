"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { getFlocks } from "@/lib/data/flocks";
import { answerQuestion, titleFor } from "@/lib/ai/answer";
import type { FlockMetrics } from "@/lib/database.types";

export interface AskState {
  error: string | null;
}

/**
 * Answers a question from the farm's records and saves both sides of the
 * exchange. The evidence behind each answer is stored with it, so a reply
 * read back in a month can still be traced to the numbers that produced it.
 */
export async function askAssistant(_prev: AskState, form: FormData): Promise<AskState> {
  const session = await requireSession();
  const supabase = await createClient();

  const question = String(form.get("question") ?? "").trim();
  if (!question) return { error: "Type a question first." };
  if (question.length > 1000) return { error: "That question is too long." };

  let conversationId = String(form.get("conversation_id") ?? "");

  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("edoshatch360_ai_conversations")
      .insert({
        tenant_id: session.tenant.id,
        user_id: session.user.id,
        title: titleFor(question),
      })
      .select("id")
      .single();

    if (error || !created) return { error: "We couldn't start that conversation. Try again." };
    conversationId = created.id;
  }

  const [data, flocks] = await Promise.all([
    getDashboardData(session.tenant.id),
    getFlocks(session.tenant.id),
  ]);

  const metrics = await Promise.all(
    flocks.map(async (flock) => {
      const { data: m } = await supabase.rpc("edoshatch360_flock_metrics", { p_flock: flock.id });
      return { flock, metrics: (m as FlockMetrics) ?? null };
    }),
  );

  const answer = answerQuestion(question, {
    data,
    metrics,
    currency: session.tenant.currency,
    canSeeMoney: can(session.role, CAN_SEE_MONEY),
  });

  const { error: insertError } = await supabase.from("edoshatch360_ai_messages").insert([
    {
      conversation_id: conversationId,
      tenant_id: session.tenant.id,
      role: "user",
      body: question,
      // Explicit, even though the column defaults to '[]'. In a multi-row
      // insert PostgREST builds one column list from the union of the keys
      // and sends NULL for whatever a row is missing — the default never
      // applies, and the NOT NULL constraint rejects the whole batch.
      evidence: [],
    },
    {
      conversation_id: conversationId,
      tenant_id: session.tenant.id,
      role: "assistant",
      body: answer.body,
      evidence: {
        evidence: answer.evidence,
        insights: answer.insights,
        needsVet: answer.needsVet ?? false,
      },
    },
  ]);

  if (insertError) {
    // The reply is still shown; only the record of it failed. Log the real
    // cause — this failure was invisible for weeks behind a friendly message.
    console.error("edoshatch360: could not save assistant exchange", insertError);
    return { error: "We couldn't save that exchange. Try again." };
  }

  // Bump the conversation so it sorts to the top of the saved list.
  await supabase
    .from("edoshatch360_ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  revalidatePath("/app/assistant");
  redirect(`/app/assistant?c=${conversationId}`);
}

export async function deleteConversation(id: string) {
  const supabase = await createClient();
  // RLS restricts this to the caller's own conversations.
  await supabase.from("edoshatch360_ai_conversations").delete().eq("id", id);
  revalidatePath("/app/assistant");
  redirect("/app/assistant");
}
