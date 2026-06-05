import { canonicalizeModelType, deriveProductModelType } from "@/lib/model-type";
import { resolveVariantSku } from "@/lib/sku-utils";
import type { StockReceiptLineInput } from "@/types/database";

export interface ExpandedNewProductRow {
  brand: string;
  model_type: string;
  model: string;
  category: string;
  cost_price: number;
  selling_price: number;
  storage_ram: string | null;
  condition: string | null;
  image_url: string | null;
  color: string;
  sku: string;
  quantity_received: number;
}

function normalizeColorKey(color: string): string {
  return color.trim().toLowerCase();
}

export function expandNewProductLine(
  line: StockReceiptLineInput
): { rows: ExpandedNewProductRow[]; error?: string } {
  if (line.mode !== "new") {
    return { rows: [], error: "Not a new product line" };
  }

  if (!line.brand?.trim() || !line.model?.trim() || !line.category) {
    return { rows: [], error: "New product line missing required fields" };
  }

  const variants =
    line.color_variants && line.color_variants.length > 0
      ? line.color_variants
      : line.color?.trim()
        ? [
            {
              color: line.color.trim(),
              quantity_received: line.quantity_received ?? 1,
              sku: line.sku,
            },
          ]
        : [];

  if (variants.length === 0) {
    return { rows: [], error: "Add at least one color variant" };
  }

  const seenColors = new Set<string>();
  const resolvedSkus: string[] = [];

  const modelType = canonicalizeModelType(
    line.model_type?.trim() ||
      deriveProductModelType(line.brand, line.model, line.category) ||
      ""
  );

  const rows: ExpandedNewProductRow[] = [];

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    const color = variant.color?.trim() ?? "";
    if (!color) {
      return { rows: [], error: "Each color variant must have a color name" };
    }

    const colorKey = normalizeColorKey(color);
    if (seenColors.has(colorKey)) {
      return { rows: [], error: `Duplicate color on line: ${color}` };
    }
    seenColors.add(colorKey);

    const qty = variant.quantity_received;
    if (!Number.isInteger(qty) || qty < 1) {
      return { rows: [], error: `Invalid quantity for color: ${color}` };
    }

    const sku = resolveVariantSku({
      manualSku: variant.sku,
      baseSku: line.base_sku ?? line.sku,
      brand: line.brand,
      model: line.model,
      color,
      index: i,
    });

    if (resolvedSkus.includes(sku)) {
      return { rows: [], error: `Duplicate SKU on line: ${sku}` };
    }
    resolvedSkus.push(sku);

    rows.push({
      brand: line.brand.trim(),
      model_type: modelType,
      model: line.model.trim(),
      category: line.category,
      cost_price: line.cost_price ?? 0,
      selling_price: line.selling_price ?? 0,
      storage_ram: line.storage_ram?.trim() || null,
      condition: line.condition?.trim() || null,
      image_url: line.image_url ?? null,
      color,
      sku,
      quantity_received: qty,
    });
  }

  return { rows };
}

export function receiptTotalQuantity(lines: StockReceiptLineInput[]): number {
  let total = 0;
  for (const line of lines) {
    if (line.mode === "existing") {
      total += line.quantity_received ?? 0;
      continue;
    }
    const { rows } = expandNewProductLine(line);
    total += rows.reduce((sum, row) => sum + row.quantity_received, 0);
  }
  return total;
}
