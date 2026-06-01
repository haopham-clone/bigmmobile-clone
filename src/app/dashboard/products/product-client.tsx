"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Minus, Plus, Search } from "lucide-react";
import type { Product } from "@/types/database";
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

type SortOption = "updated_desc" | "updated_asc" | "stock_desc" | "stock_asc";

interface ProductClientProps {
  products: Product[];
  activeCategory: string;
  categoryLabel: string;
  defaultCategory: string;
}

function sortProducts(list: Product[], sortBy: SortOption): Product[] {
  const sorted = [...list];
  switch (sortBy) {
    case "updated_asc":
      return sorted.sort(
        (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
    case "stock_desc":
      return sorted.sort((a, b) => b.quantity - a.quantity || a.model.localeCompare(b.model));
    case "stock_asc":
      return sorted.sort((a, b) => a.quantity - b.quantity || a.model.localeCompare(b.model));
    case "updated_desc":
    default:
      return sorted.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
  }
}

export function ProductClient({
  products: initialProducts,
  activeCategory,
  categoryLabel,
  defaultCategory,
}: ProductClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated_desc");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [hideZeroStock, setHideZeroStock] = useState(false);
  const [hideInactive, setHideInactive] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const brands = useMemo(() => {
    const set = new Set(products.map((p) => p.brand).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const list = products.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchesBrand = brandFilter === "all" || p.brand === brandFilter;
      const matchesLowStock =
        !lowStockOnly || (p.quantity > 0 && p.quantity < 3);
      const matchesZeroStock = !hideZeroStock || p.quantity > 0;
      const matchesActive = !hideInactive || p.is_active;
      return (
        matchesSearch &&
        matchesBrand &&
        matchesLowStock &&
        matchesZeroStock &&
        matchesActive
      );
    });

    return sortProducts(list, sortBy);
  }, [
    products,
    search,
    brandFilter,
    sortBy,
    lowStockOnly,
    hideZeroStock,
    hideInactive,
  ]);

  function handleAdjust(product: Product, delta: number) {
    const prevQty = product.quantity;
    const optimisticQty = Math.max(0, prevQty + delta);

    if (optimisticQty === prevQty) return;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, quantity: optimisticQty } : p
      )
    );
    setPendingId(product.id);

    startTransition(async () => {
      const result = await adjustStock(product.id, delta);
      setPendingId(null);

      if (result.error) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, quantity: prevQty } : p
          )
        );
        toast.error(result.error);
        return;
      }

      toast.success(
        delta > 0
          ? `Stock increased: ${product.sku}`
          : `Stock decreased: ${product.sku}`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{categoryLabel}</h1>
          <p className="text-muted-foreground">
            {filtered.length} / {products.length} products
            {activeCategory !== "all" && (
              <span className="text-muted-foreground"> in this category</span>
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
              placeholder="Search by brand, model, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
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
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
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
              onCheckedChange={setLowStockOnly}
            />
            <Label htmlFor="low-stock" className="text-sm whitespace-nowrap">
              Low stock (&lt;3)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="hide-zero"
              checked={hideZeroStock}
              onCheckedChange={setHideZeroStock}
            />
            <Label htmlFor="hide-zero" className="text-sm whitespace-nowrap">
              Hide zero stock
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="hide-inactive"
              checked={hideInactive}
              onCheckedChange={setHideInactive}
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
              <TableHead className="w-20">Image</TableHead>
              <TableHead>Brand</TableHead>
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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  No matching products
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((product) => {
                const isLowStock =
                  product.quantity > 0 && product.quantity < 3;
                const isPending = pendingId === product.id;
                const detailHref = `/dashboard/products/item/${product.id}`;

                return (
                  <TableRow
                    key={product.id}
                    className={`cursor-pointer ${!product.is_active ? "opacity-60" : ""}`}
                    onClick={() => router.push(detailHref)}
                  >
                    <TableCell>
                      <Link
                        href={detailHref}
                        className="block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {product.image_url ? (
                          <div className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
                            <Image
                              src={product.image_url}
                              alt={product.model}
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-md border bg-muted" />
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{product.brand}</TableCell>
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
                          <Badge variant="destructive" className="text-[10px] px-1">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          asChild
                        >
                          <Link href={detailHref} aria-label="View product details">
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
