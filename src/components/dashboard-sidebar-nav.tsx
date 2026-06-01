"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, LayoutDashboard, LogOut, PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logout } from "@/app/login/actions";

export function DashboardSidebarNav() {
  const pathname = usePathname();

  const isDashboardActive = pathname === "/dashboard";
  const isStockInActive = pathname === "/dashboard/stock-in";
  const isStockInHistoryActive = pathname.startsWith("/dashboard/stock-in/history");

  return (
    <>
      <nav className="flex shrink-0 flex-col gap-1 p-3">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isDashboardActive && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        <Link
          href="/dashboard/stock-in"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isStockInActive && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
        >
          <PackagePlus className="h-4 w-4" />
          Stock In
        </Link>
        <Link
          href="/dashboard/stock-in/history"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isStockInHistoryActive && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
        >
          <History className="h-4 w-4" />
          Receipt History
        </Link>
      </nav>

      <Separator />

      <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-2">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Categories
        </p>
        <nav className="flex flex-col gap-0.5">
          {SIDEBAR_CATEGORIES.map(({ slug, label, icon: Icon }) => {
            const href = `/dashboard/products/${slug}`;
            const isActive = pathname === href;

            return (
              <Link
                key={slug}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <Separator />

      <div className="shrink-0 p-3">
        <form action={logout}>
          <Button variant="ghost" className="w-full justify-start gap-3" type="submit">
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </form>
      </div>
    </>
  );
}
