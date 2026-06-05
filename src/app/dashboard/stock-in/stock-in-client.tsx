"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import type { CategorySlug } from "@/lib/categories";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import { deriveProductModelType } from "@/lib/model-type";
import {
  generateStockReceiptInvoiceNumber,
  isValidStockReceiptInvoiceNumber,
} from "@/lib/stock-receipt-invoice";
import { submitStockReceiptAction } from "./actions";
import type { StockReceiptLineInput } from "@/types/database";
import {
  ColorVariantsEditor,
  newColorVariant,
  type ColorVariantRow,
} from "@/components/stock-in/color-variants-editor";
import {
  ExistingModelTypeStockEditor,
  type ExistingProductVariantRow,
} from "@/components/stock-in/existing-model-type-editor";
import { DeviceModelTypeField } from "@/components/stock-in/device-model-type-field";
import { SelectWithOtherField } from "@/components/stock-in/select-with-other-field";
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
  brand: string;
  model_type: string;
  model: string;
  sku: string;
  category: CategorySlug | string;
  cost_price: number;
  selling_price: number;
  storage_ram: string;
  condition: string;
  color_variants: ColorVariantRow[];
  existing_variants: ExistingProductVariantRow[];
}

function newLine(mode: LineMode = "existing"): LineRow {
  return {
    key: crypto.randomUUID(),
    mode,
    brand: "",
    model_type: "",
    model: "",
    sku: "",
    category: PRODUCT_CATEGORIES_SELECT[0]?.slug ?? "other",
    cost_price: 0,
    selling_price: 0,
    storage_ram: "",
    condition: "",
    color_variants: [newColorVariant()],
    existing_variants: [],
  };
}

function lineTotalQuantity(line: LineRow): number {
  if (line.mode === "existing") {
    return line.existing_variants.reduce((sum, v) => sum + (v.quantity_received || 0), 0);
  }
  return line.color_variants.reduce((sum, v) => sum + (v.quantity_received || 0), 0);
}

interface StockInClientProps {
  deviceModelTypeSuggestions?: string[];
  deviceModelTypesByCategory?: Record<string, string[]>;
  brandSuggestions?: string[];
}

export function StockInClient({
  deviceModelTypeSuggestions = [],
  deviceModelTypesByCategory = {},
  brandSuggestions = [],
}: StockInClientProps) {
  const router = useRouter();
  const [invoiceNumber, setInvoiceNumber] = useState(generateStockReceiptInvoiceNumber);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineRow[]>([newLine()]);
  const [isPending, startTransition] = useTransition();

  const totalQty = lines.reduce((sum, l) => sum + lineTotalQuantity(l), 0);

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  function handleModelBlur(lineKey: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== lineKey || l.model_type.trim()) return l;
        const derived = deriveProductModelType(l.brand, l.model, l.category);
        return derived ? { ...l, model_type: derived } : l;
      })
    );
  }

  function handleSubmit() {
    const receiptLines: StockReceiptLineInput[] = [];

    for (const line of lines) {
      if (line.mode === "existing") {
        for (const variant of line.existing_variants) {
          if (variant.quantity_received > 0) {
            receiptLines.push({
              mode: "existing",
              product_id: variant.product_id,
              quantity_received: variant.quantity_received,
            });
          }
        }
        continue;
      }

      receiptLines.push({
        mode: "new",
        brand: line.brand.trim(),
        model_type: line.model_type.trim() || undefined,
        model: line.model.trim(),
        base_sku: line.sku.trim() || undefined,
        category: line.category,
        cost_price: line.cost_price,
        selling_price: line.selling_price,
        storage_ram: line.storage_ram.trim() || undefined,
        condition: line.condition.trim() || undefined,
        color_variants: line.color_variants.map((v) => ({
          color: v.color.trim(),
          quantity_received: v.quantity_received,
          sku: v.sku.trim() || undefined,
        })),
      });
    }

    if (receiptLines.length === 0) {
      toast.error("Add at least one line with quantity received");
      return;
    }

    const invoice = invoiceNumber.trim();
    if (!isValidStockReceiptInvoiceNumber(invoice)) {
      toast.error("Invoice must use format MM-DD-YYYY-XXXXXX");
      return;
    }

    const payload = {
      invoice_number: invoice,
      note: note.trim() || undefined,
      lines: receiptLines,
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
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="invoice">Invoice / reference number</Label>
            <div className="flex gap-2">
              <Input
                id="invoice"
                className="font-mono"
                placeholder="06-02-2026-A3F9K2"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => setInvoiceNumber(generateStockReceiptInvoiceNumber())}
                aria-label="Generate new invoice number"
                title="Generate new number"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Format: MM-DD-YYYY-XXXXXX (6 random uppercase letters or digits). Auto-generated on load.
            </p>
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
                    updateLine(line.key, {
                      mode: v as LineMode,
                      color_variants:
                        v === "new" ? [newColorVariant()] : line.color_variants,
                      existing_variants: v === "existing" ? [] : line.existing_variants,
                    })
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
                  <ExistingModelTypeStockEditor
                    modelType={line.model_type}
                    modelTypeSuggestions={deviceModelTypeSuggestions}
                    onModelTypeChange={(model_type) => updateLine(line.key, { model_type })}
                    variants={line.existing_variants}
                    onVariantsChange={(existing_variants) =>
                      updateLine(line.key, { existing_variants })
                    }
                  />
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
                    <Label>Base SKU (optional)</Label>
                    <Input
                      value={line.sku}
                      onChange={(e) => updateLine(line.key, { sku: e.target.value })}
                      placeholder="iphone-17-case"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used to auto-generate per-color SKUs when left blank on a color row.
                    </p>
                  </div>
                  <SelectWithOtherField
                    label="Brand"
                    options={brandSuggestions}
                    value={line.brand}
                    onChange={(brand) => updateLine(line.key, { brand })}
                    selectPlaceholder="Select brand"
                    otherPlaceholder="Enter brand name"
                  />
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input
                      value={line.model}
                      onChange={(e) => updateLine(line.key, { model: e.target.value })}
                      onBlur={() => handleModelBlur(line.key)}
                    />
                  </div>
                  <DeviceModelTypeField
                    value={line.model_type}
                    options={
                      deviceModelTypesByCategory[line.category]?.length
                        ? deviceModelTypesByCategory[line.category]
                        : deviceModelTypeSuggestions
                    }
                    onChange={(model_type) => updateLine(line.key, { model_type })}
                  />
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
                    <Label>Condition</Label>
                    <Input
                      value={line.condition}
                      onChange={(e) => updateLine(line.key, { condition: e.target.value })}
                    />
                  </div>
                  <ColorVariantsEditor
                    variants={line.color_variants}
                    onChange={(color_variants) => updateLine(line.key, { color_variants })}
                  />
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
