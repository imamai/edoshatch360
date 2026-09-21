"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Copy,
  Eye,
  Info,
  Loader2,
  MessageSquarePlus,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { askAssistant, removeConversation } from "./actions";
import { LogoMark } from "@/components/brand/logo";
import { Badge, type Tone } from "@/components/ui/badge";
// From the client-safe constants module, not answer.ts — importing a value
// out of the analysis engine would pull next/headers into the browser.
import { SUGGESTED_QUESTIONS } from "@/lib/ai/prompts";
import type { Evidence, Insight, InsightTone } from "@/lib/ai/insights";
import { cn, initials } from "@/lib/utils";

/**
 * edos.ai's moving parts, in the shape EDOS Poa's edos.ai has them: a
 * greeting over an empty thread, a chat that never reloads the page, findings
 * as cards with their figures underneath, and a plain statement of how it
 * works. The mark beside every answer is Hatch360's own — the egg cut by the
 * rising arc — so this reads as this farm's assistant, not a borrowed one.
 */

const TONE_BADGE: Record<InsightTone, Tone> = {
  urgent: "critical",
  watch: "attention",
  neutral: "info",
  good: "good",
};

const TONE_WORD: Record<InsightTone, string> = {
  urgent: "Act now",
  watch: "Watch",
  neutral: "Worth knowing",
  good: "Going well",
};

const TONE_ICON = {
  urgent: AlertTriangle,
  watch: AlertTriangle,
  neutral: Info,
  good: CheckCircle2,
} as const;

const TONE_CHIP: Record<InsightTone, string> = {
  urgent: "bg-critical-soft text-critical",
  watch: "bg-attention-soft text-attention",
  neutral: "bg-info-soft text-info",
  good: "bg-good-soft text-good",
};

/** The Hatch360 mark, in a soft gold disc — edos.ai's own face on the page. */
export function AssistantGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold", className)}>
      <LogoMark className="h-[60%] w-[60%]" />
    </span>
  );
}

// ── The figures behind an answer ────────────────────────────────────────────

export function EvidenceList({ rows }: { rows: Evidence[] }) {
  if (!rows.length) return null;
  return (
    <dl className="mt-3 grid gap-x-5 gap-y-1.5 rounded-lg border border-line bg-surface-sunk px-3 py-2.5 sm:grid-cols-2">
      {rows.map((row, i) => (
        <div key={`${row.label}-${i}`} className="flex min-w-0 items-baseline justify-between gap-3">
          <dt className="min-w-0 truncate text-xs text-ink-soft">{row.label}</dt>
          <dd className="shrink-0 text-xs font-semibold text-ink tabular-nums">
            {row.value}
            {row.target && <span className="ml-1 font-normal text-ink-faint">· {row.target}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function InsightCard({ insight }: { insight: Insight }) {
  const Icon = TONE_ICON[insight.tone];
  return (
    <article className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TONE_CHIP[insight.tone])}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">{insight.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{insight.body}</p>
          </div>
        </div>
        <Badge tone={TONE_BADGE[insight.tone]} className="hidden sm:inline-flex">
          {TONE_WORD[insight.tone]}
        </Badge>
      </div>

      <EvidenceList rows={insight.evidence} />

      {insight.action && !insight.needsVet && (
        <p className="mt-3 text-xs leading-relaxed text-ink">
          <strong className="font-semibold">Worth trying:</strong> {insight.action}
        </p>
      )}

      {insight.needsVet && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-attention/25 bg-attention-soft px-3 py-2 text-xs leading-relaxed text-attention">
          <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            This is an observation from your records, not a diagnosis. Losing birds or a sudden production drop
            needs a veterinarian or animal health officer to look at the flock.
          </span>
        </p>
      )}

      {insight.href && (
        <Link href={insight.href} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
          See the records
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}

/** Said once at the message level, for an answer that needed the notice but carried no insight card to put it on. */
function VetNotice() {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg border border-attention/25 bg-attention-soft px-3 py-2 text-xs leading-relaxed text-attention">
      <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Not a diagnosis — call your animal health officer or veterinarian for anything about sick or dying birds.</span>
    </p>
  );
}

// ── The conversation ─────────────────────────────────────────────────────

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  evidence: Evidence[];
  insights: Insight[];
  needsVet: boolean;
}

function Thread({
  messages,
  userName,
  thinking,
}: {
  messages: ThreadMessage[];
  userName: string;
  thinking: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, thinking]);

  return (
    <div className="flex flex-col gap-7" aria-live="polite">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex items-start justify-end gap-3">
            <p className="max-w-[80%] rounded-2xl bg-surface-sunk px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink">
              {m.body}
            </p>
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[0.625rem] font-bold text-brand-dark">
              {initials(userName)}
            </span>
          </div>
        ) : (
          <div key={m.id} className="group/answer flex items-start gap-3">
            <AssistantGlyph className="mt-0.5 h-7 w-7" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink">{m.body}</p>
              <EvidenceList rows={m.evidence} />
              {m.needsVet && m.insights.every((i) => !i.needsVet) && <VetNotice />}
              {m.insights.length > 0 && (
                <div className="mt-3 flex flex-col gap-3">
                  {m.insights.slice(0, 4).map((f) => (
                    <InsightCard key={f.id} insight={f} />
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[0.6875rem] text-ink-faint">Worked out from your records</span>
                <CopyAnswer body={m.body} />
              </div>
            </div>
          </div>
        ),
      )}

      {thinking && (
        <div className="flex items-start gap-3">
          <AssistantGlyph className="mt-0.5 h-7 w-7" />
          <p className="flex items-center gap-1 py-0.5 text-[0.9375rem] text-ink-faint">
            Working it out
            <span className="animate-pulse">…</span>
          </p>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

function CopyAnswer({ body }: { body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(body).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] text-ink-faint opacity-0 transition-opacity group-hover/answer:opacity-100 focus-visible:opacity-100 hover:text-ink"
    >
      {copied ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const DRAFT_KEY = "edoshatch360:assistant-draft";

/**
 * The chat itself.
 *
 * The thread lives here as well as in the database, so it still works when
 * saving fails — the answer is shown the moment it comes back — and asking a
 * question calls the server action directly rather than submitting a form,
 * so nothing about the page reloads while a conversation is under way.
 */
export function AssistantChat({
  conversationId,
  initial,
  userName,
  greeting,
}: {
  conversationId: string | null;
  initial: ThreadMessage[];
  userName: string;
  /** "Good afternoon, Njoroge" — settled on the server, in Nairobi time. */
  greeting: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ThreadMessage[]>(initial);
  const [current, setCurrent] = useState(conversationId);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);
  const sequence = useRef(0);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || thinking) return;
    setError(null);
    setText("");
    setThinking(true);
    const stamp = ++sequence.current;
    setMessages((m) => [...m, { id: `q-${stamp}`, role: "user", body: q, evidence: [], insights: [], needsVet: false }]);

    const history = messages.map((m) => ({ role: m.role, body: m.body }));
    const result = await askAssistant(q, current, history);
    setThinking(false);

    if (!result.ok) {
      setError(result.error);
      setMessages((m) => m.filter((x) => x.id !== `q-${stamp}`));
      setText(q);
      return;
    }

    setMessages((m) => [
      ...m,
      {
        id: `a-${stamp}`,
        role: "assistant",
        body: result.answer.body,
        evidence: result.answer.evidence,
        insights: result.answer.insights,
        needsVet: result.answer.needsVet ?? false,
      },
    ]);

    // A new saved conversation gets its own address, so the sidebar list
    // picks it up and reloading the page comes back to it.
    if (result.conversationId && result.conversationId !== current) {
      setCurrent(result.conversationId);
      startTransition(() => router.replace(`/app/assistant?c=${result.conversationId}`, { scroll: false }));
    } else if (result.saved) {
      startTransition(() => router.refresh());
    }
  }

  // An unsaved thread survives a reload of this tab, in case saving is
  // momentarily unavailable or the person just navigated away by accident.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (conversationId || initial.length) return;
    try {
      const kept = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null") as ThreadMessage[] | null;
      if (Array.isArray(kept) && kept.length) startTransition(() => setMessages(kept));
    } catch {
      /* storage blocked or corrupt — start fresh */
    }
  }, [conversationId, initial.length]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      if (current || !messages.length) sessionStorage.removeItem(DRAFT_KEY);
      else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* storage unavailable — the thread still works for this visit */
    }
  }, [messages, current]);

  const [atBottom, setAtBottom] = useState(true);
  useEffect(() => {
    const check = () => {
      const el = document.scrollingElement;
      if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [messages.length]);

  const empty = messages.length === 0;

  useEffect(() => {
    const box = input.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 200)}px`;
  }, [text]);

  // One control, in both states: a rounded field with the send button
  // inside it. Only where it sits on the page changes.
  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void ask(text);
      }}
      className="rounded-2xl border border-line-strong bg-surface shadow-card transition-colors focus-within:border-brand"
    >
      <label htmlFor="assistant-question" className="sr-only">
        Your question
      </label>
      <textarea
        id="assistant-question"
        ref={input}
        rows={1}
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void ask(text);
          }
        }}
        placeholder="Ask about your birds, feed, eggs or money…"
        className="scroll-slim w-full resize-none bg-transparent px-4 pt-3.5 text-[0.9375rem] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3 px-3 pt-1 pb-2.5">
        <p className="hidden text-[0.6875rem] text-ink-faint sm:block">Enter to send · Shift + Enter for a new line</p>
        <button
          type="submit"
          disabled={thinking || !text.trim()}
          aria-label={thinking ? "Working on it" : "Send"}
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {thinking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </form>
  );

  const problem = error && (
    <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
      {error}
    </p>
  );

  return empty ? (
    <div className="mx-auto flex w-full max-w-3xl flex-col justify-center gap-5 pt-[12vh] pb-16">
      <h2 className="flex items-center justify-center gap-3 text-center font-display text-2xl font-extrabold tracking-tight text-balance text-ink sm:text-3xl">
        <AssistantGlyph className="h-8 w-8 sm:h-9 sm:w-9" />
        {greeting}
      </h2>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void ask(q)}
            className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-brand hover:text-brand"
          >
            {q}
          </button>
        ))}
      </div>
      {composer}
      {problem}
      <p className="text-center text-[0.6875rem] text-ink-faint">
        edos.ai works from your own records. Check the figures before you act on them.
      </p>
    </div>
  ) : (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Thread messages={messages} userName={userName} thinking={thinking} />
      <div className="sticky bottom-20 flex flex-col gap-2 md:bottom-4">
        {!atBottom && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
            aria-label="Go to the latest answer"
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-raised transition-colors hover:text-ink"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {composer}
        {problem}
      </div>
    </div>
  );
}

export function NewConversationButton() {
  return (
    <Link
      href="/app/assistant"
      onClick={() => {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* storage unavailable */
        }
      }}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
    >
      <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
      New conversation
    </Link>
  );
}

export function DeleteConversationButton({ id }: { id: string }) {
  return (
    <form action={removeConversation.bind(null, id)}>
      <button type="submit" aria-label="Delete this conversation" className="rounded p-1 text-ink-faint hover:text-critical">
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}

/** What this is, and what it is not, said plainly. */
export function HowItWorks({ model }: { model: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface-sunk p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Eye className="h-4 w-4 text-brand" aria-hidden="true" />
        How edos.ai works
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        Every answer is calculated from this farm&apos;s own records — daily entries, stock movements, sales and the
        vaccination schedule.{" "}
        {model
          ? "A language model reads the question and chooses which calculations to run; the figures always come from your records, and each answer lists what it looked at."
          : "Each one shows the figures it used, so you can check the arithmetic rather than take it on trust."}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        It does not invent numbers, and it is not a veterinarian. Anything involving sick or dying birds ends with
        the same advice: call your animal health officer.
      </p>
    </div>
  );
}
