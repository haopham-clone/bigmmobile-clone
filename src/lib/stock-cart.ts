import type { StockReceiptLineInput } from "@/types/database";

export const STOCK_CART_STORAGE_KEY = "stock-in-cart-v1";
export const STOCK_CART_PENDING_ADD_KEY = "stock-in-pending-add-v1";

export interface StockCartExistingItem {
  cartId: string;
  mode: "existing";
  product_id: string;
  sku: string;
  brand: string;
  model: string;
  color: string;
  quantity_received: number;
}

export interface StockCartNewItem {
  cartId: string;
  mode: "new";
  brand: string;
  model_type?: string;
  model: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  storage_ram?: string;
  condition?: string;
  color: string;
  quantity_received: number;
  base_sku?: string;
}

export type StockCartItem = StockCartExistingItem | StockCartNewItem;

export interface StockCartDraft {
  version: 1;
  invoiceNumber: string;
  note: string;
  items: StockCartItem[];
}

export interface StockCartPendingAdd {
  product_id: string;
  quantity_received: number;
}

function newCartId(): string {
  return crypto.randomUUID();
}

export function createEmptyCartDraft(invoiceNumber: string): StockCartDraft {
  return {
    version: 1,
    invoiceNumber,
    note: "",
    items: [],
  };
}

export function cartTotalQuantity(items: StockCartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity_received, 0);
}

export type StockCartItemInput =
  | Omit<StockCartExistingItem, "cartId">
  | Omit<StockCartNewItem, "cartId">;

export function mergeCartItem(
  items: StockCartItem[],
  incoming: StockCartItemInput
): StockCartItem[] {
  if (incoming.mode === "existing") {
    const index = items.findIndex(
      (item) => item.mode === "existing" && item.product_id === incoming.product_id
    );
    if (index === -1) {
      return [...items, { ...incoming, cartId: newCartId() }];
    }
    return items.map((item, i) =>
      i === index
        ? {
            ...item,
            quantity_received: item.quantity_received + incoming.quantity_received,
          }
        : item
    );
  }

  const index = items.findIndex(
    (item) =>
      item.mode === "new" &&
      item.sku === incoming.sku &&
      item.brand === incoming.brand &&
      item.model === incoming.model &&
      item.color === incoming.color
  );
  if (index === -1) {
    return [...items, { ...incoming, cartId: newCartId() }];
  }
  return items.map((item, i) =>
    i === index
      ? {
          ...item,
          quantity_received: item.quantity_received + incoming.quantity_received,
        }
      : item
  );
}

export function updateCartItemQuantity(
  items: StockCartItem[],
  cartId: string,
  quantity: number
): StockCartItem[] {
  if (quantity <= 0) {
    return items.filter((item) => item.cartId !== cartId);
  }
  return items.map((item) =>
    item.cartId === cartId ? { ...item, quantity_received: quantity } : item
  );
}

export function removeCartItem(items: StockCartItem[], cartId: string): StockCartItem[] {
  return items.filter((item) => item.cartId !== cartId);
}

export function flattenCartToReceiptLines(items: StockCartItem[]): StockReceiptLineInput[] {
  const lines: StockReceiptLineInput[] = [];

  for (const item of items) {
    if (item.mode === "existing") {
      lines.push({
        mode: "existing",
        product_id: item.product_id,
        quantity_received: item.quantity_received,
      });
      continue;
    }

    const groupKey = [
      item.brand,
      item.model_type ?? "",
      item.model,
      item.category,
      item.cost_price,
      item.selling_price,
      item.storage_ram ?? "",
      item.condition ?? "",
      item.base_sku ?? "",
    ].join("||");

    const existingLine = lines.find(
      (line) =>
        line.mode === "new" &&
        [
          line.brand ?? "",
          line.model_type ?? "",
          line.model ?? "",
          line.category ?? "",
          line.cost_price ?? 0,
          line.selling_price ?? 0,
          line.storage_ram ?? "",
          line.condition ?? "",
          line.base_sku ?? "",
        ].join("||") === groupKey
    );

    const colorVariant = {
      color: item.color,
      quantity_received: item.quantity_received,
      sku: item.sku || undefined,
    };

    if (existingLine && existingLine.mode === "new") {
      existingLine.color_variants = [...(existingLine.color_variants ?? []), colorVariant];
      continue;
    }

    lines.push({
      mode: "new",
      brand: item.brand,
      model_type: item.model_type,
      model: item.model,
      base_sku: item.base_sku,
      category: item.category,
      cost_price: item.cost_price,
      selling_price: item.selling_price,
      storage_ram: item.storage_ram,
      condition: item.condition,
      color_variants: [colorVariant],
    });
  }

  return lines;
}

export function validateCartItems(items: StockCartItem[]): string | null {
  if (items.length === 0) {
    return "Add at least one item to the cart";
  }
  for (const item of items) {
    if (item.quantity_received < 1) {
      return "Each cart item must have quantity at least 1";
    }
    if (item.mode === "new") {
      if (!item.brand.trim() || !item.model.trim() || !item.color.trim()) {
        return "New product cart items need brand, model, and color";
      }
    }
  }
  return null;
}
