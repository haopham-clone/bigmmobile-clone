const INVOICE_RANDOM_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** MM-DD-YYYY-XXXXXX (6 uppercase alphanumeric chars). */
export const STOCK_RECEIPT_INVOICE_PATTERN = /^\d{2}-\d{2}-\d{4}-[A-Z0-9]{6}$/;

function randomInvoiceSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => INVOICE_RANDOM_CHARS[byte % INVOICE_RANDOM_CHARS.length]
  ).join("");
}

export function generateStockReceiptInvoiceNumber(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${mm}-${dd}-${yyyy}-${randomInvoiceSuffix(6)}`;
}

export function isValidStockReceiptInvoiceNumber(value: string): boolean {
  return STOCK_RECEIPT_INVOICE_PATTERN.test(value.trim());
}

export function normalizeStockReceiptInvoiceNumber(value: string): string {
  const trimmed = value.trim().toUpperCase();
  return isValidStockReceiptInvoiceNumber(trimmed) ? trimmed : "";
}
