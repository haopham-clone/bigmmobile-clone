"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ColorVariantRow {
  key: string;
  color: string;
  quantity_received: number;
  sku: string;
}

interface ColorVariantsEditorProps {
  variants: ColorVariantRow[];
  onChange: (variants: ColorVariantRow[]) => void;
}

export function newColorVariant(): ColorVariantRow {
  return {
    key: crypto.randomUUID(),
    color: "",
    quantity_received: 1,
    sku: "",
  };
}

export function ColorVariantsEditor({ variants, onChange }: ColorVariantsEditorProps) {
  function updateVariant(key: string, patch: Partial<ColorVariantRow>) {
    onChange(variants.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  function removeVariant(key: string) {
    if (variants.length <= 1) return;
    onChange(variants.filter((v) => v.key !== key));
  }

  function addVariant() {
    onChange([...variants, newColorVariant()]);
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <Label>Color variants</Label>
        <Button type="button" variant="outline" size="sm" onClick={addVariant}>
          <Plus className="h-4 w-4" />
          Add color
        </Button>
      </div>
      <div className="space-y-2 rounded-md border p-3">
        <div className="hidden gap-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_6rem_1fr_2rem]">
          <span>Color</span>
          <span>Qty</span>
          <span>SKU (optional)</span>
          <span />
        </div>
        {variants.map((variant) => (
          <div
            key={variant.key}
            className="grid gap-2 sm:grid-cols-[1fr_6rem_1fr_2rem] sm:items-end"
          >
            <div className="space-y-1">
              <Label className="text-xs sm:sr-only">Color</Label>
              <Input
                value={variant.color}
                onChange={(e) => updateVariant(variant.key, { color: e.target.value })}
                placeholder="Black"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs sm:sr-only">Qty</Label>
              <Input
                type="number"
                min={1}
                value={variant.quantity_received}
                onChange={(e) =>
                  updateVariant(variant.key, {
                    quantity_received: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs sm:sr-only">SKU (optional)</Label>
              <Input
                value={variant.sku}
                onChange={(e) => updateVariant(variant.key, { sku: e.target.value })}
                placeholder="Auto if blank"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={variants.length <= 1}
              onClick={() => removeVariant(variant.key)}
              aria-label="Remove color"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
