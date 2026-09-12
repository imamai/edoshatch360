import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquarePlus, Sparkles, Stethoscope } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/data/dashboard";
import { getFlocks } from "@/lib/data/flocks";
import { analyseFarm } from "@/lib/ai/insights";
import type { FlockMetrics } from "@/lib/database.types";

import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Composer, DeleteConversationButton, HowItWorks, InsightCard, MessageThread,
  type ChatMessage,
} from "./assistant-ui";
import { cn, relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Assistant" };

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; tab?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const tab = params.tab === "analysis" ? "analysis" : "chat";

  const supabase = await createClient();

  const { data: conversationRows } = await supabase
    .from("edoshatch360_ai_conversations")
    .select("id, title, updated_at")
    .eq("tenant_id", session.tenant.id)
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })
    .limit(30);

  const conversations = (conversationRows ?? []) as Conversation[];
  const activeId = params.c && conversations.some((c) => c.id === params.c) ? params.c : undefined;

  let messages: ChatMessage[] = [];
  if (activeId) {
    const { data } = await supabase
      .from("edoshatch360_ai_messages")
      .select("id, role, body, evidence, created_at")
      .eq("conversation_id", activeId)
      .order("created_at");
    messages = (data ?? []) as ChatMessage[];
  }

  // The Analysis tab runs the full review rather than waiting to be asked.
  let insights: ReturnType<typeof analyseFarm> = [];
  if (tab === "analysis") {
    const [data, flocks] = await Promise.all([
      getDashboardData(session.tenant.id),
      getFlocks(session.tenant.id),
    ]);
    const metrics = await Promise.all(
      flocks.map(async (flock) => {
        const { data: m } = await supabase.rpc("edoshatch360_flock_metrics", {
          p_flock: flock.id,
        });
        return { flock, metrics: (m as FlockMetrics) ?? null };
      }),
    );
    insights = analyseFarm({
      data,
      metrics,
      currency: session.tenant.currency,
      canSeeMoney: can(session.role, CAN_SEE_MONEY),
    });
  }

  const urgent = insights.filter((i) => i.tone === "urgent").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight text-ink">
            <Sparkles className="h-6 w-6 text-gold" />
            Assistant
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Ask about your farm and get an answer worked out from your own records.
          </p>
        </div>

        <Link
          href="/app/assistant"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong px-3.5 text-sm font-medium text-ink hover:border-brand hover:text-brand"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New conversation
        </Link>
      </div>

      {/* Tabs — chat, or the full review without asking. */}
      <nav className="mt-5 flex gap-1 border-b border-line">
        {([
          ["chat", "Chat"],
          ["analysis", "Analysis"],
        ] as const).map(([key, label]) => (
          <Link
            key={key}
            href={`/app/assistant?tab=${key}${activeId && key === "chat" ? `&c=${activeId}` : ""}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              tab === key
                ? "border-brand text-brand"
                : "border-transparent text-ink-soft hover:text-ink",
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
          <h2 className="px-1 text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
            Saved conversations
          </h2>

          {conversations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-xs leading-relaxed text-ink-faint">
              Nothing saved yet. Ask a question and it is kept here so you can come back
              to it.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {conversations.map((c) => (
                <li key={c.id} className="group flex items-center gap-1">
                  <Link
                    href={`/app/assistant?c=${c.id}`}
                    className={cn(
                      "min-w-0 flex-1 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      c.id === activeId
                        ? "bg-brand-soft font-medium text-brand"
                        : "text-ink-soft hover:bg-surface-sunk hover:text-ink",
                    )}
                  >
                    <span className="block truncate">{c.title}</span>
                    <span className="block text-[0.6875rem] text-ink-faint">
                      {relativeDay(c.updated_at)}
                    </span>
                  </Link>
                  <DeleteConversationButton id={c.id} />
                </li>
              ))}
            </ul>
          )}

          <HowItWorks />
        </aside>

        {/* ------------------------------------------------------- main -- */}
        <div className="order-1 lg:order-2">
          {tab === "analysis" ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {insights.length} finding{insights.length === 1 ? "" : "s"} from your
                    records
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                    Every flock checked against the benchmark for its bird type, plus
                    stock levels, the vaccination schedule and this month&apos;s figures.
                  </p>
                </div>
              </div>

              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}

              <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-sunk px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
                <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <span>
                  These are observations from your data. They are not a veterinary
                  diagnosis, and nothing here replaces having someone look at the birds.
                </span>
              </p>
            </div>
          ) : messages.length === 0 ? (
            <Card>
              <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/20 text-gold">
                  <Sparkles className="h-6 w-6" />
                </span>
                <div className="max-w-md">
                  <h2 className="font-display text-lg font-bold text-ink">
                    What would you like to know?
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    Ask in plain words. The answer comes from your own records, and shows
                    the numbers behind it.
                  </p>
                </div>
                <div className="w-full max-w-xl">
                  <Composer showSuggestions />
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              <MessageThread
                messages={messages}
                userName={session.user.full_name ?? session.user.email ?? "You"}
              />
              <div className="sticky bottom-20 rounded-xl border border-line bg-surface/95 p-3 shadow-raised backdrop-blur-sm md:bottom-4">
                <Composer conversationId={activeId} showSuggestions={false} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
