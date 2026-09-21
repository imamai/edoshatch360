import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * edos.ai's own face: the Hatch360 mark — the egg cut by the rising arc — in
 * a soft gold disc, standing in wherever a stock icon would otherwise mark
 * the assistant. On its own so the sidebar, which renders on every page, can
 * use it without importing the chat that goes with it.
 */
export function AssistantGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold", className)}>
      <LogoMark className="h-[60%] w-[60%]" />
    </span>
  );
}
