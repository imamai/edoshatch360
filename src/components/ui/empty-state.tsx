import { cn } from "@/lib/utils";

/**
 * Never show a blank screen (spec §54). An empty state says what would be
 * here, why it matters, and offers the one action that fills it.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  framed = true,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Dashed outline marking the space the content will occupy. */
  framed?: boolean;
}) {
  return (
    <div className={cn(framed && "p-4", className)}>
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
          framed && "empty-frame",
        )}
      >
        {icon && (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-sunk text-ink-faint">
            {icon}
          </span>
        )}
        <div className="max-w-sm">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{description}</p>
          )}
        </div>
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}
