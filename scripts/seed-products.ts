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

interface CrawlerProduct {
  name: string;
  price: string | null;
  product_url: string;
  image_url: string | null;
  category: string | null;
  source: string;
  crawled_at: string;
}

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

function extractCondition(name: string, category: string | null): string {
  const text = `${name} ${category ?? ""}`.toLowerCase();
  if (/grade\s*a\+\+/i.test(name)) return "Grade A++";
  if (/refurbish/i.test(text)) return "Refurbished";
  if (/compatible/i.test(text)) return "Compatible";
  if (/\bnew\b/i.test(text)) return "New";
  return "Standard";
}

function mapProduct(row: CrawlerProduct) {
  const brand = extractBrand(row.name, row.category);
  return {
    image_url: row.image_url || null,
    brand,
    model: extractModel(row.name, brand),
    storage_ram: extractStorageRam(row.name),
    color: extractColor(row.name),
    condition: extractCondition(row.name, row.category),
    category: resolveCategorySlug(row.category, row.name),
    sku: slugFromUrl(row.product_url),
    cost_price: 0,
    selling_price: parsePrice(row.price),
    quantity: 0,
    is_active: true,
  };
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

  const mapped = crawlerProducts.map(mapProduct);

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

  console.log(`Done. Upserted ${upserted} products (categories backfilled, quantities preserved).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
