import { Eye } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

/**
 * Shown in place of a form when the signed-in account cannot write here.
 *
 * RLS already refuses the write, but discovering that after filling in a
 * form is a bad way to learn it — particularly on the shared demo account,
 * where read-only is the whole point rather than a fault.
 */
export function ReadOnlyNotice({
  what,
  tenantName,
}: {
  what: string;
  tenantName: string;
}) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunk text-ink-faint">
          <Eye className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            You have read-only access to {tenantName}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {what} needs an account that can make changes — an owner, manager,
            supervisor or worker. You can look through every screen here; nothing
            you do will alter the records.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            If this is the shared demonstration farm, that is deliberate: it keeps
            the example intact for everyone else looking at it. Create your own farm
            to record real data.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

/** Inline variant for a page that is otherwise usable. */
export function ReadOnlyBadge({ tenantName }: { tenantName: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunk px-3 py-2 text-xs text-ink-soft">
      <Eye className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
      Read-only access to {tenantName} — you can look, but nothing here will change
      the records.
    </p>
  );
}
