"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  History,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logout } from "@/app/login/actions";
import type { SidebarProductCategory } from "@/lib/product-queries";

interface DashboardSidebarNavProps {
  productTree: SidebarProductCategory[];
}

interface FilterHrefOptions {
  brand?: string;
  /** Exact model_type tab (sidebar). */
  type?: string;
  /** Series group tab (e.g. Galaxy S). */
  typePrefix?: string;
}

function buildFilterHref(category: string, options: FilterHrefOptions = {}): string {
  const params = new URLSearchParams();
  if (options.brand) params.set("brand", options.brand);
  if (options.type) params.set("type", options.type);
  if (options.typePrefix) params.set("typePrefix", options.typePrefix);

  const query = params.toString();
  return `/dashboard/products/${category}${query ? `?${query}` : ""}`;
}

function brandMenuLabel(category: string, brand: string, models: { model: string }[]): string {
  if (category === "phone-cases" && brand === "Other Phone Cases") {
    return "Other Phone Cases";
  }

  const lower = brand.toLowerCase();
  const hasIphone = models.some(({ model }) => /^iphone\b/i.test(model));
  const hasIpad = models.some(({ model }) => /^ipad\b/i.test(model));
  const hasPixel = models.some(({ model }) => /^pixel\b/i.test(model));

  if (category === "phone-cases") {
    if (lower === "apple" && hasIphone) return "iPhone Cases";
    if (lower === "samsung") return "Samsung Cases";
    if (lower === "google" && hasPixel) return "Google Pixel Cases";
    if (lower === "other" || lower === "universal") return "Universal Phone Case";
    return `${brand} Cases`;
  }

  if (category === "tablet-cases") {
    if (lower === "apple" && hasIpad) return "iPad Cases";
    return `${brand} Tablet Cases`;
  }

  return brand;
}

function modelSeries(brand: string, model: string): { label: string; query: string } | null {
  if (brand.toLowerCase() !== "samsung") return null;

  if (/^(galaxy\s+)?s\s*\d/i.test(model)) return { label: "Galaxy S Series", query: "Galaxy S" };
  if (/^(galaxy\s+)?a\s*\d/i.test(model)) return { label: "Galaxy A Series", query: "Galaxy A" };
  if (/^(galaxy\s+)?note/i.test(model)) return { label: "Galaxy Note Series", query: "Galaxy Note" };
  if (/^(galaxy\s+)?z/i.test(model)) return { label: "Galaxy Z Series", query: "Galaxy Z" };
  if (/^(galaxy\s+)?m\s*\d/i.test(model)) return { label: "Galaxy M Series", query: "Galaxy M" };

  return null;
}

function groupedModels(brand: string, models: { model: string }[]) {
  const groups = new Map<string, { label: string; query: string; models: { model: string }[] }>();
  const loose: { model: string }[] = [];

  for (const model of models) {
    const series = modelSeries(brand, model.model);
    if (!series) {
      loose.push(model);
      continue;
    }

    if (!groups.has(series.label)) {
      groups.set(series.label, { ...series, models: [] });
    }
    groups.get(series.label)!.models.push(model);
  }

  return {
    groups: Array.from(groups.values()),
    loose,
  };
}

export function DashboardSidebarNav({ productTree }: DashboardSidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isDashboardActive = pathname === "/dashboard";
  const isStockInActive = pathname === "/dashboard/stock-in";
  const isStockInHistoryActive = pathname.startsWith("/dashboard/stock-in/history");
  const isRepairsActive = pathname.startsWith("/dashboard/repairs");
  const activeBrand = searchParams.get("brand") ?? "";
  const activeType = searchParams.get("type") ?? "";
  const activeTypePrefix = searchParams.get("typePrefix") ?? "";
  const hasTypeFilter = Boolean(activeType || activeTypePrefix);

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
        <Link
          href="/dashboard/repairs"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isRepairsActive && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
        >
          <Wrench className="h-4 w-4" />
          Repair list
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
            const treeCategory = productTree.find((item) => item.category === slug);
            const hasChildren = Boolean(treeCategory?.brands.length);

            return (
              <details key={slug} className="group/category" open={isActive}>
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  {hasChildren ? (
                    <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open/category:rotate-90" />
                  ) : (
                    <span className="h-3 w-3 shrink-0" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <Link href={href} className="min-w-0 flex-1 truncate">
                    {label}
                  </Link>
                </summary>

                {treeCategory && (
                  <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l pl-2">
                    {treeCategory.brands.map(({ brand, models }) => {
                      const isOtherPhoneCases =
                        slug === "phone-cases" && brand === "Other Phone Cases";
                      const brandHref = isOtherPhoneCases
                        ? buildFilterHref(slug, { type: "Other Phone Cases" })
                        : buildFilterHref(slug, { brand });
                      const isBrandActive = isOtherPhoneCases
                        ? isActive && activeType === "Other Phone Cases"
                        : isActive && activeBrand === brand;
                      const brandLabel = brandMenuLabel(slug, brand, models);
                      const hideOnlyModel =
                        isOtherPhoneCases &&
                        models.length === 1 &&
                        models[0]?.model === "Other Phone Cases";
                      const { groups, loose } = hideOnlyModel
                        ? { groups: [], loose: [] }
                        : groupedModels(brand, models);
                      const hasBrandChildren = groups.length > 0 || loose.length > 0;

                      return (
                        <details
                          key={brand}
                          className="group/brand"
                          open={isBrandActive}
                        >
                          <summary
                            className={cn(
                              "flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              isBrandActive &&
                                !hasTypeFilter &&
                                "bg-sidebar-accent text-sidebar-accent-foreground"
                            )}
                          >
                            {hasBrandChildren ? (
                              <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open/brand:rotate-90" />
                            ) : (
                              <span className="h-3 w-3 shrink-0" />
                            )}
                            <Link href={brandHref} className="min-w-0 flex-1 truncate">
                              {brandLabel}
                            </Link>
                          </summary>

                          {hasBrandChildren && (
                          <div className="ml-4 flex flex-col gap-0.5">
                            {groups.map(({ label, query, models: groupModels }) => {
                              const seriesHref = buildFilterHref(slug, {
                                brand,
                                typePrefix: query,
                              });
                              const isSeriesActive =
                                isActive &&
                                activeBrand === brand &&
                                (activeTypePrefix === query ||
                                  groupModels.some(({ model }) => activeType === model));

                              return (
                                <details
                                  key={label}
                                  className="group/series"
                                  open={isSeriesActive}
                                >
                                  <summary
                                    className={cn(
                                      "flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                      isSeriesActive &&
                                        activeTypePrefix === query &&
                                        !activeType &&
                                        "bg-sidebar-accent text-sidebar-accent-foreground"
                                    )}
                                  >
                                    <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open/series:rotate-90" />
                                    <Link href={seriesHref} className="min-w-0 flex-1 truncate">
                                      {label}
                                    </Link>
                                  </summary>

                                  <div className="ml-4 flex flex-col gap-0.5">
                                    {groupModels.map(({ model }) => {
                                      const modelHref = buildFilterHref(slug, {
                                        brand,
                                        type: model,
                                      });
                                      const isModelActive =
                                        isActive &&
                                        activeBrand === brand &&
                                        activeType === model;

                                      return (
                                        <Link
                                          key={model}
                                          href={modelHref}
                                          className={cn(
                                            "truncate rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                            isModelActive &&
                                              "bg-sidebar-accent text-sidebar-accent-foreground"
                                          )}
                                          title={model}
                                        >
                                          {model}
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </details>
                              );
                            })}

                            {loose.map(({ model }) => {
                              const modelHref = buildFilterHref(slug, { brand, type: model });
                              const isModelActive =
                                isActive &&
                                activeBrand === brand &&
                                activeType === model;

                              return (
                                <Link
                                  key={model}
                                  href={modelHref}
                                  className={cn(
                                    "truncate rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    isModelActive &&
                                      "bg-sidebar-accent text-sidebar-accent-foreground"
                                  )}
                                  title={model}
                                >
                                  {model}
                                </Link>
                              );
                            })}
                          </div>
                          )}
                        </details>
                      );
                    })}
                  </div>
                )}
              </details>
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
