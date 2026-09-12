"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, Eye, Info, Send, Sparkles, Stethoscope, Trash2,
} from "lucide-react";

import { askAssistant, deleteConversation, type AskState } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge, type Tone } from "@/components/ui/badge";
// From the client-safe constants module, not from answer.ts — importing a
// value out of the analysis engine would pull next/headers into the browser.
import { SUGGESTED_QUESTIONS } from "@/lib/ai/prompts";
import type { Evidence, Insight, InsightTone } from "@/lib/ai/insights";
import { cn, initials, relativeDay } from "@/lib/utils";

const initial: AskState = { error: null };

export const TONE_BADGE: Record<InsightTone, Tone> = {
  urgent: "critical",
  watch: "attention",
  neutral: "info",
  good: "good",
};

const TONE_ICON = {
  urgent: AlertTriangle,
  watch: AlertTriangle,
  neutral: Info,
  good: CheckCircle2,
} as const;

/* ------------------------------------------------------------ evidence -- */

export function EvidenceTable({ rows }: { rows: Evidence[] }) {
  if (rows.length === 0) return null;

  return (
    <dl className="mt-3 grid gap-x-4 gap-y-2 rounded-lg border border-line bg-surface-sunk p-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-ink-soft">{row.label}</dt>
          <dd className="text-xs font-semibold text-ink tnum">
            {row.value}
            {row.target && (
              <span className="ml-1 font-normal text-ink-faint">/ {row.target}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function InsightCard({ insight }: { insight: Insight }) {
  const Icon = TONE_ICON[insight.tone];

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              insight.tone === "urgent"
                ? "bg-critical-soft text-critical"
                : insight.tone === "watch"
                  ? "bg-attention-soft text-attention"
                  : insight.tone === "good"
                    ? "bg-good-soft text-good"
                    : "bg-info-soft text-info",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">{insight.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{insight.body}</p>
          </div>
        </div>
        <Badge tone={TONE_BADGE[insight.tone]}>{insight.tone}</Badge>
      </div>

      <EvidenceTable rows={insight.evidence} />

      {insight.action && !insight.needsVet && (
        <p className="mt-3 text-xs leading-relaxed text-ink">
          <strong className="font-semibold">Worth trying:</strong> {insight.action}
        </p>
      )}

      {insight.needsVet && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-attention/25 bg-attention-soft px-3 py-2 text-xs leading-relaxed text-attention">
          <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This is an observation from your records, not a diagnosis. Losing birds or a
            sudden production drop needs a veterinarian or animal health officer to look
            at the flock.
          </span>
        </p>
      )}

      {insight.href && (
        <Link
          href={insight.href}
          className="mt-3 inline-block text-xs font-semibold text-brand hover:underline"
        >
          Open the records →
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ messages -- */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  created_at: string;
  evidence: {
    evidence?: Evidence[];
    insights?: Insight[];
    needsVet?: boolean;
  } | null;
}

export function MessageThread({
  messages,
  userName,
}: {
  messages: ChatMessage[];
  userName: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex flex-col gap-5">
      {messages.map((message) =>
        message.role === "user" ? (
          <div key={message.id} className="flex items-start justify-end gap-3">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-sm text-white">
              {message.body}
            </div>
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[0.6875rem] font-bold text-brand">
              {initials(userName)}
            </span>
          </div>
        ) : (
          <div key={message.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 max-w-[92%] flex-1">
              <div className="rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3">
                <p className="text-sm leading-relaxed text-ink">{message.body}</p>
                <EvidenceTable rows={message.evidence?.evidence ?? []} />
              </div>

              {(message.evidence?.insights ?? []).length > 0 && (
                <div className="mt-3 flex flex-col gap-3">
                  {message.evidence!.insights!.slice(0, 3).map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              )}

              <p className="mt-1.5 text-[0.6875rem] text-ink-faint">
                {relativeDay(message.created_at)} · worked out from your records
              </p>
            </div>
          </div>
        ),
      )}
      <div ref={endRef} />
    </div>
  );
}

/* ----------------------------------------------------------- composer -- */

export function Composer({
  conversationId,
  showSuggestions,
}: {
  conversationId?: string;
  showSuggestions: boolean;
}) {
  const [state, action, pending] = useActionState(askAssistant, initial);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3">
      {showSuggestions && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.value = q;
                  inputRef.current.focus();
                }
              }}
              className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-brand hover:text-brand"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form action={action} className="flex items-end gap-2">
        {conversationId && (
          <input type="hidden" name="conversation_id" value={conversationId} />
        )}
        <input
          ref={inputRef}
          name="question"
          required
          maxLength={1000}
          autoComplete="off"
          placeholder="Ask about your birds, feed, eggs or money…"
          className="h-12 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
        <Button type="submit" size="lg" busy={pending} className="shrink-0">
          {!pending && <Send className="h-4 w-4" />}
          <span className="sr-only sm:not-sr-only">{pending ? "Thinking" : "Ask"}</span>
        </Button>
      </form>

      {state.error && (
        <p role="alert" className="text-sm text-critical">
          {state.error}
        </p>
      )}
    </div>
  );
}

export function DeleteConversationButton({ id }: { id: string }) {
  return (
    <form action={deleteConversation.bind(null, id)}>
      <button
        type="submit"
        aria-label="Delete this conversation"
        className="rounded p-1 text-ink-faint hover:text-critical"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

/** Says plainly what this is and is not. */
export function HowItWorks() {
  return (
    <div className="rounded-xl border border-line bg-surface-sunk p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Eye className="h-4 w-4 text-brand" />
        How the assistant works
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        Every answer is calculated from the records on this farm — your daily entries,
        stock movements, sales and vaccination schedule. Each one shows the figures it
        used, so you can check the arithmetic rather than take it on trust. It does not
        invent numbers, and when a question falls outside what your records can answer,
        it says so instead of guessing.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        It is not a veterinarian. Anything involving sick or dying birds ends with the
        same advice: call your animal health officer.
      </p>
    </div>
  );
}
