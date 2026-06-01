"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import { searchActiveProducts, fetchProductByIdForSearch } from "@/lib/product-queries";
import { submitStockReceipt } from "@/lib/stock-receipts";
import type { StockReceiptInput, StockReceiptLineInput } from "@/types/database";

export async function searchProductsForStockIn(query: string) {
  return searchActiveProducts(query, 50);
}

export async function getProductForStockIn(productId: string) {
  return fetchProductByIdForSearch(productId);
}

const categoryValues = PRODUCT_CATEGORIES_SELECT.map((c) => c.slug) as [string, ...string[]];

const existingLineSchema = z.object({
  mode: z.literal("existing"),
  product_id: z.string().uuid(),
  quantity_received: z.coerce.number().int().min(1),
});

const newLineSchema = z.object({
  mode: z.literal("new"),
  quantity_received: z.coerce.number().int().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  sku: z.string().min(1),
  category: z.enum(categoryValues),
  cost_price: z.coerce.number().min(0).optional(),
  selling_price: z.coerce.number().min(0).optional(),
  storage_ram: z.string().optional(),
  color: z.string().optional(),
  condition: z.string().optional(),
  image_url: z.string().optional(),
});

const lineSchema = z.discriminatedUnion("mode", [existingLineSchema, newLineSchema]);

const receiptSchema = z.object({
  invoice_number: z.string().optional(),
  note: z.string().optional(),
  lines: z.array(lineSchema).min(1, "Add at least one line item"),
});

export async function submitStockReceiptAction(payload: StockReceiptInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = receiptSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const result = await submitStockReceipt(user.id, parsed.data as StockReceiptInput);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products", "layout");
  revalidatePath("/dashboard/stock-in");
  revalidatePath("/dashboard/stock-in/history");

  return { success: true, receiptId: result.receiptId };
}

export type { StockReceiptLineInput };
