/**
 * One-time / idempotent seed: maps bigm-crawler JSON → products table.
 * Requires SUPABASE_SERVICE_ROLE_KEY (never use in Next.js client).
 *
 * Usage: clone private bigm-crawler next to this repo, then npm run seed:local
 *
 * Data path: BIGM_PRODUCTS_JSON env, or ../bigm-crawler/data/bigm_products.json
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { resolveCategorySlug } from "../src/lib/categories";
import { deriveProductModelType } from "../src/lib/model-type";

interface CrawlerProduct {
  name: string;
  price: string | null;
  product_url: string;
  image_url: string | null;
  category: string | null;
  color?: string | null;
  source_sku?: string | null;
  source_variation_id?: number | null;
  variant_attributes?: Record<string, string>;
  source: string;
  crawled_at: string;
}

interface ExistingProductIdentity {
  id: string;
  sku: string;
  quantity: number;
  is_active: boolean;
  source_product_url: string | null;
  source_variation_id: number | null;
}

// CLI-only script: Supabase is intentionally untyped because this repo does not generate Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeedSupabaseClient = any;

const BRANDS = [
  "Apple",
  "Samsung",
  "Google",
  "OPPO",
  "Xiaomi",
  "Huawei",
  "Motorola",
  "Nokia",
  "Sony",
  "iPad",
  "iPhone",
];

const COLORS = [
  "Black",
  "White",
  "Blue",
  "Red",
  "Green",
  "Gold",
  "Silver",
  "Purple",
  "Pink",
  "Graphite",
  "Midnight",
  "Starlight",
  "Natural",
  "Titanium",
];

const BATCH_SIZE = 500;
// Supabase/PostgREST can reject very large `in (...)` lists with "URI too long".
// Deactivation reconciliation can involve thousands of ids, so we keep this smaller.
const DEACTIVATE_BATCH_SIZE = 200;

function slugFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1] ?? "";
    return slug.slice(0, 120) || `product-${Date.now()}`;
  } catch {
    return `product-${Date.now()}`;
  }
}

function parsePrice(price: string | null): number {
  if (!price) return 0;
  const match = price.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return 0;
  return parseFloat(match[1].replace(/,/g, "")) || 0;
}

function extractBrand(name: string, category: string | null): string {
  const combined = `${name} ${category ?? ""}`;
  for (const brand of BRANDS) {
    if (combined.toLowerCase().includes(brand.toLowerCase())) {
      return brand === "iPhone" || brand === "iPad" ? "Apple" : brand;
    }
  }
  if (category) {
    const first = category.split(/\s+/)[0];
    if (first && first.length > 1) return first;
  }
  return "Other";
}

function extractModel(name: string, brand: string): string {
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = name.replace(new RegExp(escaped, "i"), "").trim();
  return stripped || name;
}

function extractStorageRam(name: string): string | null {
  const slash = name.match(/(\d+\s*GB)\s*\/\s*(\d+\s*GB)/i);
  if (slash) return `${slash[1]} / ${slash[2]}`;
  const single = name.match(/\b(\d+\s*GB)\b/i);
  return single ? single[1] : null;
}

function extractColor(name: string): string {
  for (const color of COLORS) {
    if (name.toLowerCase().includes(color.toLowerCase())) return color;
  }
  return "Unknown";
}

function normalizeSourceSku(sourceSku: string | null | undefined): string | null {
  const sku = sourceSku?.trim();
  return sku || null;
}

function appendNonColorVariantLabels(model: string, row: CrawlerProduct): string {
  const labels = Object.entries(row.variant_attributes ?? {})
    .filter(([name, value]) => name !== "color" && value.trim().length > 0)
    .map(([, value]) => value.trim());
  if (labels.length === 0) return model;
  return `${model} - ${labels.join(" / ")}`;
}

function crawlerRowKey(row: Pick<CrawlerProduct, "product_url" | "source_variation_id">): string {
  if (row.source_variation_id != null) {
    return `variation:${row.source_variation_id}`;
  }
  return `product:${row.product_url}`;
}

function existingRowKey(
  row: Pick<ExistingProductIdentity, "source_product_url" | "source_variation_id">
): string | null {
  if (row.source_variation_id != null) {
    return `variation:${row.source_variation_id}`;
  }
  if (row.source_product_url) {
    return `product:${row.source_product_url}`;
  }
  return null;
}

function variationFallbackSku(row: CrawlerProduct): string {
  return `${slugFromUrl(row.product_url)}--variation-${row.source_variation_id}`;
}

function extractCondition(name: string, category: string | null): string {
  const text = `${name} ${category ?? ""}`.toLowerCase();
  if (/grade\s*a\+\+/i.test(name)) return "Grade A++";
  if (/refurbish/i.test(text)) return "Refurbished";
  if (/compatible/i.test(text)) return "Compatible";
  if (/\bnew\b/i.test(text)) return "New";
  return "Standard";
}

function mapProduct(row: CrawlerProduct, sku: string) {
  const brand = extractBrand(row.name, row.category);
  const model = appendNonColorVariantLabels(extractModel(row.name, brand), row);
  return {
    image_url: row.image_url || null,
    brand,
    model_type: deriveProductModelType(brand, model, resolveCategorySlug(row.category, row.name)),
    model,
    storage_ram: extractStorageRam(row.name),
    color: row.color?.trim() || extractColor(row.name),
    condition: extractCondition(row.name, row.category),
    category: resolveCategorySlug(row.category, row.name),
    sku,
    source_product_url: row.product_url,
    source_variation_id: row.source_variation_id ?? null,
    source_sku: normalizeSourceSku(row.source_sku),
    variant_attributes: row.variant_attributes ?? {},
    cost_price: 0,
    selling_price: parsePrice(row.price),
    quantity: 0,
    is_active: true,
  };
}

async function fetchAllProductIdentities(
  supabase: SeedSupabaseClient
): Promise<ExistingProductIdentity[]> {
  const pageSize = 1000;
  const products: ExistingProductIdentity[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, quantity, is_active, source_product_url, source_variation_id")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to read existing product identities: ${error.message}`);
    products.push(...((data ?? []) as ExistingProductIdentity[]));
    if ((data ?? []).length < pageSize) break;
  }

  return products;
}

function chooseInventorySkus(
  crawlerProducts: CrawlerProduct[],
  existingProducts: ExistingProductIdentity[]
): Map<string, string> {
  const dbBySku = new Map(existingProducts.map((row) => [row.sku, row]));
  const existingByVariationId = new Map(
    existingProducts
      .filter((row) => row.source_variation_id != null)
      .map((row) => [row.source_variation_id as number, row])
  );
  const claimedSkus = new Set<string>();
  const skuByCrawlerKey = new Map<string, string>();

  for (const row of crawlerProducts) {
    const rowKey = crawlerRowKey(row);
    if (skuByCrawlerKey.has(rowKey)) continue;

    let sku = slugFromUrl(row.product_url);
    if (row.source_variation_id != null) {
      const existingVariation = existingByVariationId.get(row.source_variation_id);
      if (existingVariation) {
        sku = existingVariation.sku;
      } else {
        const preferredSku = normalizeSourceSku(row.source_sku);
        const fallbackSku = variationFallbackSku(row);
        sku =
          preferredSku && !dbBySku.has(preferredSku) && !claimedSkus.has(preferredSku)
            ? preferredSku
            : fallbackSku;

        const conflictingRow = dbBySku.get(sku);
        if (
          claimedSkus.has(sku) ||
          (conflictingRow && conflictingRow.source_variation_id !== row.source_variation_id)
        ) {
          throw new Error(`Cannot assign stable variation SKU without collision: ${sku}`);
        }
      }
    }

    claimedSkus.add(sku);
    skuByCrawlerKey.set(rowKey, sku);
  }

  return skuByCrawlerKey;
}

async function deactivateProducts(
  supabase: SeedSupabaseClient,
  ids: string[]
): Promise<void> {
  for (let i = 0; i < ids.length; i += DEACTIVATE_BATCH_SIZE) {
    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .in("id", ids.slice(i, i + DEACTIVATE_BATCH_SIZE));
    if (error) throw new Error(`Failed to deactivate stale crawler rows: ${error.message}`);
  }
}

async function reconcileLegacyAndStaleCrawlerRows(
  supabase: SeedSupabaseClient,
  crawlerProducts: CrawlerProduct[],
  activeCrawlerKeys: Set<string>,
  activeSkus: Set<string>
): Promise<void> {
  const existingProducts = await fetchAllProductIdentities(supabase);
  const bySku = new Map(existingProducts.map((row) => [row.sku, row]));
  const legacyParentIds: string[] = [];
  const variationParentUrls = new Set(
    crawlerProducts
      .filter((row) => row.source_variation_id != null)
      .map((row) => row.product_url)
  );

  for (const productUrl of variationParentUrls) {
    const parentSku = slugFromUrl(productUrl);
    const parent = bySku.get(parentSku);
    if (!parent || activeSkus.has(parentSku)) continue;
    if (parent.quantity > 0) {
      console.warn(
        `Keeping stocked legacy parent active for manual split: ${parent.sku} (${parent.quantity})`
      );
      continue;
    }
    legacyParentIds.push(parent.id);
  }

  await deactivateProducts(supabase, legacyParentIds);

  const refreshedProducts = await fetchAllProductIdentities(supabase);
  const staleIds: string[] = [];
  for (const product of refreshedProducts) {
    const rowKey = existingRowKey(product);
    if (!rowKey || activeCrawlerKeys.has(rowKey)) continue;
    if (product.quantity > 0) {
      console.warn(
        `Keeping stocked stale crawler row active for manual review: ${product.sku} (${product.quantity})`
      );
      continue;
    }
    staleIds.push(product.id);
  }

  await deactivateProducts(supabase, staleIds);
  console.log(
    `Reconciled crawler rows: deactivated ${legacyParentIds.length} legacy parents and ${staleIds.length} stale rows.`
  );
}

function resolveCrawlerJsonPath(): string {
  if (process.env.BIGM_PRODUCTS_JSON) {
    return resolve(process.env.BIGM_PRODUCTS_JSON);
  }

  const defaultPath = resolve(
    process.cwd(),
    "../bigm-crawler/data/bigm_products.json"
  );
  if (existsSync(defaultPath)) return defaultPath;

  console.error(
    "Crawler data not found.\n" +
      "  Clone the private bigm-crawler repo as a sibling folder, or set BIGM_PRODUCTS_JSON.\n" +
      `  Expected: ${defaultPath}`
  );
  process.exit(1);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
    );
    process.exit(1);
  }

  const jsonPath = resolveCrawlerJsonPath();
  const raw = readFileSync(jsonPath, "utf-8");
  const crawlerProducts = JSON.parse(raw) as CrawlerProduct[];

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const existingProducts = await fetchAllProductIdentities(supabase);
  const skuByCrawlerKey = chooseInventorySkus(crawlerProducts, existingProducts);
  const mapped = crawlerProducts.map((row) =>
    mapProduct(row, skuByCrawlerKey.get(crawlerRowKey(row))!)
  );

  // Deduplicate by SKU (keep first occurrence)
  const bySku = new Map<string, (typeof mapped)[0]>();
  for (const p of mapped) {
    if (!bySku.has(p.sku)) bySku.set(p.sku, p);
  }
  const unique = Array.from(bySku.values());

  console.log(`Seeding ${unique.length} products (${crawlerProducts.length} raw rows)...`);

  let upserted = 0;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const skus = batch.map((p) => p.sku);

    const { data: existing } = await supabase
      .from("products")
      .select("sku, quantity")
      .in("sku", skus);

    const qtyBySku = new Map(
      (existing ?? []).map((row) => [row.sku as string, row.quantity as number])
    );

    const merged = batch.map((p) => ({
      ...p,
      quantity: qtyBySku.get(p.sku) ?? p.quantity,
    }));

    const { error } = await supabase.from("products").upsert(merged, {
      onConflict: "sku",
    });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
      process.exit(1);
    }

    upserted += batch.length;
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: upserted ${batch.length} rows`);
  }

  await reconcileLegacyAndStaleCrawlerRows(
    supabase,
    crawlerProducts,
    new Set(crawlerProducts.map(crawlerRowKey)),
    new Set(unique.map((product) => product.sku))
  );

  console.log(`Done. Upserted ${upserted} products (categories backfilled, quantities preserved).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
