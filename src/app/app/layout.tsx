import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { getTenantPlan } from "@/lib/data/plan";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { BottomNav } from "@/components/app/bottom-nav";
import { OfflineProvider } from "@/components/app/offline-provider";
import { RegisterServiceWorker } from "@/components/app/register-sw";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const plan = await getTenantPlan(session.tenant.id);
  const canWrite = can(session.role, CAN_WRITE);

  const supabase = await createClient();
  const { count } = await supabase
    .from("edoshatch360_notifications")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", session.tenant.id)
    .eq("is_read", false)
    .eq("is_archived", false);

  return (
    <OfflineProvider>
      <RegisterServiceWorker />
      {/* .app-ui switches the working application onto its own typographic
          scale — see globals.css. The marketing site keeps its own. */}
      <div className="app-ui flex min-h-screen bg-canvas">
        <Sidebar role={session.role} mode={session.mode} canWrite={canWrite} plan={plan.code} isPlatformAdmin={session.isPlatformAdmin} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            tenants={session.tenants}
            activeTenantId={session.tenant.id}
            activeTenantName={session.tenant.name}
            userName={session.user.full_name ?? session.user.email ?? "You"}
            userEmail={session.user.email ?? ""}
            role={session.role}
            unreadCount={count ?? 0}
          />

          {/* pb-24 on mobile clears the fixed bottom bar and the floating action. */}
          <main className="flex-1 px-4 pt-5 pb-24 sm:px-6 md:pb-8">{children}</main>
        </div>

        <BottomNav canWrite={canWrite} />
      </div>
    </OfflineProvider>
  );
}
