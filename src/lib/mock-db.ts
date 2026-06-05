import type {
  Product,
  ProductInsert,
  ProductListFilters,
  ProductSortOption,
  RepairJob,
  RepairJobInput,
  StockAction,
  StockLog,
  StockReceipt,
  StockReceiptInput,
  StockReceiptItem,
  StockReceiptWithItems,
} from "@/types/database";
import { HIDDEN_CATEGORY_SLUGS, SIDEBAR_CATEGORIES } from "@/lib/categories";
import {
  canonicalizeModelType,
  deriveProductModelType,
  effectiveProductModelType,
  productMatchesModelTypeFilter,
} from "@/lib/model-type";
import { productMatchesTokenizedSearch } from "@/lib/search-utils";
import { expandNewProductLine, receiptTotalQuantity } from "@/lib/stock-receipt-expand";

const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  return crypto.randomUUID();
}

const SEED_PRODUCTS: Product[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    image_url:
      "https://i0.wp.com/bigmmobile.com.au/wp-content/uploads/2025/12/imgi_564_bc1fd377-1d4e-4dd6-9d92-1269850afdb3-1_b1c1bc55-a547-49f1-b9c3-3afd83e141b8.jpeg?fit=1024%2C1024&ssl=1",
    brand: "Apple",
    model: "iPhone 12 256GB Grade A++",
    storage_ram: "256GB",
    color: "Black",
    condition: "Grade A++",
    category: "devices",
    sku: "iphone-12-256gb-grade-a-2",
    cost_price: 450,
    selling_price: 599,
    quantity: 5,
    is_active: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    image_url: null,
    brand: "Apple",
    model: "iPhone 15 Pro 256GB",
    storage_ram: "256GB",
    color: "Natural Titanium",
    condition: "Refurbished",
    category: "devices",
    sku: "iphone-15-pro-256gb",
    cost_price: 980,
    selling_price: 1199,
    quantity: 2,
    is_active: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    image_url: null,
    brand: "Samsung",
    model: "Galaxy S24 Ultra 512GB",
    storage_ram: "512GB",
    color: "Black",
    condition: "New",
    category: "devices",
    sku: "samsung-galaxy-s24-ultra-512",
    cost_price: 1350,
    selling_price: 1599,
    quantity: 1,
    is_active: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    image_url: null,
    brand: "Google",
    model: "Pixel 8 128GB",
    storage_ram: "128GB",
    color: "Obsidian",
    condition: "Refurbished",
    category: "devices",
    sku: "google-pixel-8-128gb",
    cost_price: 520,
    selling_price: 649,
    quantity: 0,
    is_active: false,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    image_url:
      "https://i0.wp.com/bigmmobile.com.au/wp-content/uploads/2025/04/9H-Full-Coverage-TPG-Samsung.jpg?fit=1200%2C1200&ssl=1",
    brand: "Samsung",
    model: "Galaxy Z Series Screen Protector",
    storage_ram: null,
    color: "Unknown",
    condition: "New",
    category: "screen-protectors",
    sku: "9h-og-full-coverage-tpg-screen-protectorsub-screen-samsung-galaxy-z-series",
    cost_price: 12,
    selling_price: 49.99,
    quantity: 8,
    is_active: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    image_url: null,
    brand: "Generic",
    model: "Clear Hard Case iPhone 15",
    storage_ram: null,
    color: "Clear",
    condition: "New",
    category: "phone-cases",
    sku: "clear-hard-case-iphone-15",
    cost_price: 5,
    selling_price: 19.99,
    quantity: 12,
    is_active: true,
    created_at: now(),
    updated_at: now(),
  },
];

interface MockStore {
  products: Product[];
  stockLogs: StockLog[];
  receipts: StockReceipt[];
  receiptItems: StockReceiptItem[];
  repairJobs: RepairJob[];
}

function createStore(): MockStore {
  return {
    products: SEED_PRODUCTS.map((p) => ({ ...p })),
    stockLogs: [],
    receipts: [],
    receiptItems: [],
    repairJobs: [],
  };
}

const globalForMock = globalThis as unknown as { __mockStore?: MockStore };

function getStore(): MockStore {
  if (!globalForMock.__mockStore) {
    globalForMock.__mockStore = createStore();
  }
  if (!globalForMock.__mockStore.repairJobs) {
    globalForMock.__mockStore.repairJobs = [];
  }
  return globalForMock.__mockStore;
}

export function mockListProducts(categorySlug?: string): Product[] {
  let list = getStore().products;
  if (categorySlug && categorySlug !== "all") {
    list = list.filter((p) => p.category === categorySlug);
  } else {
    list = list.filter((p) => !HIDDEN_CATEGORY_SLUGS.has(p.category as never));
  }
  return [...list].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export function mockGetCategoryCounts(): Record<string, number> {
  const products = getStore().products.filter(
    (p) => !HIDDEN_CATEGORY_SLUGS.has(p.category as never)
  );
  const counts: Record<string, number> = { all: products.length };
  for (const cat of SIDEBAR_CATEGORIES) {
    if (cat.slug === "all") continue;
    counts[cat.slug] = getStore().products.filter((p) => p.category === cat.slug).length;
  }
  return counts;
}

export function mockGetDashboardData() {
  const products = getStore().products.filter(
    (p) => !HIDDEN_CATEGORY_SLUGS.has(p.category as never) && p.is_active
  );
  const lowStockItems = products.filter((p) => p.quantity > 0 && p.quantity < 3);
  const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);
  const inventoryValue = products.reduce(
    (sum, p) => sum + p.quantity * Number(p.cost_price),
    0
  );
  return {
    totalSkus: products.length,
    totalUnits,
    inventoryValue,
    lowStockItems: lowStockItems.slice(0, 50).map((p) => ({
      id: p.id,
      brand: p.brand,
      model: p.model,
      sku: p.sku,
      quantity: p.quantity,
    })),
    error: undefined as string | undefined,
  };
}

function filterProductsForList(
  products: Product[],
  filters: ProductListFilters
): Product[] {
  let list = products;
  if (filters.categorySlug && filters.categorySlug !== "all") {
    list = list.filter((p) => p.category === filters.categorySlug);
  } else {
    list = list.filter((p) => !HIDDEN_CATEGORY_SLUGS.has(p.category as never));
  }
  if (filters.hideInactive !== false) {
    list = list.filter((p) => p.is_active);
  }
  if (filters.hideZeroStock) {
    list = list.filter((p) => p.quantity > 0);
  }
  if (filters.lowStockOnly) {
    list = list.filter((p) => p.quantity > 0 && p.quantity < 3);
  }
  if (filters.brand && filters.brand !== "all") {
    list = list.filter((p) => p.brand === filters.brand);
  }

  const modelType = canonicalizeModelType((filters.modelType ?? "").trim());
  const modelTypePrefix = (filters.modelTypePrefix ?? "").trim();
  if (modelType) {
    list = list.filter((p) =>
      productMatchesModelTypeFilter(
        modelType,
        p.brand,
        p.model,
        p.model_type,
        String(p.category)
      )
    );
  } else if (modelTypePrefix) {
    const prefix = modelTypePrefix.toLowerCase();
    list = list.filter((p) => {
      const effective = effectiveProductModelType(
        p.brand,
        p.model,
        String(p.category),
        p.model_type
      ).toLowerCase();
      return (
        effective.startsWith(prefix) ||
        (p.model_type ?? "").toLowerCase().startsWith(prefix) ||
        p.model.toLowerCase().includes(prefix)
      );
    });
  }

  const q = (filters.search ?? "").trim();
  if (q && !modelType && !modelTypePrefix) {
    list = list.filter((p) =>
      productMatchesTokenizedSearch(p.brand, p.model, p.sku, q, p.model_type ?? "")
    );
  }
  return list;
}

function sortProductsForList(list: Product[], sort: ProductSortOption = "updated_desc"): Product[] {
  const sorted = [...list];
  switch (sort) {
    case "updated_asc":
      return sorted.sort(
        (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
    case "stock_desc":
      return sorted.sort((a, b) => b.quantity - a.quantity || a.model.localeCompare(b.model));
    case "stock_asc":
      return sorted.sort((a, b) => a.quantity - b.quantity || a.model.localeCompare(b.model));
    case "updated_desc":
    default:
      return sorted.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
  }
}

export function mockListProductsPaginated(filters: ProductListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 50));
  const filtered = sortProductsForList(
    filterProductsForList(getStore().products, filters),
    filters.sort
  );
  const total = filtered.length;
  const from = (page - 1) * pageSize;
  const data = filtered.slice(from, from + pageSize);
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function mockGetProductBrands(categorySlug?: string): string[] {
  const list = filterProductsForList(getStore().products, {
    categorySlug,
    hideInactive: true,
  });
  return [...new Set(list.map((p) => p.brand))].sort();
}

export function mockSearchActiveProducts(search: string, limit: number): Product[] {
  const q = search.trim();
  return filterProductsForList(getStore().products, {
    hideInactive: true,
    search: q,
  }).slice(0, limit);
}

export function mockListActiveProductsByModelType(modelType: string): Product[] {
  return filterProductsForList(getStore().products, {
    hideInactive: true,
    modelType,
  }).sort((a, b) => {
    const colorCmp = (a.color ?? "").localeCompare(b.color ?? "");
    return colorCmp || a.model.localeCompare(b.model);
  });
}

export function mockListActiveProductsByModel(search: string, limit: number): Product[] {
  const q = search.trim().toLowerCase();
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const product of getStore().products) {
    if (!product.is_active || product.category === "devices") continue;
    if (!product.model.toLowerCase().includes(q)) continue;
    if (seen.has(product.model)) continue;
    seen.add(product.model);
    result.push(product);
    if (result.length >= limit) break;
  }
  return result;
}

export function mockGetProduct(productId: string): Product | null {
  return getStore().products.find((p) => p.id === productId) ?? null;
}

export function mockAddProduct(data: ProductInsert): { error?: string } {
  const store = getStore();
  if (store.products.some((p) => p.sku === data.sku)) {
    return { error: "SKU already exists" };
  }

  const product: Product = {
    id: id(),
    image_url: data.image_url ?? null,
    brand: data.brand,
    model_type: data.model_type || deriveProductModelType(data.brand, data.model, data.category),
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
    created_at: now(),
    updated_at: now(),
  };

  store.products.push(product);

  if (data.quantity > 0) {
    store.stockLogs.push({
      id: id(),
      product_id: product.id,
      user_id: MOCK_USER_ID,
      action: "INITIAL_ADD",
      quantity_changed: data.quantity,
      new_quantity: data.quantity,
      created_at: now(),
    });
  }

  return {};
}

export function mockUpdateProduct(
  productId: string,
  data: ProductInsert
): { error?: string } {
  const store = getStore();
  const index = store.products.findIndex((p) => p.id === productId);
  if (index === -1) return { error: "Product not found" };

  if (store.products.some((p) => p.sku === data.sku && p.id !== productId)) {
    return { error: "SKU already exists" };
  }

  const current = store.products[index];
  const prevQty = current.quantity;
  const newQty = data.quantity;

  store.products[index] = {
    ...current,
    image_url: data.image_url ?? null,
    brand: data.brand,
    model_type: data.model_type || deriveProductModelType(data.brand, data.model, data.category),
    model: data.model,
    storage_ram: data.storage_ram ?? null,
    color: data.color ?? null,
    condition: data.condition ?? null,
    category: data.category,
    sku: data.sku,
    cost_price: data.cost_price,
    selling_price: data.selling_price,
    quantity: newQty,
    is_active: data.is_active ?? current.is_active,
    updated_at: now(),
  };

  if (newQty !== prevQty) {
    const delta = newQty - prevQty;
    store.stockLogs.push({
      id: id(),
      product_id: productId,
      user_id: MOCK_USER_ID,
      action: delta > 0 ? "ADJUSTED_UP" : "ADJUSTED_DOWN",
      quantity_changed: Math.abs(delta),
      new_quantity: newQty,
      created_at: now(),
    });
  }

  return {};
}

export function mockAdjustStock(
  productId: string,
  delta: number
): { error?: string; quantity?: number } {
  const store = getStore();
  const product = store.products.find((p) => p.id === productId);
  if (!product) return { error: "Product not found" };

  const currentQty = product.quantity;
  const newQty = Math.max(0, currentQty + delta);
  if (newQty === currentQty) return { quantity: newQty };

  const actualDelta = newQty - currentQty;
  const action: StockAction = actualDelta > 0 ? "ADJUSTED_UP" : "ADJUSTED_DOWN";

  product.quantity = newQty;
  product.updated_at = now();

  store.stockLogs.push({
    id: id(),
    product_id: productId,
    user_id: MOCK_USER_ID,
    action,
    quantity_changed: Math.abs(actualDelta),
    new_quantity: newQty,
    created_at: now(),
  });

  return { quantity: newQty };
}

export function mockListActiveProducts(): Product[] {
  return getStore()
    .products.filter(
      (p) => p.is_active && !HIDDEN_CATEGORY_SLUGS.has(p.category as never)
    )
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
}

export function mockSubmitStockReceipt(
  userId: string,
  userEmail: string,
  input: StockReceiptInput
): { receiptId?: string; error?: string } {
  const store = getStore();
  const usedSkus = new Set<string>();
  for (const line of input.lines) {
    if (line.mode !== "new") continue;
    const { rows, error } = expandNewProductLine(line);
    if (error) return { error };
    for (const row of rows) {
      if (usedSkus.has(row.sku)) return { error: `Duplicate SKU in receipt: ${row.sku}` };
      usedSkus.add(row.sku);
    }
  }

  const totalQuantity = receiptTotalQuantity(input.lines);

  const receipt: StockReceipt = {
    id: id(),
    user_id: userId,
    received_by_email: userEmail || null,
    invoice_number: input.invoice_number ?? null,
    note: input.note ?? null,
    total_quantity: totalQuantity,
    created_at: now(),
  };

  const pendingItems: StockReceiptItem[] = [];

  function receiveProduct(product: Product, quantityReceived: number) {
    const prevQty = product.quantity;
    const newQty = prevQty + quantityReceived;
    product.quantity = newQty;
    product.updated_at = now();

    pendingItems.push({
      id: id(),
      receipt_id: receipt.id,
      product_id: product.id,
      sku: product.sku,
      brand: product.brand,
      model: product.model,
      category: product.category as string,
      quantity_received: quantityReceived,
      previous_quantity: prevQty,
      new_quantity: newQty,
      created_at: now(),
    });

    store.stockLogs.push({
      id: id(),
      product_id: product.id,
      user_id: userId,
      action: "RECEIVED_STOCK" as StockAction,
      quantity_changed: quantityReceived,
      new_quantity: newQty,
      created_at: now(),
    });
  }

  for (const line of input.lines) {
    if (line.mode === "existing") {
      const product = store.products.find(
        (p) => p.id === line.product_id && p.is_active
      );
      if (!product) return { error: "Product not found or inactive" };
      if (!line.quantity_received || line.quantity_received < 1) {
        return { error: "Existing line missing quantity" };
      }
      receiveProduct(product, line.quantity_received);
      continue;
    }

    const { rows, error: expandError } = expandNewProductLine(line);
    if (expandError) return { error: expandError };

    for (const row of rows) {
      if (store.products.some((p) => p.sku === row.sku)) {
        return { error: `SKU already exists (${row.color}): ${row.sku}` };
      }

      const product: Product = {
        id: id(),
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
        created_at: now(),
        updated_at: now(),
      };
      store.products.push(product);
      receiveProduct(product, row.quantity_received);
    }
  }

  store.receipts.unshift(receipt);
  store.receiptItems.push(...pendingItems);
  return { receiptId: receipt.id };
}

export function mockListStockReceipts(): StockReceipt[] {
  return [...getStore().receipts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function mockGetStockReceipt(receiptId: string): StockReceiptWithItems | null {
  const store = getStore();
  const receipt = store.receipts.find((r) => r.id === receiptId);
  if (!receipt) return null;
  return {
    ...receipt,
    items: store.receiptItems.filter((i) => i.receipt_id === receiptId),
  };
}

export function mockSetProductActive(
  productId: string,
  isActive: boolean
): { error?: string } {
  const store = getStore();
  const product = store.products.find((p) => p.id === productId);
  if (!product) return { error: "Product not found" };

  product.is_active = isActive;
  product.updated_at = now();
  return {};
}

interface MockListRepairJobsOptions {
  q?: string;
  fromDate?: string;
  toDate?: string;
}

function repairJobMatchesSearch(job: RepairJob, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const phoneNeedle = needle.replace(/\s+/g, "");
  const name = job.customer_name.toLowerCase();
  const phone = (job.phone_number ?? "").toLowerCase().replace(/\s+/g, "");
  return name.includes(needle) || phone.includes(phoneNeedle);
}

function repairJobMatchesDateRange(
  job: RepairJob,
  fromDate?: string,
  toDate?: string
): boolean {
  const time = new Date(job.repair_date).getTime();
  if (fromDate && time < new Date(fromDate).getTime()) return false;
  if (toDate && time > new Date(toDate).getTime()) return false;
  return true;
}

export function mockListRepairJobs(options: MockListRepairJobsOptions = {}): RepairJob[] {
  const jobs = getStore().repairJobs.filter(
    (job) =>
      repairJobMatchesSearch(job, options.q ?? "") &&
      repairJobMatchesDateRange(job, options.fromDate, options.toDate)
  );
  return jobs.sort(
    (a, b) => new Date(b.repair_date).getTime() - new Date(a.repair_date).getTime()
  );
}

export function mockBulkCreateRepairJobs(
  userId: string,
  userEmail: string,
  inputs: RepairJobInput[]
): { imported: number; error?: string } {
  for (const input of inputs) {
    mockCreateRepairJob(userId, userEmail, input);
  }
  return { imported: inputs.length };
}

export function mockGetRepairJob(jobId: string): RepairJob | null {
  return getStore().repairJobs.find((job) => job.id === jobId) ?? null;
}

export function mockCreateRepairJob(
  userId: string,
  userEmail: string,
  input: RepairJobInput
): { data?: RepairJob; error?: string } {
  const store = getStore();
  const timestamp = now();
  const job: RepairJob = {
    id: id(),
    user_id: userId,
    recorded_by_email: userEmail || null,
    customer_name: input.customer_name,
    phone_number: input.phone_number || null,
    device_model: input.device_model,
    issue: input.issue,
    parts_used: input.parts_used,
    repair_date: input.repair_date,
    created_at: timestamp,
    updated_at: timestamp,
  };
  store.repairJobs.unshift(job);
  return { data: job };
}

export function mockUpdateRepairJob(
  jobId: string,
  input: RepairJobInput
): { data?: RepairJob; error?: string } {
  const store = getStore();
  const job = store.repairJobs.find((item) => item.id === jobId);
  if (!job) return { error: "Repair job not found" };

  job.customer_name = input.customer_name;
  job.phone_number = input.phone_number || null;
  job.device_model = input.device_model;
  job.issue = input.issue;
  job.parts_used = input.parts_used;
  job.repair_date = input.repair_date;
  job.updated_at = now();
  return { data: job };
}

export function mockDeleteRepairJob(jobId: string): { error?: string } {
  const store = getStore();
  const index = store.repairJobs.findIndex((item) => item.id === jobId);
  if (index === -1) return { error: "Repair job not found" };
  store.repairJobs.splice(index, 1);
  return {};
}

export { MOCK_USER_ID };
