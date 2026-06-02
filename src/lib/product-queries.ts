import { isMockMode } from "@/lib/config";
import { deriveProductModelType, getModelTypeSortRank } from "@/lib/model-type";
import { tokenizeSearch } from "@/lib/search-utils";
import {
  mockGetProductBrands,
  mockListProducts,
  mockListProductsPaginated,
  mockSearchActiveProducts,
} from "@/lib/mock-db";
import { createClient } from "@/utils/supabase/server";
import type {
  PaginatedProducts,
  Product,
  ProductListFilters,
  ProductSortOption,
} from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = any;

export interface SidebarProductModel {
  model: string;
}

export interface SidebarProductBrand {
  brand: string;
  models: SidebarProductModel[];
}

export interface SidebarProductCategory {
  category: string;
  brands: SidebarProductBrand[];
}

function normalizeProduct(row: Record<string, unknown>): Product {
  return {
    ...(row as unknown as Product),
    is_active: row.is_active !== false,
  };
}

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_,]/g, " ").trim();
}

/** Each word must match brand, model, or SKU (e.g. "Oppo A60" → brand + model). */
function applySearchFilter(query: QueryBuilder, rawSearch: string): QueryBuilder {
  const tokens = tokenizeSearch(rawSearch);
  if (tokens.length === 0) return query;

  let q = query;
  for (const token of tokens) {
    const pattern = `%${token}%`;
    q = q.or(
      `brand.ilike.${pattern},model_type.ilike.${pattern},model.ilike.${pattern},sku.ilike.${pattern}`
    );
  }
  return q;
}

function applyCategoryFilter(query: QueryBuilder, categorySlug?: string): QueryBuilder {
  if (categorySlug && categorySlug !== "all") {
    return query.eq("category", categorySlug);
  }
  return query.neq("category", "devices");
}

function applyListFilters(query: QueryBuilder, filters: ProductListFilters): QueryBuilder {
  let q = applyCategoryFilter(query, filters.categorySlug);

  if (filters.hideInactive !== false) {
    q = q.eq("is_active", true);
  }

  if (filters.hideZeroStock) {
    q = q.gt("quantity", 0);
  }

  if (filters.lowStockOnly) {
    q = q.gt("quantity", 0).lt("quantity", 3);
  }

  if (filters.brand && filters.brand !== "all") {
    q = q.eq("brand", filters.brand);
  }

  const search = sanitizeSearchTerm(filters.search ?? "");
  if (search.length > 0) {
    q = applySearchFilter(q, search);
  }

  return q;
}

function applySort(query: QueryBuilder, sort: ProductSortOption = "updated_desc"): QueryBuilder {
  switch (sort) {
    case "updated_asc":
      return query.order("updated_at", { ascending: true });
    case "stock_desc":
      return query.order("quantity", { ascending: false }).order("model", { ascending: true });
    case "stock_asc":
      return query.order("quantity", { ascending: true }).order("model", { ascending: true });
    case "updated_desc":
    default:
      return query.order("updated_at", { ascending: false });
  }
}

export async function fetchProductsPaginated(
  filters: ProductListFilters = {}
): Promise<PaginatedProducts & { error?: string }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 50));

  if (isMockMode()) {
    return mockListProductsPaginated({ ...filters, page, pageSize });
  }

  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let countQuery = supabase.from("products").select("*", { count: "exact", head: true });
  countQuery = applyListFilters(countQuery, filters);

  let dataQuery = supabase.from("products").select("*");
  dataQuery = applyListFilters(dataQuery, filters);
  dataQuery = applySort(dataQuery, filters.sort);
  dataQuery = dataQuery.range(from, to);

  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (countError || dataError) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      error: countError?.message ?? dataError?.message,
    };
  }

  const total = count ?? 0;
  return {
    data: (data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function fetchProductBrands(
  categorySlug?: string
): Promise<{ data: string[]; error?: string }> {
  if (isMockMode()) {
    return { data: mockGetProductBrands(categorySlug) };
  }

  const supabase = await createClient();
  let query = supabase.from("products").select("brand");
  query = applyCategoryFilter(query, categorySlug);
  query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  const brands = [...new Set((data ?? []).map((r) => r.brand as string).filter(Boolean))].sort();
  return { data: brands };
}

function buildSidebarTree(
  rows: Array<{
    category: string | null;
    brand: string | null;
    model: string | null;
    model_type?: string | null;
  }>
): SidebarProductCategory[] {
  const byCategory = new Map<string, Map<string, Set<string>>>();

  for (const row of rows) {
    if (!row.category || !row.brand || !row.model) continue;
    const modelGroup =
      row.model_type?.trim() || deriveProductModelType(row.brand, row.model, row.category);
    if (!modelGroup) continue;

    if (!byCategory.has(row.category)) byCategory.set(row.category, new Map());

    const byBrand = byCategory.get(row.category)!;
    const brandGroup =
      row.category === "phone-cases" && modelGroup === "Other Phone Cases"
        ? "Other Phone Cases"
        : row.brand;
    if (!byBrand.has(brandGroup)) byBrand.set(brandGroup, new Set());
    byBrand.get(brandGroup)!.add(modelGroup);
  }

  return Array.from(byCategory.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, brandMap]) => ({
      category,
      brands: Array.from(brandMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([brand, models]) => ({
          brand,
          models: Array.from(models)
            .sort((a, b) => {
              const rankDiff = getModelTypeSortRank(b) - getModelTypeSortRank(a);
              return rankDiff || a.localeCompare(b);
            })
            .map((model) => ({ model })),
        })),
    }));
}

export async function fetchSidebarProductTree(): Promise<{
  data: SidebarProductCategory[];
  error?: string;
}> {
  if (isMockMode()) {
    const rows = mockListProducts("all")
      .filter((p) => p.is_active)
      .map((p) => ({
        category: String(p.category),
        brand: p.brand,
        model: p.model,
        model_type: p.model_type,
      }));
    return { data: buildSidebarTree(rows) };
  }

  const supabase = await createClient();
  const pageSize = 1000;
  const rows: Array<{
    category: string | null;
    brand: string | null;
    model: string | null;
    model_type: string | null;
  }> = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("category, brand, model, model_type")
      .eq("is_active", true)
      .neq("category", "devices")
      .order("category")
      .order("brand")
      .order("model")
      .range(offset, offset + pageSize - 1);

    if (error) return { data: [], error: error.message };

    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < pageSize) break;
  }

  return { data: buildSidebarTree(rows) };
}

export async function searchActiveProducts(
  search: string,
  limit = 50
): Promise<{ data: Product[]; error?: string }> {
  const term = sanitizeSearchTerm(search);
  if (term.length < 1) {
    return { data: [] };
  }

  if (isMockMode()) {
    return { data: mockSearchActiveProducts(term, limit) };
  }

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .neq("category", "devices");

  query = applySearchFilter(query, term);

  const { data, error } = await query.order("brand").order("model").limit(limit);

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)),
  };
}

export async function fetchProductByIdForSearch(productId: string): Promise<Product | null> {
  if (isMockMode()) {
    const { mockGetProduct } = await import("@/lib/mock-db");
    return mockGetProduct(productId);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  return data ? normalizeProduct(data as Record<string, unknown>) : null;
}
