import type { Product, ProductInsert, StockAction, StockLog } from "@/types/database";

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
    sku: "iphone-12-256gb-grade-a-2",
    cost_price: 450,
    selling_price: 599,
    quantity: 5,
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
    sku: "iphone-15-pro-256gb",
    cost_price: 980,
    selling_price: 1199,
    quantity: 2,
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
    sku: "samsung-galaxy-s24-ultra-512",
    cost_price: 1350,
    selling_price: 1599,
    quantity: 1,
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
    sku: "google-pixel-8-128gb",
    cost_price: 520,
    selling_price: 649,
    quantity: 0,
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
    sku: "9h-og-full-coverage-tpg-screen-protectorsub-screen-samsung-galaxy-z-series",
    cost_price: 12,
    selling_price: 49.99,
    quantity: 8,
    created_at: now(),
    updated_at: now(),
  },
];

interface MockStore {
  products: Product[];
  stockLogs: StockLog[];
}

function createStore(): MockStore {
  return {
    products: SEED_PRODUCTS.map((p) => ({ ...p })),
    stockLogs: [],
  };
}

const globalForMock = globalThis as unknown as { __mockStore?: MockStore };

function getStore(): MockStore {
  if (!globalForMock.__mockStore) {
    globalForMock.__mockStore = createStore();
  }
  return globalForMock.__mockStore;
}

export function mockListProducts(): Product[] {
  return [...getStore().products].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export function mockGetDashboardData() {
  const products = getStore().products;
  const lowStockItems = products.filter((p) => p.quantity > 0 && p.quantity < 3);
  return {
    products: products.map((p) => ({
      quantity: p.quantity,
      cost_price: p.cost_price,
    })),
    lowStockItems: lowStockItems.map((p) => ({
      id: p.id,
      brand: p.brand,
      model: p.model,
      sku: p.sku,
      quantity: p.quantity,
    })),
  };
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
    model: data.model,
    storage_ram: data.storage_ram ?? null,
    color: data.color ?? null,
    condition: data.condition ?? null,
    sku: data.sku,
    cost_price: data.cost_price,
    selling_price: data.selling_price,
    quantity: data.quantity,
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

export { MOCK_USER_ID };
