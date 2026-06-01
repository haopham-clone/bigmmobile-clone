"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { CategorySlug } from "@/lib/categories";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import { submitStockReceiptAction } from "./actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type LineMode = "existing" | "new";

interface LineRow {
  key: string;
  mode: LineMode;
  product_id: string;
  quantity_received: number;
  brand: string;
  model: string;
  sku: string;
  category: CategorySlug | string;
  cost_price: number;
  selling_price: number;
  storage_ram: string;
  color: string;
  condition: string;
}

function newLine(mode: LineMode = "existing"): LineRow {
  return {
    key: crypto.randomUUID(),
    mode,
    product_id: "",
    quantity_received: 1,
    brand: "",
    model: "",
    sku: "",
    category: PRODUCT_CATEGORIES_SELECT[0]?.slug ?? "other",
    cost_price: 0,
    selling_price: 0,
    storage_ram: "",
    color: "",
    condition: "",
  };
}

export function StockInClient() {
  const router = useRouter();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineRow[]>([newLine()]);
  const [isPending, startTransition] = useTransition();

  const totalQty = lines.reduce((sum, l) => sum + (l.quantity_received || 0), 0);

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  function handleSubmit() {
    const payload = {
      invoice_number: invoiceNumber.trim() || undefined,
      note: note.trim() || undefined,
      lines: lines.map((line) => {
        if (line.mode === "existing") {
          return {
            mode: "existing" as const,
            product_id: line.product_id,
            quantity_received: line.quantity_received,
          };
        }
        return {
          mode: "new" as const,
          quantity_received: line.quantity_received,
          brand: line.brand.trim(),
          model: line.model.trim(),
          sku: line.sku.trim(),
          category: line.category,
          cost_price: line.cost_price,
          selling_price: line.selling_price,
          storage_ram: line.storage_ram.trim() || undefined,
          color: line.color.trim() || undefined,
          condition: line.condition.trim() || undefined,
        };
      }),
    };

    startTransition(async () => {
      const result = await submitStockReceiptAction(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock received successfully");
      if (result.receiptId) {
        router.push(`/dashboard/stock-in/history/${result.receiptId}`);
      } else {
        router.push("/dashboard/stock-in/history");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipt details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invoice">Invoice / reference number</Label>
            <Input
              id="invoice"
              placeholder="INV-2026-001"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="note">Notes</Label>
            <Textarea
              id="note"
              placeholder="Optional notes about this receipt..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Line items</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((prev) => [...prev, newLine("existing")])}
            >
              <Plus className="h-4 w-4" />
              Existing product
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((prev) => [...prev, newLine("new")])}
            >
              <Plus className="h-4 w-4" />
              New product
            </Button>
          </div>
        </div>

        {lines.map((line, index) => (
          <Card key={line.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Line {index + 1}</CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={line.mode}
                  onValueChange={(v) =>
                    updateLine(line.key, { mode: v as LineMode, product_id: "" })
                  }
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Existing</SelectItem>
                    <SelectItem value="new">New product</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={lines.length <= 1}
                  onClick={() => removeLine(line.key)}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {line.mode === "existing" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Product</Label>
                    <ProductSearchSelect
                      value={line.product_id}
                      onChange={(productId) => updateLine(line.key, { product_id: productId })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity received</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity_received}
                      onChange={(e) =>
                        updateLine(line.key, {
                          quantity_received: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={line.category}
                      onValueChange={(v) => updateLine(line.key, { category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_CATEGORIES_SELECT.map(({ slug, label }) => (
                          <SelectItem key={slug} value={slug}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input
                      value={line.sku}
                      onChange={(e) => updateLine(line.key, { sku: e.target.value })}
                      placeholder="unique-sku"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Input
                      value={line.brand}
                      onChange={(e) => updateLine(line.key, { brand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input
                      value={line.model}
                      onChange={(e) => updateLine(line.key, { model: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost (AUD)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.cost_price}
                      onChange={(e) =>
                        updateLine(line.key, { cost_price: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sell (AUD)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.selling_price}
                      onChange={(e) =>
                        updateLine(line.key, { selling_price: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Storage / RAM</Label>
                    <Input
                      value={line.storage_ram}
                      onChange={(e) => updateLine(line.key, { storage_ram: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      value={line.color}
                      onChange={(e) => updateLine(line.key, { color: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Quantity received</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity_received}
                      onChange={(e) =>
                        updateLine(line.key, {
                          quantity_received: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {lines.length} line{lines.length !== 1 ? "s" : ""} · {totalQty} units total
        </p>
        <Button size="lg" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving..." : "Submit receipt"}
        </Button>
      </div>
    </div>
  );
}
