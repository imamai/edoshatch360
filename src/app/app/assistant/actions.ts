"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/data/session";
import { loadAnalysisInput } from "@/lib/ai/load";
import { deleteConversation, saveExchange } from "@/lib/ai/store";
import { type Answer, answerQuestion, titleFor } from "@/lib/ai/answer";
import { answerWithModel, modelAvailable } from "@/lib/ai/llm";

export type AskResult =
  | { ok: true; answer: Answer; conversationId: string | null; saved: boolean }
  | { ok: false; error: string };

/**
 * Answer a question from this farm's own records, and keep the exchange.
 * Called directly from the chat component rather than through a form
 * submission, so asking a question no longer reloads the page.
 */
export async function askAssistant(
  question: string,
  conversationId: string | null,
  history: { role: "user" | "assistant"; body: string }[] = [],
): Promise<AskResult> {
  const session = await requireSession();

  const q = question.trim();
  if (!q) return { ok: false, error: "Type a question first." };
  if (q.length > 500) return { ok: false, error: "That question is too long — keep it under 500 characters." };

  const input = await loadAnalysisInput(session);

  // The conversation so far, so a follow-up ("and last week?") is understood.
  const earlier = (Array.isArray(history) ? history : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.body === "string")
    .slice(-8)
    .map((m) => ({ role: m.role, body: m.body.slice(0, 2000) }));

  // With a model configured, it takes every question — it can combine tools
  // in ways nobody wrote a matcher for. Without one, or if it fails, the
  // built-in answers stand in, so edos.ai never simply goes dark.
  let answer: Answer;
  if (modelAvailable()) {
    try {
      answer = await answerWithModel(q, earlier, input, session.tenant.name);
    } catch (cause) {
      console.error("edoshatch360: assistant model failed, using the built-in answers", cause);
      answer = answerQuestion(q, input);
    }
  } else {
    answer = answerQuestion(q, input);
  }

  const id = await saveExchange({
    tenantId: session.tenant.id,
    userId: session.user.id,
    conversationId,
    title: titleFor(q),
    question: q,
    answer,
  });

  if (id) revalidatePath("/app/assistant");
  return { ok: true, answer, conversationId: id, saved: id !== null };
}

export async function removeConversation(id: string): Promise<void> {
  await requireSession();
  await deleteConversation(id);
  revalidatePath("/app/assistant");
  // No redirect here: the sidebar's delete button lists these on every page,
  // not only the assistant's own, and the caller — which knows whether the
  // conversation just deleted is the one currently open — decides whether
  // that means going somewhere else or just refreshing where it is.
}
