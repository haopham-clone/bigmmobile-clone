"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { listProductsByModelTypeForStockIn } from "@/app/dashboard/stock-in/actions";
import {
  ModelTypeAutocomplete,
  type StockInModelSelection,
} from "@/components/stock-in/model-type-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ExistingProductVariantRow {
  key: string;
  product_id: string;
  color: string;
  model: string;
  sku: string;
  quantity_on_hand: number;
  quantity_received: number;
}

interface ExistingModelTypeStockEditorProps {
  modelType: string;
  modelTypeSuggestions?: string[];
  onModelTypeChange: (modelType: string) => void;
  variants: ExistingProductVariantRow[];
  onVariantsChange: (variants: ExistingProductVariantRow[]) => void;
}

export function ExistingModelTypeStockEditor({
  modelType,
  modelTypeSuggestions = [],
  onModelTypeChange,
  variants,
  onVariantsChange,
}: ExistingModelTypeStockEditorProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedType, setLoadedType] = useState("");
  const [loadedProductModel, setLoadedProductModel] = useState<string | undefined>();

  function updateVariant(key: string, patch: Partial<ExistingProductVariantRow>) {
    onVariantsChange(variants.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  async function loadProducts(selection?: StockInModelSelection | string) {
    const resolved =
      typeof selection === "string"
        ? { label: selection, modelType: selection }
        : selection;
    const modelTypeTerm = (resolved?.modelType ?? modelType).trim();
    const productModel = resolved?.productModel?.trim();
    const displayLabel = resolved?.label?.trim() || modelTypeTerm;

    if (!modelTypeTerm) {
      setErrorMessage("Enter a model type or product model first");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await listProductsByModelTypeForStockIn(
        modelTypeTerm,
        productModel
      );
      if (error) {
        setErrorMessage(error);
        onVariantsChange([]);
        return;
      }

      const prevQty = new Map(variants.map((v) => [v.product_id, v.quantity_received]));
      onVariantsChange(
        data.map((p) => ({
          key: p.id,
          product_id: p.id,
          color: p.color?.trim() || "—",
          model: p.model,
          sku: p.sku,
          quantity_on_hand: p.quantity,
          quantity_received: prevQty.get(p.id) ?? 0,
        }))
      );
      setLoadedType(displayLabel);
      setLoadedProductModel(productModel);
      if (data.length === 0) {
        setErrorMessage(`No active products found for "${displayLabel}"`);
      }
    } catch {
      setErrorMessage("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label>Model type</Label>
          <ModelTypeAutocomplete
            value={modelType}
            typeSuggestions={modelTypeSuggestions}
            onChange={onModelTypeChange}
            onSelect={(selection) => void loadProducts(selection)}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Search by model type or full product name. Pick a suggestion to load variants.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={loading || !modelType.trim()}
          onClick={() => void loadProducts()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Load products
        </Button>
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      {variants.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {loadedType
              ? `${variants.length} product${variants.length !== 1 ? "s" : ""} for ${loadedType}`
              : `${variants.length} products`}
            {" · "}
            Enter quantity received (0 = skip)
          </p>
          <div className="hidden gap-3 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(5rem,0.6fr)_minmax(0,2fr)_minmax(0,1fr)_5rem_6rem]">
            <span>Color</span>
            <span>Model</span>
            <span>SKU</span>
            <span className="text-right">On hand</span>
            <span>Receive</span>
          </div>
          {variants.map((variant) => (
            <div
              key={variant.key}
              className="grid gap-3 border-t pt-3 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(5rem,0.6fr)_minmax(0,2fr)_minmax(0,1fr)_5rem_6rem] lg:items-start lg:border-t-0 lg:pt-0"
            >
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground lg:hidden">Color · </span>
                <span className="text-sm font-medium">{variant.color}</span>
              </div>
              <div className="min-w-0 text-sm leading-snug">
                <span className="text-xs text-muted-foreground lg:hidden">Model · </span>
                <span className="whitespace-normal break-words">{variant.model}</span>
              </div>
              <div className="min-w-0 font-mono text-xs leading-snug">
                <span className="text-xs text-muted-foreground lg:hidden">SKU · </span>
                <span className="whitespace-normal break-words">{variant.sku}</span>
              </div>
              <div className="text-sm lg:text-right">
                <span className="text-xs text-muted-foreground lg:hidden">On hand · </span>
                {variant.quantity_on_hand}
              </div>
              <div className="space-y-1">
                <Label className="text-xs lg:sr-only">Qty received</Label>
                <Input
                  type="number"
                  min={0}
                  value={variant.quantity_received}
                  onChange={(e) =>
                    updateVariant(variant.key, {
                      quantity_received: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
