"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import {
  fetchActiveProductsByModelType,
  fetchProductByIdForSearch,
  fetchStockInModelSuggestions,
  searchActiveProducts,
} from "@/lib/product-queries";
import type { StockInModelSuggestion } from "@/lib/product-queries";
import {
  generateStockReceiptInvoiceNumber,
  isValidStockReceiptInvoiceNumber,
} from "@/lib/stock-receipt-invoice";
import { submitStockReceipt } from "@/lib/stock-receipts";
import type { StockReceiptInput } from "@/types/database";

export async function searchProductsForStockIn(query: string) {
  try {
    return await searchActiveProducts(query, 50);
  } catch (error) {
    console.error("Stock-in product search failed", error);
    return { data: [], error: "Product search failed. Please try again." };
  }
}

export async function listProductsByModelTypeForStockIn(
  modelType: string,
  productModel?: string
) {
  try {
    return await fetchActiveProductsByModelType(modelType, { productModel });
  } catch (error) {
    console.error("Stock-in model type lookup failed", error);
    return { data: [], error: "Failed to load products for this model type." };
  }
}

export async function searchStockInModelSuggestions(
  query: string,
  typeSuggestions: string[]
): Promise<{ data: StockInModelSuggestion[]; error?: string }> {
  try {
    return await fetchStockInModelSuggestions(query, typeSuggestions);
  } catch (error) {
    console.error("Stock-in model suggestion search failed", error);
    return { data: [], error: "Failed to load model suggestions." };
  }
}

export async function getProductForStockIn(productId: string) {
  try {
    return await fetchProductByIdForSearch(productId);
  } catch (error) {
    console.error("Stock-in product lookup failed", error);
    return null;
  }
}

const categoryValues = PRODUCT_CATEGORIES_SELECT.map((c) => c.slug) as [string, ...string[]];

const existingLineSchema = z.object({
  mode: z.literal("existing"),
  product_id: z.string().uuid(),
  quantity_received: z.coerce.number().int().min(1),
});

const colorVariantSchema = z.object({
  color: z.string().min(1, "Color is required"),
  quantity_received: z.coerce.number().int().min(1),
  sku: z.string().optional(),
});

const newLineSchema = z.object({
  mode: z.literal("new"),
  quantity_received: z.coerce.number().int().min(1).optional(),
  brand: z.string().min(1),
  model_type: z.string().optional(),
  model: z.string().min(1),
  base_sku: z.string().optional(),
  sku: z.string().optional(),
  category: z.enum(categoryValues),
  cost_price: z.coerce.number().min(0).optional(),
  selling_price: z.coerce.number().min(0).optional(),
  storage_ram: z.string().optional(),
  color: z.string().optional(),
  color_variants: z.array(colorVariantSchema).min(1).optional(),
  condition: z.string().optional(),
  image_url: z.string().optional(),
});

const lineSchema = z.union([existingLineSchema, newLineSchema]);

const receiptSchema = z
  .object({
    invoice_number: z
      .string()
      .trim()
      .min(1, "Invoice / reference number is required")
      .refine(isValidStockReceiptInvoiceNumber, {
        message: "Use format MM-DD-YYYY-XXXXXX (6 random uppercase letters or digits)",
      }),
    note: z.string().optional(),
    lines: z.array(lineSchema).min(1, "Add at least one line item"),
  })
  .superRefine((data, ctx) => {
    data.lines.forEach((line, index) => {
      if (line.mode !== "new") return;
      const hasVariants = (line.color_variants?.length ?? 0) > 0;
      const hasLegacyColor = Boolean(line.color?.trim());
      if (!hasVariants && !hasLegacyColor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Add at least one color variant",
          path: ["lines", index, "color_variants"],
        });
      }
    });
  });

export async function submitStockReceiptAction(payload: StockReceiptInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = receiptSchema.safeParse({
    ...payload,
    invoice_number: payload.invoice_number?.trim() || generateStockReceiptInvoiceNumber(),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const result = await submitStockReceipt(
    user.id,
    user.email,
    parsed.data as StockReceiptInput
  );
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products", "layout");
  revalidatePath("/dashboard/stock-in");
  revalidatePath("/dashboard/stock-in/history");

  return { success: true, receiptId: result.receiptId };
}
