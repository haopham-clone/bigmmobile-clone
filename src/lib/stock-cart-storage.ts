import type { StockCartDraft, StockCartPendingAdd } from "@/lib/stock-cart";
import {
  STOCK_CART_PENDING_ADD_KEY,
  STOCK_CART_STORAGE_KEY,
  createEmptyCartDraft,
} from "@/lib/stock-cart";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadCartDraft(fallbackInvoice: string): StockCartDraft | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STOCK_CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StockCartDraft;
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
      localStorage.removeItem(STOCK_CART_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STOCK_CART_STORAGE_KEY);
    return null;
  }
}

export function saveCartDraft(draft: StockCartDraft): void {
  if (!isBrowser()) return;
  localStorage.setItem(STOCK_CART_STORAGE_KEY, JSON.stringify(draft));
}

export function clearCartDraft(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STOCK_CART_STORAGE_KEY);
}

export function loadOrCreateCartDraft(fallbackInvoice: string): StockCartDraft {
  return loadCartDraft(fallbackInvoice) ?? createEmptyCartDraft(fallbackInvoice);
}

export function queuePendingCartAdd(payload: StockCartPendingAdd): void {
  if (!isBrowser()) return;
  localStorage.setItem(STOCK_CART_PENDING_ADD_KEY, JSON.stringify(payload));
}

export function consumePendingCartAdd(): StockCartPendingAdd | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STOCK_CART_PENDING_ADD_KEY);
    if (!raw) return null;
    localStorage.removeItem(STOCK_CART_PENDING_ADD_KEY);
    const parsed = JSON.parse(raw) as StockCartPendingAdd;
    if (!parsed.product_id || parsed.quantity_received < 1) return null;
    return parsed;
  } catch {
    localStorage.removeItem(STOCK_CART_PENDING_ADD_KEY);
    return null;
  }
}
