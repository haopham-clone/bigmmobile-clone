/** Split user search into tokens (supports "Oppo A60" → ["oppo", "a60"]) */
export function tokenizeSearch(raw: string): string[] {
  return raw
    .replace(/[%_,]/g, " ")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Sidebar / type searches like "iPhone 17 PRO MAX" should match model_type only. */
export function isDeviceTypeSearch(raw: string): boolean {
  const normalized = raw.replace(/[%_,]/g, " ").trim().toLowerCase();
  return /^(iphone|ipad|galaxy|pixel|oppo|xiaomi|samsung|moto|nokia)\b/.test(normalized);
}

export function normalizeDeviceTypeSearch(raw: string): string {
  return raw.replace(/[%_,]/g, " ").trim().replace(/\s+/g, " ");
}

export function productMatchesTokenizedSearch(
  brand: string,
  model: string,
  sku: string,
  rawSearch: string,
  modelType = ""
): boolean {
  const term = normalizeDeviceTypeSearch(rawSearch);
  if (!term) return true;

  if (isDeviceTypeSearch(term)) {
    return (modelType ?? "").toLowerCase().includes(term.toLowerCase());
  }

  const tokens = tokenizeSearch(term);
  if (tokens.length === 0) return true;

  const b = brand.toLowerCase();
  const t = modelType.toLowerCase();
  const m = model.toLowerCase();
  const s = sku.toLowerCase();
  const combined = `${b} ${t} ${m}`;

  return tokens.every(
    (token) =>
      b.includes(token) ||
      t.includes(token) ||
      m.includes(token) ||
      s.includes(token) ||
      combined.includes(token)
  );
}
