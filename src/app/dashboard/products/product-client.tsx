"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Search } from "lucide-react";
import type { Product, ProductSortOption } from "@/types/database";
import { formatAUD } from "@/lib/utils";
import { adjustStock } from "./actions";
import { AddProductDialog } from "./add-product-dialog";
import { EditProductDialog } from "./edit-product-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ProductListUiFilters {
  search: string;
  brand: string;
  sort: ProductSortOption;
  lowStockOnly: boolean;
  hideZeroStock: boolean;
  hideInactive: boolean;
}

interface ProductClientProps {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  brands: string[];
  activeCategory: string;
  categoryLabel: string;
  defaultCategory: string;
  initialFilters: ProductListUiFilters;
}

interface ProductGroup {
  key: string;
  label: string;
  products: Product[];
}

const SEARCH_DEBOUNCE_MS = 2000;

function ProductThumbnail({
  product,
  href,
  indent = false,
}: {
  product: Product;
  href?: string;
  indent?: boolean;
}) {
  const image = product.image_url ? (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
      <Image
        src={product.image_url}
        alt={product.model}
        fill
        className="object-contain p-1"
        unoptimized
      />
    </div>
  ) : (
    <div className="h-16 w-16 shrink-0 rounded-md border bg-muted" />
  );

  const content = (
    <div className={`flex items-center gap-2 ${indent ? "pl-2" : ""}`}>
      {image}
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block" onClick={(e) => e.stopPropagation()}>
      {content}
    </Link>
  );
}

function buildQueryString(
  base: ProductListUiFilters & { page: number }
): string {
  const params = new URLSearchParams();
  if (base.page > 1) params.set("page", String(base.page));
  if (base.search.trim()) params.set("q", base.search.trim());
  if (base.brand && base.brand !== "all") params.set("brand", base.brand);
  if (base.sort !== "updated_desc") params.set("sort", base.sort);
  if (base.lowStockOnly) params.set("lowStock", "1");
  if (base.hideZeroStock) params.set("hideZero", "1");
  if (!base.hideInactive) params.set("hideInactive", "0");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function ProductClient({
  products: initialProducts,
  total,
  page,
  pageSize,
  totalPages,
  brands,
  activeCategory,
  categoryLabel,
  defaultCategory,
  initialFilters,
}: ProductClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [products, setProducts] = useState(initialProducts);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [brandFilter, setBrandFilter] = useState(initialFilters.brand);
  const [sortBy, setSortBy] = useState<ProductSortOption>(initialFilters.sort);
  const [lowStockOnly, setLowStockOnly] = useState(initialFilters.lowStockOnly);
  const [hideZeroStock, setHideZeroStock] = useState(initialFilters.hideZeroStock);
  const [hideInactive, setHideInactive] = useState(initialFilters.hideInactive);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    setSearchInput(initialFilters.search);
    setBrandFilter(initialFilters.brand);
    setSortBy(initialFilters.sort);
    setLowStockOnly(initialFilters.lowStockOnly);
    setHideZeroStock(initialFilters.hideZeroStock);
    setHideInactive(initialFilters.hideInactive);
  }, [initialFilters]);

  const pushFilters = useCallback(
    (overrides: Partial<ProductListUiFilters & { page: number }>) => {
      const next = {
        search: overrides.search ?? searchInput,
        brand: overrides.brand ?? brandFilter,
        sort: overrides.sort ?? sortBy,
        lowStockOnly: overrides.lowStockOnly ?? lowStockOnly,
        hideZeroStock: overrides.hideZeroStock ?? hideZeroStock,
        hideInactive: overrides.hideInactive ?? hideInactive,
        page: overrides.page ?? 1,
      };
      router.push(`${pathname}${buildQueryString(next)}`);
    },
    [
      router,
      pathname,
      searchInput,
      brandFilter,
      sortBy,
      lowStockOnly,
      hideZeroStock,
      hideInactive,
    ]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== initialFilters.search) {
        pushFilters({ search: searchInput, page: 1 });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, initialFilters.search, pushFilters]);

  function handleAdjust(product: Product, delta: number) {
    const prevQty = product.quantity;
    const optimisticQty = Math.max(0, prevQty + delta);
    if (optimisticQty === prevQty) return;

    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, quantity: optimisticQty } : p))
    );
    setPendingId(product.id);

    startTransition(async () => {
      const result = await adjustStock(product.id, delta);
      setPendingId(null);
      if (result.error) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, quantity: prevQty } : p))
        );
        toast.error(result.error);
        return;
      }
      toast.success(
        delta > 0 ? `Stock increased: ${product.sku}` : `Stock decreased: ${product.sku}`
      );
      router.refresh();
    });
  }

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);
  const groupedProducts: ProductGroup[] = [];
  const groupsByKey = new Map<string, ProductGroup>();
  for (const product of products) {
    const key = [
      product.brand,
      product.model_type ?? "",
      product.model,
      product.category,
      product.storage_ram ?? "",
      product.condition ?? "",
    ].join("||");
    const label = `${product.brand}||${product.model_type ?? ""}||${product.model}`;
    const existing = groupsByKey.get(key);
    if (existing) {
      existing.products.push(product);
    } else {
      const group: ProductGroup = { key, label, products: [product] };
      groupsByKey.set(key, group);
      groupedProducts.push(group);
    }
  }

  function toggleGroup(groupKey: string) {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{categoryLabel}</h1>
          <p className="text-muted-foreground">
            {total.toLocaleString("en-AU")} products
            {activeCategory !== "all" && " in this category"}
            {total > 0 && (
              <span>
                {" "}
                · showing {showingFrom}–{showingTo}
              </span>
            )}
          </p>
        </div>
        <AddProductDialog defaultCategory={defaultCategory} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by brand, type (e.g. iPhone 17 PRO MAX), SKU..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={brandFilter}
            onValueChange={(v) => {
              setBrandFilter(v);
              pushFilters({ brand: v, page: 1 });
            }}
          >
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortBy}
            onValueChange={(v) => {
              setSortBy(v as ProductSortOption);
              pushFilters({ sort: v as ProductSortOption, page: 1 });
            }}
          >
            <SelectTrigger className="w-full lg:w-52">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">Updated (newest)</SelectItem>
              <SelectItem value="updated_asc">Updated (oldest)</SelectItem>
              <SelectItem value="stock_desc">Stock (high → low)</SelectItem>
              <SelectItem value="stock_asc">Stock (low → high)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id="low-stock"
              checked={lowStockOnly}
              onCheckedChange={(v) => {
                setLowStockOnly(v);
                pushFilters({ lowStockOnly: v, page: 1 });
              }}
            />
            <Label htmlFor="low-stock" className="text-sm whitespace-nowrap">
              Low stock (&lt;3)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="hide-zero"
              checked={hideZeroStock}
              onCheckedChange={(v) => {
                setHideZeroStock(v);
                pushFilters({ hideZeroStock: v, page: 1 });
              }}
            />
            <Label htmlFor="hide-zero" className="text-sm whitespace-nowrap">
              Hide zero stock
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="hide-inactive"
              checked={hideInactive}
              onCheckedChange={(v) => {
                setHideInactive(v);
                pushFilters({ hideInactive: v, page: 1 });
              }}
            />
            <Label htmlFor="hide-inactive" className="text-sm whitespace-nowrap">
              Hide inactive
            </Label>
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Image</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Storage/RAM</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Sell</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-center w-36">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="h-24 text-center text-muted-foreground">
                  No matching products
                </TableCell>
              </TableRow>
            ) : (
              groupedProducts.flatMap((group) => {
                const first = group.products[0];
                const isExpanded = expandedGroups[group.key] ?? false;
                const totalQty = group.products.reduce((sum, p) => sum + p.quantity, 0);
                const activeCount = group.products.filter((p) => p.is_active).length;
                const hasVariants = group.products.length > 1;
                const summaryDetailHref = `/dashboard/products/item/${first.id}`;

                const summaryRow = (
                  <TableRow key={`group-${group.key}`} className="bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProductThumbnail product={first} href={summaryDetailHref} />
                        {hasVariants ? (
                          <button
                            type="button"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background hover:bg-muted"
                            onClick={() => toggleGroup(group.key)}
                            aria-label={isExpanded ? "Collapse variants" : "Expand variants"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{first.brand}</TableCell>
                    <TableCell>{first.model_type ?? "—"}</TableCell>
                    <TableCell>
                      <Link href={summaryDetailHref} className="font-semibold hover:underline">
                        {first.model}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {group.products.length} variant{group.products.length === 1 ? "" : "s"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {activeCount === group.products.length ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">
                          {activeCount}/{group.products.length} active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{first.storage_ram ?? "—"}</TableCell>
                    <TableCell>All colors</TableCell>
                    <TableCell>{first.condition ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">Grouped</TableCell>
                    <TableCell className="text-right">{formatAUD(Number(first.cost_price))}</TableCell>
                    <TableCell className="text-right">
                      {formatAUD(Number(first.selling_price))}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold">{totalQty}</span>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      Expand to edit
                    </TableCell>
                  </TableRow>
                );

                if (!isExpanded) {
                  return [summaryRow];
                }

                const variantRows = group.products.map((product) => {
                  const isLowStock = product.quantity > 0 && product.quantity < 3;
                  const isPending = pendingId === product.id;
                  const detailHref = `/dashboard/products/item/${product.id}`;

                  return (
                    <TableRow
                      key={product.id}
                      className={`cursor-pointer ${!product.is_active ? "opacity-60" : ""}`}
                      onClick={() => router.push(detailHref)}
                    >
                      <TableCell>
                        <ProductThumbnail product={product} href={detailHref} indent />
                      </TableCell>
                      <TableCell className="font-medium">{product.brand}</TableCell>
                      <TableCell>{product.model_type ?? "—"}</TableCell>
                      <TableCell>
                        <Link
                          href={detailHref}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {product.model}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {product.is_active ? (
                          <Badge variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{product.storage_ram ?? "—"}</TableCell>
                      <TableCell>{product.color ?? "—"}</TableCell>
                      <TableCell>{product.condition ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell className="text-right">
                        {formatAUD(Number(product.cost_price))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAUD(Number(product.selling_price))}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-semibold">{product.quantity}</span>
                          {isLowStock && (
                            <Badge variant="destructive" className="px-1 text-[10px]">
                              Low
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center justify-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EditProductDialog product={product} variant="icon" />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={isPending || product.quantity === 0}
                            onClick={() => handleAdjust(product, -1)}
                            aria-label="Decrease stock"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={isPending}
                            onClick={() => handleAdjust(product, 1)}
                            aria-label="Increase stock"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link href={detailHref} aria-label="View product details">
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                });

                return [summaryRow, ...variantRows];
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => pushFilters({ page: page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => pushFilters({ page: page + 1 })}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
