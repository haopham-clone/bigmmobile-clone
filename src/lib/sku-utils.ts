export function slugifySkuPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildVariantSku(options: {
  baseSku?: string;
  brand: string;
  model: string;
  color: string;
  index: number;
}): string {
  const colorPart = slugifySkuPart(options.color) || `color-${options.index + 1}`;
  const base = slugifySkuPart(options.baseSku ?? "");
  if (base) return `${base}-${colorPart}`;

  const brandPart = slugifySkuPart(options.brand);
  const modelPart = slugifySkuPart(options.model);
  const fallback = [brandPart, modelPart].filter(Boolean).join("-") || "item";
  return `${fallback}-${colorPart}`;
}

export function resolveVariantSku(options: {
  manualSku?: string;
  baseSku?: string;
  brand: string;
  model: string;
  color: string;
  index: number;
}): string {
  const manual = options.manualSku?.trim();
  if (manual) return manual;
  return buildVariantSku(options);
}
