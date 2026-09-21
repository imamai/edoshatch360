import type { Metadata } from "next";
import Link from "next/link";
import { Stethoscope } from "lucide-react";

import { requireSession } from "@/lib/data/session";
import { loadAnalysisInput } from "@/lib/ai/load";
import { listConversations, loadMessages } from "@/lib/ai/store";
import { analyseFarm } from "@/lib/ai/insights";
import { modelAvailable } from "@/lib/ai/llm";
import { greetingFor } from "@/lib/ai/greeting";

import { Badge } from "@/components/ui/badge";
import {
  AssistantChat,
  AssistantGlyph,
  DeleteConversationButton,
  HowItWorks,
  InsightCard,
  NewConversationButton,
  type ThreadMessage,
} from "./assistant-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "edos.ai" };

/**
 * Ask about the farm, or read the review it runs by itself.
 *
 * This is edos.ai — the same assistant EDOS Poa runs for its shops, taking
 * the Hatch360 mark and this farm's own records. A chat whose every answer is
 * worked out from the tenant's records with the figures shown, and an
 * Analysis tab that runs the full review without being asked.
 */
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; tab?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const tab = params.tab === "analysis" ? "analysis" : "chat";

  const conversations = await listConversations();
  const activeId = params.c && conversations.some((c) => c.id === params.c) ? params.c : undefined;

  let initial: ThreadMessage[] = [];
  if (activeId) {
    const stored = await loadMessages(activeId);
    initial = stored.map((m) => ({
      id: m.id,
      role: m.role,
      body: m.body,
      evidence: m.evidence,
      insights: m.insights,
      needsVet: m.needsVet,
    }));
  }

  // The review runs for the badge on the Analysis tab as well as the tab
  // itself — "3 things need attention" is worth seeing from the chat too.
  const input = await loadAnalysisInput(session);
  const insights = analyseFarm(input);
  const urgent = insights.filter((i) => i.tone === "urgent").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
          <AssistantGlyph className="h-7 w-7" />
          edos.ai
        </h1>
        <NewConversationButton />
      </div>

      {/* Chat, or the full review without asking. */}
      <nav aria-label="edos.ai" className="scroll-slim -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {(
          [
            ["chat", "Chat"],
            ["analysis", "Analysis"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={key === "chat" ? (activeId ? `/app/assistant?c=${activeId}` : "/app/assistant") : "/app/assistant?tab=analysis"}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
              tab === key ? "border-brand font-medium text-brand-dark" : "border-transparent text-ink-soft hover:border-line-strong hover:text-ink",
            )}
          >
            {label}
            {key === "analysis" && urgent > 0 && <Badge tone="critical">{urgent}</Badge>}
          </Link>
        ))}
      </nav>

      <div className="mt-5 grid gap-5 lg:grid-cols-[15rem_1fr] lg:items-start">
        {/* ------------------------------------------- saved conversations -- */}
        <aside className="order-2 flex flex-col gap-3 lg:order-1">
          <h2 className="px-1 text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">Saved conversations</h2>

          {conversations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-xs leading-relaxed text-ink-faint">
              Nothing saved yet. Ask a question and it is kept here so you can come back to it.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {conversations.map((c) => (
                <li key={c.id} className="group flex items-center gap-1">
                  <Link
                    href={`/app/assistant?c=${c.id}`}
                    className={cn(
                      "min-w-0 flex-1 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      c.id === activeId ? "bg-brand-soft font-medium text-brand" : "text-ink-soft hover:bg-surface-sunk hover:text-ink",
                    )}
                  >
                    <span className="block truncate">{c.title}</span>
                  </Link>
                  <DeleteConversationButton id={c.id} />
                </li>
              ))}
            </ul>
          )}

          <HowItWorks model={modelAvailable()} />
        </aside>

        {/* ------------------------------------------------------- main -- */}
        <div className="order-1 lg:order-2">
          {tab === "analysis" ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                <AssistantGlyph className="h-8 w-8" />
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {insights.length} finding{insights.length === 1 ? "" : "s"} from your records
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                    Every flock checked against the benchmark for its bird type, plus stock levels, the vaccination
                    schedule and this month&apos;s figures.
                  </p>
                </div>
              </div>

              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}

              <HowItWorks model={modelAvailable()} />

              <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-sunk px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
                <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                <span>
                  These are observations from your data. They are not a veterinary diagnosis, and nothing here
                  replaces having someone look at the birds.
                </span>
              </p>
            </div>
          ) : (
            <AssistantChat
              key={activeId ?? "new"}
              conversationId={activeId ?? null}
              initial={initial}
              userName={session.user.full_name ?? session.user.email ?? "You"}
              greeting={greetingFor(session.user.full_name ?? session.user.email ?? "")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
