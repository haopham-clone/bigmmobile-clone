import type { CategorySlug } from "@/lib/categories";

export type StockAction = "INITIAL_ADD" | "ADJUSTED_UP" | "ADJUSTED_DOWN" | "RECEIVED_STOCK";

export interface Product {
  id: string;
  image_url: string | null;
  brand: string;
  model_type?: string | null;
  model: string;
  storage_ram: string | null;
  color: string | null;
  condition: string | null;
  category: CategorySlug | string;
  sku: string;
  source_product_url?: string | null;
  source_variation_id?: number | null;
  source_sku?: string | null;
  variant_attributes?: Record<string, string>;
  cost_price: number;
  selling_price: number;
  quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLog {
  id: string;
  product_id: string;
  user_id: string;
  action: StockAction;
  quantity_changed: number;
  new_quantity: number;
  created_at: string;
}

export interface ProductInsert {
  image_url?: string | null;
  brand: string;
  model_type?: string | null;
  model: string;
  storage_ram?: string | null;
  color?: string | null;
  condition?: string | null;
  category: CategorySlug | string;
  sku: string;
  source_product_url?: string | null;
  source_variation_id?: number | null;
  source_sku?: string | null;
  variant_attributes?: Record<string, string>;
  cost_price: number;
  selling_price: number;
  quantity: number;
  is_active?: boolean;
}

export type ProductUpdate = ProductInsert;

export type CategoryCounts = Record<string, number>;

export type ProductSortOption = "updated_desc" | "updated_asc" | "stock_desc" | "stock_asc";

export interface ProductListFilters {
  categorySlug?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  /** Exact sidebar tab filter (model_type column). */
  modelType?: string;
  /** Prefix sidebar tab filter for series groups (e.g. Galaxy S). */
  modelTypePrefix?: string;
  brand?: string;
  sort?: ProductSortOption;
  lowStockOnly?: boolean;
  hideZeroStock?: boolean;
  hideInactive?: boolean;
}

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StockReceipt {
  id: string;
  user_id: string;
  received_by_email: string | null;
  invoice_number: string | null;
  note: string | null;
  total_quantity: number;
  created_at: string;
}

export interface StockReceiptItem {
  id: string;
  receipt_id: string;
  product_id: string;
  sku: string;
  brand: string;
  model: string;
  category: string;
  quantity_received: number;
  previous_quantity: number;
  new_quantity: number;
  created_at: string;
}

export interface StockReceiptWithItems extends StockReceipt {
  items: StockReceiptItem[];
}

export interface StockReceiptColorVariantInput {
  color: string;
  quantity_received: number;
  sku?: string;
}

export interface StockReceiptLineInput {
  mode: "existing" | "new";
  product_id?: string;
  /** Required for existing lines; optional for new lines when color_variants is set. */
  quantity_received?: number;
  // new product fields
  brand?: string;
  model_type?: string | null;
  model?: string;
  /** Optional base SKU for auto-generating per-color SKUs. */
  base_sku?: string;
  sku?: string;
  category?: string;
  cost_price?: number;
  selling_price?: number;
  storage_ram?: string | null;
  color?: string | null;
  color_variants?: StockReceiptColorVariantInput[];
  condition?: string | null;
  image_url?: string | null;
}

export interface StockReceiptInput {
  invoice_number?: string | null;
  note?: string | null;
  lines: StockReceiptLineInput[];
}

export interface RepairJob {
  id: string;
  user_id: string;
  recorded_by_email: string | null;
  customer_name: string;
  phone_number: string | null;
  device_model: string;
  issue: string;
  parts_used: string;
  price: number | null;
  repair_date: string;
  created_at: string;
  updated_at: string;
}

export interface RepairJobInput {
  customer_name: string;
  phone_number?: string;
  device_model: string;
  issue: string;
  parts_used: string;
  price?: number | null;
  repair_date: string;
}
