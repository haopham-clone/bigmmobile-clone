import { isMockMode } from "@/lib/config";
import {
  HIDDEN_CATEGORY_SLUGS,
  SIDEBAR_CATEGORIES,
} from "@/lib/categories";
import {
  mockAddProduct,
  mockAdjustStock,
  mockGetCategoryCounts,
  mockGetDashboardData,
  mockGetProduct,
  mockListProducts,
  mockSetProductActive,
  mockUpdateProduct,
} from "@/lib/mock-db";
import { createClient } from "@/utils/supabase/server";
import type { CategoryCounts, Product, ProductInsert, ProductUpdate, StockAction } from "@/types/database";

function normalizeProduct(row: Record<string, unknown>): Product {
  return {
    ...(row as unknown as Product),
    is_active: row.is_active !== false,
  };
}

function isHiddenCategory(category: string): boolean {
  return HIDDEN_CATEGORY_SLUGS.has(category as never);
}

export async function fetchProducts(
  categorySlug?: string
): Promise<{ data: Product[]; error?: string }> {
  if (isMockMode()) {
    return { data: mockListProducts(categorySlug) };
  }

  const supabase = await createClient();
  let query = supabase.from("products").select("*").order("updated_at", { ascending: false });

  if (categorySlug && categorySlug !== "all") {
    query = query.eq("category", categorySlug);
  } else if (!categorySlug || categorySlug === "all") {
    query = query.neq("category", "devices");
  }

  const { data, error } = await query;

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)) };
}

export async function fetchProductById(
  productId: string
): Promise<{ data: Product | null; error?: string }> {
  if (isMockMode()) {
    return { data: mockGetProduct(productId) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return {
    data: data ? normalizeProduct(data as Record<string, unknown>) : null,
  };
}

export async function fetchCategoryCounts(): Promise<CategoryCounts> {
  if (isMockMode()) {
    return mockGetCategoryCounts();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("category");

  if (error || !data) {
    const empty: CategoryCounts = { all: 0 };
    for (const cat of SIDEBAR_CATEGORIES) {
      empty[cat.slug] = 0;
    }
    return empty;
  }

  const visible = data.filter((row) => !isHiddenCategory(row.category as string));
  const counts: CategoryCounts = { all: visible.length };

  for (const cat of SIDEBAR_CATEGORIES) {
    if (cat.slug === "all") continue;
    counts[cat.slug] = data.filter((row) => row.category === cat.slug).length;
  }

  return counts;
}

export async function fetchDashboardStats() {
  if (isMockMode()) {
    return mockGetDashboardData();
  }

  const supabase = await createClient();
  const [statsResult, lowStockResult] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase
      .from("products")
      .select("id, brand, model, sku, quantity")
      .neq("category", "devices")
      .eq("is_active", true)
      .gt("quantity", 0)
      .lt("quantity", 3)
      .order("quantity", { ascending: true })
      .limit(50),
  ]);

  const stats = statsResult.data?.[0] as
    | { total_skus: number; total_units: number; inventory_value: number }
    | undefined;

  return {
    totalSkus: Number(stats?.total_skus ?? 0),
    totalUnits: Number(stats?.total_units ?? 0),
    inventoryValue: Number(stats?.inventory_value ?? 0),
    lowStockItems: lowStockResult.data ?? [],
    error: statsResult.error?.message ?? lowStockResult.error?.message,
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
      category: data.category,
      sku: data.sku,
      cost_price: data.cost_price,
      selling_price: data.selling_price,
      quantity: data.quantity,
      is_active: data.is_active ?? true,
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

export async function updateProduct(
  productId: string,
  data: ProductUpdate
): Promise<{ error?: string; success?: boolean }> {
  if (isMockMode()) {
    return mockUpdateProduct(productId, data);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: current, error: fetchError } = await supabase
    .from("products")
    .select("quantity, is_active")
    .eq("id", productId)
    .single();

  if (fetchError || !current) return { error: "Product not found" };

  const prevQty = current.quantity as number;
  const newQty = data.quantity;

  const { error: updateError } = await supabase
    .from("products")
    .update({
      image_url: data.image_url ?? null,
      brand: data.brand,
      model: data.model,
      storage_ram: data.storage_ram ?? null,
      color: data.color ?? null,
      condition: data.condition ?? null,
      category: data.category,
      sku: data.sku,
      cost_price: data.cost_price,
      selling_price: data.selling_price,
      quantity: newQty,
      is_active: data.is_active ?? current.is_active !== false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (updateError) {
    if (updateError.code === "23505") return { error: "SKU already exists" };
    return { error: updateError.message };
  }

  if (newQty !== prevQty) {
    const delta = newQty - prevQty;
    const { error: logError } = await supabase.from("stock_logs").insert({
      product_id: productId,
      user_id: user.id,
      action: (delta > 0 ? "ADJUSTED_UP" : "ADJUSTED_DOWN") as StockAction,
      quantity_changed: Math.abs(delta),
      new_quantity: newQty,
    });
    if (logError) return { error: logError.message };
  }

  return { success: true };
}

export async function setProductActive(
  productId: string,
  isActive: boolean
): Promise<{ error?: string; success?: boolean }> {
  if (isMockMode()) {
    return mockSetProductActive(productId, isActive);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) return { error: error.message };
  return { success: true };
}
