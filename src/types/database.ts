export type StockAction = "INITIAL_ADD" | "ADJUSTED_UP" | "ADJUSTED_DOWN";

export interface Product {
  id: string;
  image_url: string | null;
  brand: string;
  model: string;
  storage_ram: string | null;
  color: string | null;
  condition: string | null;
  sku: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
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
  model: string;
  storage_ram?: string | null;
  color?: string | null;
  condition?: string | null;
  sku: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
}
