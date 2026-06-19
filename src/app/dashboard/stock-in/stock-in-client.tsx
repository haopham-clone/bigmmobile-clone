"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";
import type { CategorySlug } from "@/lib/categories";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import { deriveProductModelType } from "@/lib/model-type";
import {
  generateStockReceiptInvoiceNumber,
  isValidStockReceiptInvoiceNumber,
} from "@/lib/stock-receipt-invoice";
import {
  cartTotalQuantity,
  flattenCartToReceiptLines,
  mergeCartItem,
  removeCartItem,
  updateCartItemQuantity,
  validateCartItems,
  type StockCartDraft,
  type StockCartItem,
  type StockCartItemInput,
} from "@/lib/stock-cart";
import {
  clearCartDraft,
  consumePendingCartAdd,
  loadOrCreateCartDraft,
  saveCartDraft,
} from "@/lib/stock-cart-storage";
import { submitStockReceiptAction, getProductForStockIn } from "./actions";
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
import { StockCartPanel } from "@/components/stock-in/stock-cart-panel";
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

function lineRowToCartItems(line: LineRow): StockCartItemInput[] {
  if (line.mode === "existing") {
    return line.existing_variants
      .filter((variant) => variant.quantity_received > 0)
      .map((variant) => ({
        mode: "existing" as const,
        product_id: variant.product_id,
        sku: variant.sku,
        brand: variant.brand,
        model: variant.model,
        color: variant.color,
        quantity_received: variant.quantity_received,
      }));
  }

  return line.color_variants
    .filter((variant) => variant.quantity_received > 0 && variant.color.trim())
    .map((variant) => ({
      mode: "new" as const,
      brand: line.brand.trim(),
      model_type: line.model_type.trim() || undefined,
      model: line.model.trim(),
      sku: variant.sku.trim(),
      category: line.category,
      cost_price: line.cost_price,
      selling_price: line.selling_price,
      storage_ram: line.storage_ram.trim() || undefined,
      condition: line.condition.trim() || undefined,
      color: variant.color.trim(),
      quantity_received: variant.quantity_received,
      base_sku: line.sku.trim() || undefined,
    }));
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
  const [hydrated, setHydrated] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(generateStockReceiptInvoiceNumber);
  const [note, setNote] = useState("");
  const [cartItems, setCartItems] = useState<StockCartItem[]>([]);
  const [lines, setLines] = useState<LineRow[]>([newLine()]);
  const [quickSearchProductId, setQuickSearchProductId] = useState("");
  const [quickAddQty, setQuickAddQty] = useState(1);
  const [isPending, startTransition] = useTransition();

  const persistDraft = useCallback(
    (items: StockCartItem[], invoice: string, draftNote: string) => {
      if (!hydrated) return;
      const draft: StockCartDraft = {
        version: 1,
        invoiceNumber: invoice,
        note: draftNote,
        items,
      };
      saveCartDraft(draft);
    },
    [hydrated]
  );

  useEffect(() => {
    const draft = loadOrCreateCartDraft(generateStockReceiptInvoiceNumber());
    setInvoiceNumber(draft.invoiceNumber || generateStockReceiptInvoiceNumber());
    setNote(draft.note);
    setCartItems(draft.items);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistDraft(cartItems, invoiceNumber, note);
  }, [cartItems, invoiceNumber, note, hydrated, persistDraft]);

  useEffect(() => {
    if (!hydrated) return;

    async function consumePendingAdd() {
      const pending = consumePendingCartAdd();
      if (!pending) return;

      const product = await getProductForStockIn(pending.product_id);
      if (!product) {
        toast.error("Could not load product for cart");
        return;
      }

      setCartItems((prev) =>
        mergeCartItem(prev, {
          mode: "existing",
          product_id: product.id,
          sku: product.sku,
          brand: product.brand,
          model: product.model,
          color: product.color?.trim() || "—",
          quantity_received: pending.quantity_received,
        })
      );
      toast.success("Added to receiving cart");
    }

    void consumePendingAdd();
  }, [hydrated]);

  const totalQty = cartTotalQuantity(cartItems);

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  }

  function handleModelBlur(lineKey: string) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== lineKey || line.model_type.trim()) return line;
        const derived = deriveProductModelType(line.brand, line.model, line.category);
        return derived ? { ...line, model_type: derived } : line;
      })
    );
  }

  function addLineToCart(line: LineRow) {
    const incoming = lineRowToCartItems(line);
    if (incoming.length === 0) {
      toast.error("Set quantity received before adding to cart");
      return;
    }
    setCartItems((prev) => incoming.reduce((items, item) => mergeCartItem(items, item), prev));
    toast.success(`Added ${incoming.length} item(s) to cart`);
  }

  async function handleQuickAddToCart() {
    if (!quickSearchProductId) {
      toast.error("Search and select a product first");
      return;
    }
    if (quickAddQty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    const product = await getProductForStockIn(quickSearchProductId);
    if (!product) {
      toast.error("Product not found");
      return;
    }

    setCartItems((prev) =>
      mergeCartItem(prev, {
        mode: "existing",
        product_id: product.id,
        sku: product.sku,
        brand: product.brand,
        model: product.model,
        color: product.color?.trim() || "—",
        quantity_received: quickAddQty,
      })
    );
    setQuickSearchProductId("");
    setQuickAddQty(1);
    toast.success("Added to receiving cart");
  }

  function handleSubmit() {
    const cartError = validateCartItems(cartItems);
    if (cartError) {
      toast.error(cartError);
      return;
    }

    const receiptLines: StockReceiptLineInput[] = flattenCartToReceiptLines(cartItems);
    if (receiptLines.length === 0) {
      toast.error("Add at least one item to the cart");
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
      clearCartDraft();
      setCartItems([]);
      setNote("");
      setInvoiceNumber(generateStockReceiptInvoiceNumber());
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick add to cart</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Search product</Label>
            <ProductSearchSelect
              value={quickSearchProductId}
              onChange={setQuickSearchProductId}
              placeholder="Search brand, model, SKU..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick_qty">Qty</Label>
            <Input
              id="quick_qty"
              type="number"
              min={1}
              className="w-24"
              value={quickAddQty}
              onChange={(e) => setQuickAddQty(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <Button type="button" className="gap-2" onClick={() => void handleQuickAddToCart()}>
            <ShoppingCart className="h-4 w-4" />
            Add to cart
          </Button>
        </CardContent>
      </Card>

      <StockCartPanel
        items={cartItems}
        onQuantityChange={(cartId, quantity) =>
          setCartItems((prev) => updateCartItemQuantity(prev, cartId, quantity))
        }
        onRemove={(cartId) => setCartItems((prev) => removeCartItem(prev, cartId))}
        onClear={() => setCartItems([])}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Line builders</h2>
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
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => addLineToCart(line)}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to cart
                </Button>
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
          Cart: {cartItems.length} item{cartItems.length !== 1 ? "s" : ""} · {totalQty} units total
        </p>
        <Button size="lg" disabled={isPending || cartItems.length === 0} onClick={handleSubmit}>
          {isPending ? "Saving..." : "Submit receipt"}
        </Button>
      </div>
    </div>
  );
}
