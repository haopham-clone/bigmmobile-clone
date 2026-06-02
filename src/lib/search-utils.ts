/** Split user search into tokens (supports "Oppo A60" → ["oppo", "a60"]) */
export function tokenizeSearch(raw: string): string[] {
  return raw
    .replace(/[%_,]/g, " ")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function productMatchesTokenizedSearch(
  brand: string,
  model: string,
  sku: string,
  rawSearch: string,
  modelType = ""
): boolean {
  const tokens = tokenizeSearch(rawSearch);
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
