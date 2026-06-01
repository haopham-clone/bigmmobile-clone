"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import type { Product } from "@/types/database";
import { getCategoryLabel, isHiddenCategory } from "@/lib/categories";
import { formatAUD } from "@/lib/utils";
import { adjustStock, toggleProductActive } from "../../actions";
import { EditProductDialog } from "../../edit-product-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ProductDetailClientProps {
  product: Product;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium sm:text-right">{value}</dd>
    </div>
  );
}

export function ProductDetailClient({ product: initialProduct }: ProductDetailClientProps) {
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProduct(initialProduct);
  }, [initialProduct]);

  const isLowStock = product.quantity > 0 && product.quantity < 3;
  const backHref = isHiddenCategory(product.category)
    ? "/dashboard/products/all"
    : `/dashboard/products/${product.category}`;

  function handleToggleActive() {
    const nextActive = !product.is_active;
    setProduct((p) => ({ ...p, is_active: nextActive }));

    startTransition(async () => {
      const result = await toggleProductActive(product.id, nextActive);
      if (result.error) {
        setProduct((p) => ({ ...p, is_active: !nextActive }));
        toast.error(result.error);
        return;
      }
      toast.success(nextActive ? "Product activated" : "Product deactivated");
      router.refresh();
    });
  }

  function handleAdjust(delta: number) {
    const prevQty = product.quantity;
    const optimisticQty = Math.max(0, prevQty + delta);
    if (optimisticQty === prevQty) return;

    setProduct((p) => ({ ...p, quantity: optimisticQty }));

    startTransition(async () => {
      const result = await adjustStock(product.id, delta);
      if (result.error) {
        setProduct((p) => ({ ...p, quantity: prevQty }));
        toast.error(result.error);
        return;
      }
      toast.success(delta > 0 ? "Stock increased" : "Stock decreased");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2 gap-2" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Back to {getCategoryLabel(isHiddenCategory(product.category) ? "all" : (product.category as never))}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {product.brand} {product.model}
            </h1>
            <p className="font-mono text-sm text-muted-foreground">{product.sku}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditProductDialog product={product} />
          <Button
            variant={product.is_active ? "outline" : "secondary"}
            disabled={isPending}
            onClick={handleToggleActive}
          >
            {product.is_active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {product.image_url ? (
              <div className="relative aspect-square w-full bg-muted">
                <Image
                  src={product.image_url}
                  alt={product.model}
                  fill
                  className="object-contain p-4"
                  sizes="(max-width: 1024px) 100vw, 420px"
                  unoptimized
                  priority
                />
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground">
                No image
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{getCategoryLabel(product.category as never)}</Badge>
              {product.is_active ? (
                <Badge variant="secondary">Active</Badge>
              ) : (
                <Badge variant="outline">Inactive</Badge>
              )}
              {isLowStock && <Badge variant="destructive">Low stock</Badge>}
              {product.quantity === 0 && <Badge variant="outline">Out of stock</Badge>}
            </div>

            <dl className="space-y-4">
              <DetailRow label="Brand" value={product.brand} />
              <DetailRow label="Model" value={product.model} />
              <DetailRow label="Storage / RAM" value={product.storage_ram ?? "—"} />
              <DetailRow label="Color" value={product.color ?? "—"} />
              <DetailRow label="Condition" value={product.condition ?? "—"} />
              <Separator />
              <DetailRow label="Cost price" value={formatAUD(Number(product.cost_price))} />
              <DetailRow label="Selling price" value={formatAUD(Number(product.selling_price))} />
              <DetailRow
                label="Margin"
                value={formatAUD(Number(product.selling_price) - Number(product.cost_price))}
              />
              <Separator />
              <DetailRow
                label="In stock"
                value={
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isPending || product.quantity === 0}
                      onClick={() => handleAdjust(-1)}
                      aria-label="Decrease stock"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="min-w-8 text-center text-lg font-semibold">
                      {product.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isPending}
                      onClick={() => handleAdjust(1)}
                      aria-label="Increase stock"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
              <DetailRow
                label="Status"
                value={product.is_active ? "Active" : "Inactive"}
              />
              <DetailRow
                label="Last updated"
                value={new Date(product.updated_at).toLocaleString("en-AU")}
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
