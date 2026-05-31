"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Search } from "lucide-react";
import type { Product } from "@/types/database";
import { formatAUD } from "@/lib/utils";
import { adjustStock } from "./actions";
import { AddProductDialog } from "./add-product-dialog";
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

interface ProductClientProps {
  products: Product[];
}

export function ProductClient({ products: initialProducts }: ProductClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const brands = useMemo(() => {
    const set = new Set(products.map((p) => p.brand).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchesBrand = brandFilter === "all" || p.brand === brandFilter;
      const matchesLowStock =
        !lowStockOnly || (p.quantity > 0 && p.quantity < 3);
      return matchesSearch && matchesBrand && matchesLowStock;
    });
  }, [products, search, brandFilter, lowStockOnly]);

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
          ? `Đã tăng tồn kho: ${product.sku}`
          : `Đã giảm tồn kho: ${product.sku}`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sản phẩm</h1>
          <p className="text-muted-foreground">
            {filtered.length} / {products.length} sản phẩm
          </p>
        </div>
        <AddProductDialog />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo brand, model, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả brand</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="low-stock"
            checked={lowStockOnly}
            onCheckedChange={setLowStockOnly}
          />
          <Label htmlFor="low-stock" className="text-sm whitespace-nowrap">
            Tồn thấp (&lt;3)
          </Label>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Ảnh</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Storage/RAM</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Sell</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-center w-28">Adjust</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  Không có sản phẩm phù hợp
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((product) => {
                const isLowStock =
                  product.quantity > 0 && product.quantity < 3;
                const isPending = pendingId === product.id;

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.model}
                          width={40}
                          height={40}
                          className="rounded object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{product.brand}</TableCell>
                    <TableCell>{product.model}</TableCell>
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
                      <div className="flex items-center justify-center gap-1">
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
