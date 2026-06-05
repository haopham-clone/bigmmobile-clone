import type {
  Product,
  StockReceipt,
  StockReceiptInput,
  StockReceiptItem,
  StockReceiptWithItems,
} from "@/types/database";
import { HIDDEN_CATEGORY_SLUGS } from "@/lib/categories";
import { isMockMode } from "@/lib/config";
import { expandNewProductLine, receiptTotalQuantity } from "@/lib/stock-receipt-expand";
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
  userEmail: string,
  input: StockReceiptInput
): Promise<{ receiptId?: string; error?: string }> {
  if (input.lines.length === 0) {
    return { error: "Add at least one line item" };
  }

  if (isMockMode()) {
    return mockSubmitStockReceipt(userId, userEmail, input);
  }

  const supabase = await createClient();
  const usedSkus = new Set<string>();

  for (const line of input.lines) {
    if (line.mode !== "new") continue;
    const { rows, error } = expandNewProductLine(line);
    if (error) return { error };
    for (const row of rows) {
      if (usedSkus.has(row.sku)) {
        return { error: `Duplicate SKU in receipt: ${row.sku}` };
      }
      usedSkus.add(row.sku);
    }
  }

  const totalQuantity = receiptTotalQuantity(input.lines);

  const { data: receipt, error: receiptError } = await supabase
    .from("stock_receipts")
    .insert({
      user_id: userId,
      received_by_email: userEmail || null,
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

  async function receiveProduct(
    product: Product,
    quantityReceived: number
  ): Promise<{ error?: string }> {
    const prevQty = product.quantity;
    const newQty = prevQty + quantityReceived;

    const { error: updateError } = await supabase
      .from("products")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", product.id);

    if (updateError) return { error: updateError.message };

    const { error: itemError } = await supabase.from("stock_receipt_items").insert({
      receipt_id: receiptId,
      product_id: product.id,
      sku: product.sku,
      brand: product.brand,
      model: product.model,
      category: product.category,
      quantity_received: quantityReceived,
      previous_quantity: prevQty,
      new_quantity: newQty,
    });

    if (itemError) return { error: itemError.message };

    const { error: logError } = await supabase.from("stock_logs").insert({
      product_id: product.id,
      user_id: userId,
      action: "RECEIVED_STOCK",
      quantity_changed: quantityReceived,
      new_quantity: newQty,
    });

    if (logError) return { error: logError.message };
    product.quantity = newQty;
    return {};
  }

  for (const line of input.lines) {
    if (line.mode === "existing") {
      if (!line.product_id) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        return { error: "Existing line missing product" };
      }
      if (!line.quantity_received || line.quantity_received < 1) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        return { error: "Existing line missing quantity" };
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

      const product = normalizeProduct(data as Record<string, unknown>);
      const result = await receiveProduct(product, line.quantity_received ?? 0);
      if (result.error) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        return { error: result.error };
      }
      continue;
    }

    const { rows, error: expandError } = expandNewProductLine(line);
    if (expandError) {
      await supabase.from("stock_receipts").delete().eq("id", receiptId);
      return { error: expandError };
    }

    if (rows.length > 0 && HIDDEN_CATEGORY_SLUGS.has(rows[0].category as never)) {
      await supabase.from("stock_receipts").delete().eq("id", receiptId);
      return { error: "Cannot create products in hidden category" };
    }

    for (const row of rows) {
      const { data, error } = await supabase
        .from("products")
        .insert({
          image_url: row.image_url,
          brand: row.brand,
          model_type: row.model_type,
          model: row.model,
          storage_ram: row.storage_ram,
          color: row.color,
          condition: row.condition,
          category: row.category,
          sku: row.sku,
          cost_price: row.cost_price,
          selling_price: row.selling_price,
          quantity: 0,
          is_active: true,
        })
        .select("*")
        .single();

      if (error || !data) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        if (error?.code === "23505") {
          return { error: `SKU already exists (${row.color}): ${row.sku}` };
        }
        return { error: error?.message ?? "Failed to create product" };
      }

      const product = normalizeProduct(data as Record<string, unknown>);
      const result = await receiveProduct(product, row.quantity_received);
      if (result.error) {
        await supabase.from("stock_receipts").delete().eq("id", receiptId);
        return { error: result.error };
      }
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
