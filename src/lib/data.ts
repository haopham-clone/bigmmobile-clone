import { isMockMode } from "@/lib/config";
import {
  mockAddProduct,
  mockAdjustStock,
  mockGetDashboardData,
  mockListProducts,
} from "@/lib/mock-db";
import { createClient } from "@/utils/supabase/server";
import type { Product, ProductInsert, StockAction } from "@/types/database";

export async function fetchProducts(): Promise<{ data: Product[]; error?: string }> {
  if (isMockMode()) {
    return { data: mockListProducts() };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Product[] };
}

export async function fetchDashboardStats() {
  if (isMockMode()) {
    return mockGetDashboardData();
  }

  const supabase = await createClient();
  const [productsResult, lowStockResult] = await Promise.all([
    supabase.from("products").select("quantity, cost_price"),
    supabase
      .from("products")
      .select("id, brand, model, sku, quantity")
      .gt("quantity", 0)
      .lt("quantity", 3),
  ]);

  return {
    products: productsResult.data ?? [],
    lowStockItems: lowStockResult.data ?? [],
    error: productsResult.error?.message ?? lowStockResult.error?.message,
  };
}

export async function insertProduct(
  data: ProductInsert
): Promise<{ error?: string; success?: boolean }> {
  if (isMockMode()) {
    return mockAddProduct(data);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: product, error: insertError } = await supabase
    .from("products")
    .insert({
      image_url: data.image_url ?? null,
      brand: data.brand,
      model: data.model,
      storage_ram: data.storage_ram ?? null,
      color: data.color ?? null,
      condition: data.condition ?? null,
      sku: data.sku,
      cost_price: data.cost_price,
      selling_price: data.selling_price,
      quantity: data.quantity,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") return { error: "SKU already exists" };
    return { error: insertError.message };
  }

  if (data.quantity > 0) {
    const { error: logError } = await supabase.from("stock_logs").insert({
      product_id: product.id,
      user_id: user.id,
      action: "INITIAL_ADD" as StockAction,
      quantity_changed: data.quantity,
      new_quantity: data.quantity,
    });
    if (logError) return { error: logError.message };
  }

  return { success: true };
}

export async function updateStock(
  productId: string,
  delta: number
): Promise<{ error?: string; success?: boolean; quantity?: number }> {
  if (isMockMode()) {
    if (delta === 0) return { error: "No change" };
    const result = mockAdjustStock(productId, delta);
    if (result.error) return result;
    return { success: true, quantity: result.quantity };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  if (delta === 0) return { error: "No change" };

  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("quantity")
    .eq("id", productId)
    .single();

  if (fetchError || !product) return { error: "Product not found" };

  const currentQty = product.quantity as number;
  const newQty = Math.max(0, currentQty + delta);
  if (newQty === currentQty) return { success: true, quantity: newQty };

  const actualDelta = newQty - currentQty;
  const action: StockAction = actualDelta > 0 ? "ADJUSTED_UP" : "ADJUSTED_DOWN";

  const { error: updateError } = await supabase
    .from("products")
    .update({ quantity: newQty })
    .eq("id", productId);

  if (updateError) return { error: updateError.message };

  const { error: logError } = await supabase.from("stock_logs").insert({
    product_id: productId,
    user_id: user.id,
    action,
    quantity_changed: Math.abs(actualDelta),
    new_quantity: newQty,
  });

  if (logError) return { error: logError.message };
  return { success: true, quantity: newQty };
}
