import { DashboardSidebarNav } from "@/components/dashboard-sidebar-nav";
import { fetchSidebarProductTree } from "@/lib/product-queries";

export async function DashboardSidebar() {
  const { data: productTree } = await fetchSidebarProductTree();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <span className="text-lg font-bold tracking-tight">Inventory</span>
      </div>
      <DashboardSidebarNav productTree={productTree} />
    </aside>
  );
}
