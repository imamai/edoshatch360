import { Eye } from "lucide-react";
import { stopViewingAsTenant } from "@/app/app/actions";
import { Button } from "@/components/ui/button";

/**
 * Unmistakable, on every page, whenever a platform admin is inside a farm
 * they do not belong to — see edoshatch360_admin_view_as and
 * SessionContext.isSupportView. There is no quiet way to be here: this bar
 * is the only thing that tells the admin (and anyone glancing at their
 * screen) that "the books" being read are a real farmer's, not the admin's
 * own account.
 */
export function ViewAsBanner({ tenantName }: { tenantName: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gold/40 bg-gold/15 px-4 py-2 text-sm sm:px-6 print:hidden">
      <Eye className="h-4 w-4 shrink-0 text-brand-darker" aria-hidden="true" />
      <p className="min-w-0 text-ink">
        Viewing <strong className="font-semibold">{tenantName}</strong> as EDOS
        support — read-only.
      </p>
      <form action={stopViewingAsTenant} className="ml-auto">
        <Button type="submit" size="sm" variant="secondary">
          Stop viewing
        </Button>
      </form>
    </div>
  );
}
