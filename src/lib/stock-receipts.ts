import type {
  Product,
  StockReceipt,
  StockReceiptInput,
  StockReceiptItem,
  StockReceiptWithItems,
} from "@/types/database";
import { HIDDEN_CATEGORY_SLUGS } from "@/lib/categories";
import { isMockMode } from "@/lib/config";
import { deriveProductModelType } from "@/lib/model-type";
import {
  mockListActiveProducts,
  mockListStockReceipts,
  mockGetStockReceipt,
  mockSubmitStockReceipt,
} from "@/lib/mock-db";
import { createClient } from "@/utils/supabase/server";

function normalizeProduct(row: Record<string, unknown>): Product {
  return {
    ...(row as unknown as Product),
    is_active: row.is_active !== false,
  };
}

/** Active products available for Stock In (excludes hidden device category) */
export async function fetchActiveProductsForStockIn(): Promise<{
  data: Product[];
  error?: string;
}> {
  if (isMockMode()) {
    return { data: mockListActiveProducts() };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .neq("category", "devices")
    .order("brand")
    .order("model");

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)),
  };
}

export async function submitStockReceipt(
  userId: string,
  input: StockReceiptInput
): Promise<{ receiptId?: string; error?: string }> {
  if (input.lines.length === 0) {
    return { error: "Add at least one line item" };
  }

  if (isMockMode()) {
    return mockSubmitStockReceipt(userId, input);
  }

  const supabase = await createClient();
  const totalQuantity = input.lines.reduce((sum, l) => sum + l.quantity_received, 0);

  const { data: receipt, error: receiptError } = await supabase
    .from("stock_receipts")
    .insert({
      user_id: userId,
      invoice_number: input.invoice_number || null,
      note: input.note || null,
      total_quantity: totalQuantity,
    })
    .select("id")
    .single();

  if (receiptError || !receipt) {
    return { error: receiptError?.message ?? "Failed to create receipt" };
  }

  const receiptId = receipt.id as string;

  for (const line of input.lines) {
    let product: Product | null = null;

    if (line.mode === "existing") {
      if (!line.product_id) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        return { error: "Existing line missing product" };
      }

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", line.product_id)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        return { error: "Product not found or inactive" };
      }
      product = normalizeProduct(data as Record<string, unknown>);
    } else {
      if (!line.brand || !line.model || !line.sku || !line.category) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        return { error: "New product line missing required fields" };
      }

      if (HIDDEN_CATEGORY_SLUGS.has(line.category as never)) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        return { error: "Cannot create products in hidden category" };
      }

      const { data, error } = await supabase
        .from("products")
        .insert({
          image_url: line.image_url ?? null,
          brand: line.brand,
          model_type:
            line.model_type || deriveProductModelType(line.brand, line.model, line.category),
          model: line.model,
          storage_ram: line.storage_ram ?? null,
          color: line.color ?? null,
          condition: line.condition ?? null,
          category: line.category,
          sku: line.sku,
          cost_price: line.cost_price ?? 0,
          selling_price: line.selling_price ?? 0,
          quantity: 0,
          is_active: true,
        })
        .select("*")
        .single();

      if (error || !data) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        if (error?.code === "23505") return { error: `SKU already exists: ${line.sku}` };
        return { error: error?.message ?? "Failed to create product" };
      }
      product = normalizeProduct(data as Record<string, unknown>);
    }

    const prevQty = product.quantity;
    const newQty = prevQty + line.quantity_received;

    const { error: updateError } = await supabase
      .from("products")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", product.id);

    if (updateError) {
      await supabase.from("stock_receipts").delete().eq("id", receiptId);
      return { error: updateError.message };
    }

    const { error: itemError } = await supabase.from("stock_receipt_items").insert({
      receipt_id: receiptId,
      product_id: product.id,
      sku: product.sku,
      brand: product.brand,
      model: product.model,
      category: product.category,
      quantity_received: line.quantity_received,
      previous_quantity: prevQty,
      new_quantity: newQty,
    });

    if (itemError) {
      await supabase.from("stock_receipts").delete().eq("id", receiptId);
      return { error: itemError.message };
    }

    const { error: logError } = await supabase.from("stock_logs").insert({
      product_id: product.id,
      user_id: userId,
      action: "RECEIVED_STOCK",
      quantity_changed: line.quantity_received,
      new_quantity: newQty,
    });

    if (logError) {
      await supabase.from("stock_receipts").delete().eq("id", receiptId);
      return { error: logError.message };
    }
  }

  return { receiptId };
}

export async function fetchStockReceipts(): Promise<{
  data: StockReceipt[];
  error?: string;
}> {
  if (isMockMode()) {
    return { data: mockListStockReceipts() };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_receipts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as StockReceipt[] };
}

export async function fetchStockReceiptById(
  receiptId: string
): Promise<{ data: StockReceiptWithItems | null; error?: string }> {
  if (isMockMode()) {
    return { data: mockGetStockReceipt(receiptId) };
  }

  const supabase = await createClient();
  const { data: receipt, error: receiptError } = await supabase
    .from("stock_receipts")
    .select("*")
    .eq("id", receiptId)
    .maybeSingle();

  if (receiptError) return { data: null, error: receiptError.message };
  if (!receipt) return { data: null };

  const { data: items, error: itemsError } = await supabase
    .from("stock_receipt_items")
    .select("*")
    .eq("receipt_id", receiptId)
    .order("created_at");

  if (itemsError) return { data: null, error: itemsError.message };

  return {
    data: {
      ...(receipt as StockReceipt),
      items: (items ?? []) as StockReceiptItem[],
    },
  };
}
