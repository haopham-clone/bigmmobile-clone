function matchFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0].replace(/\s+/g, " ").trim();
  }
  return null;
}

function normalizeIphoneVariantPart(part: string): string {
  let v = part.replace(/\s+/g, " ").trim().toUpperCase();
  if (v === "XSMAX") return "XS MAX";

  // Glued forms from BigM titles: 13PROMAX, 13PRO, 6PPLUS, etc.
  v = v.replace(/^(\d{1,2}[A-Z]?)(PROMAX)$/i, "$1 PRO MAX");
  v = v.replace(/^(\d{1,2})(PROMAX)$/i, "$1 PRO MAX");
  v = v.replace(/^(\d{1,2}[A-Z]?)(PRO\s*MAX)$/i, "$1 PRO MAX");
  v = v.replace(/^(\d{1,2})(PRO\s*MAX)$/i, "$1 PRO MAX");
  v = v.replace(/^(\d{1,2}[A-Z]?)(PRO)$/i, "$1 PRO");
  v = v.replace(/^(\d{1,2})(PRO)$/i, "$1 PRO");
  v = v.replace(/^(\d{1,2}[A-Z]?)(PLUS|MINI|AIR|MAX|E)$/i, "$1 $2");
  v = v.replace(/^(\d{1,2})(PLUS|MINI|AIR|MAX|E)$/i, "$1 $2");

  return v
    .replace(/\bPRO\s*MAX\b/g, "PRO MAX")
    .replace(/\bPRO\b/g, "PRO")
    .replace(/\bPLUS\b/g, "PLUS")
    .replace(/\bMINI\b/g, "MINI")
    .replace(/\bAIR\b/g, "AIR")
    .replace(/\bMAX\b/g, "MAX")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIphoneVariant(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.includes("/")) {
    return normalized
      .split("/")
      .map((part) => normalizeIphoneVariantPart(part.trim()))
      .join("/");
  }
  return normalizeIphoneVariantPart(normalized);
}

/** Canonicalize stored model_type (e.g. iPhone 13PRO MAX → iPhone 13 PRO MAX). */
export function canonicalizeModelType(modelType: string): string {
  const trimmed = modelType.trim();
  if (!trimmed) return "";
  const iphone = trimmed.match(/^iPhone\s+(.+)$/i);
  if (iphone) return `iPhone ${normalizeIphoneVariant(iphone[1])}`;
  return trimmed;
}

/** Same label the sidebar uses: derive from model, else stored model_type. */
export function effectiveProductModelType(
  brand: string,
  model: string,
  category?: string | null,
  storedModelType?: string | null
): string {
  return canonicalizeModelType(
    deriveProductModelType(brand, model, category) || storedModelType || ""
  );
}

/** Sidebar ?type= tab — must match derivation, not only the model_type column. */
export function productMatchesModelTypeFilter(
  filterType: string,
  brand: string,
  model: string,
  storedModelType?: string | null,
  category?: string | null
): boolean {
  const canonical = canonicalizeModelType(filterType);
  if (!canonical) return true;

  const effective = effectiveProductModelType(brand, model, category, storedModelType);
  if (effective === canonical) return true;

  const stored = canonicalizeModelType(storedModelType ?? "");
  if (!stored) return false;

  return new Set(iphoneModelTypeAliases(canonical)).has(stored);
}

function quotePostgrestFilterValue(value: string): string {
  if (/[,.()"\s%]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** PostgREST .or() clause: model_type spellings + model title fallback. */
export function buildModelTypePostgrestOrFilter(modelType: string): string | null {
  const canonical = canonicalizeModelType(modelType);
  if (!canonical) return null;

  const parts = new Set<string>();
  for (const alias of iphoneModelTypeAliases(canonical)) {
    parts.add(`model_type.ilike.${quotePostgrestFilterValue(alias)}`);
  }

  const iphone = canonical.match(/^iPhone\s+(.+)$/i);
  if (iphone) {
    const tokens = iphone[1].split(/\s+/).filter(Boolean);
    parts.add(
      `model.ilike.${quotePostgrestFilterValue(`%iPhone%${tokens.join("%")}%`)}`
    );
  } else {
    parts.add(`model_type.ilike.${quotePostgrestFilterValue(canonical)}`);
    parts.add(`model.ilike.${quotePostgrestFilterValue(`%${canonical}%`)}`);
  }

  return [...parts].join(",");
}

/** DB rows may still use glued labels until migration/seed; match all aliases. */
export function iphoneModelTypeAliases(canonical: string): string[] {
  const normalized = canonicalizeModelType(canonical);
  const iphone = normalized.match(/^iPhone\s+(.+)$/i);
  if (!iphone) return [normalized];

  const variant = iphone[1];
  const aliases = new Set<string>([normalized]);
  aliases.add(`iPhone ${variant.replace(/\s+/g, "")}`);
  aliases.add(`iPhone ${variant.replace(/ PRO MAX/g, "PRO MAX")}`);
  aliases.add(`iPhone ${variant.replace(/ PRO/g, "PRO")}`);
  return [...aliases];
}

/** e.g. 6P/7P/8P or 13/14 — must run before single-digit iPhone patterns. */
const IPHONE_MULTI_MODEL_PATTERN =
  /\biPhone\s*((?:\d{1,2}[A-Z]?)(?:\/\d{1,2}[A-Z]?)+)(?=\s|\/|-|$)/i;

/** Longest suffix first so "17 Pro Max" is not truncated to "17 Pro" or "17". */
function extractIphoneModelType(text: string): string | null {
  const multiModel = text.match(IPHONE_MULTI_MODEL_PATTERN);
  if (multiModel?.[1]) {
    return `iPhone ${normalizeIphoneVariant(multiModel[1])}`;
  }

  const patterns: RegExp[] = [
    /\biPhone\s*(X\/XS)(?=\s|\/|-|$)/i,
    /\biPhone\s*(XS\s*Max)(?=\s|\/|-|$)/i,
    /\biPhone\s*(XS)(?=\s|\/|-|$)/i,
    /\biPhone\s*(XR)(?=\s|\/|-|$)/i,
    /\biPhone\s*(X)(?=\s|\/|-|$)/i,
    /\biPhone\s*(SE)(?=\s|\/|-|$|\d)/i,
    /\biPhone\s*(\d{1,2}\s*Pro\s*Max|\d{1,2}Pro\s*Max|\d{1,2}PRO\s*MAX|\d{1,2}PROMAX)(?=\s|\/|-|$)/i,
    /\biPhone\s*(\d{1,2}\s*Pro|\d{1,2}Pro|\d{1,2}PRO)(?!\s*Max)(?=\s|\/|-|$)/i,
    /\biPhone\s*(\d{1,2}\s*Plus)(?=\s|\/|-|$)/i,
    /\biPhone\s*(\d{1,2}\s*Mini)(?=\s|\/|-|$)/i,
    /\biPhone\s*(\d{1,2}\s*Air)(?=\s|\/|-|$)/i,
    /\biPhone\s*(\d{1,2}\s*Max)(?=\s|\/|-|$)/i,
    /\biPhone\s*(\d{1,2}E)(?=\s|\/|-|$)/i,
    /\biPhone\s*(\d{1,2})(?=\s|\/|-|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return `iPhone ${normalizeIphoneVariant(match[1])}`;
  }
  return null;
}

function iphoneVariantSortBoost(variant: string): number {
  const compact = variant.replace(/\s+/g, "").toUpperCase();
  if (compact.includes("PROMAX")) return 0.9;
  if (compact.includes("PRO")) return 0.7;
  if (compact.includes("PLUS")) return 0.6;
  if (compact.includes("AIR")) return 0.55;
  if (compact.includes("MINI")) return 0.45;
  if (compact.endsWith("MAX") || compact.includes("MAX")) return 0.4;
  if (compact.endsWith("E")) return 0.35;
  return 0;
}

export function getModelTypeSortRank(modelType: string): number {
  const normalized = modelType.trim().toUpperCase().replace(/\s+/g, " ");
  const iphoneMatch = normalized.match(/^IPHONE\s+(.+)$/);

  if (iphoneMatch?.[1]) {
    const variant = iphoneMatch[1].replace(/\s+/g, " ");
    const numeric = variant.match(/^(\d{1,2})/);
    if (numeric) {
      const version = Number(numeric[1]);
      const suffix = variant.slice(numeric[1].length);
      return 10_000 + version + iphoneVariantSortBoost(suffix);
    }

    const compact = variant.replace(/\s+/g, "");
    if (compact === "XSMAX") return 10_010.3;
    if (compact === "XS") return 10_010.2;
    if (compact === "X/XS") return 10_010.15;
    if (compact === "XR") return 10_010.1;
    if (compact === "X") return 10_010;
    if (compact === "SE") return 10_000;
  }

  const pixelMatch = normalized.match(/^PIXEL\s+(\d{1,2})([A-Z])?/);
  if (pixelMatch?.[1]) {
    return 8_000 + Number(pixelMatch[1]) + (pixelMatch[2] ? 0.5 : 0);
  }

  const galaxyMatch = normalized.match(/^GALAXY\s+(?:S|A|M|NOTE)\s*(\d{1,3})/);
  if (galaxyMatch?.[1]) return 7_000 + Number(galaxyMatch[1]);

  return 0;
}

export function deriveProductModelType(
  brand: string,
  model: string,
  category?: string | null
): string {
  const text = model.replace(/\s+/g, " ").trim();
  const normalizedBrand = brand.toLowerCase();

  if (
    category === "phone-cases" &&
    (/^(other|phone|universal)$/i.test(brand) ||
      /^(phone\s*(belt|case|cases)?|crossbody|lanyards?|magsafe\s+(back card holder|rings))\b/i.test(
        text
      ))
  ) {
    return "Other Phone Cases";
  }

  if (normalizedBrand === "apple") {
    const iphoneModelType = extractIphoneModelType(text);
    if (iphoneModelType) return iphoneModelType;

    const ipadModel = matchFirst(text, [
      /\biPad\s*(?:Air|Pro|Mini)?\s*(?:\d{1,2}(?:\.\d)?|[A-Z]\d{1,2})?\b/i,
    ]);
    if (ipadModel) return ipadModel.replace(/^ipad/i, "iPad");
  }

  if (normalizedBrand === "samsung") {
    const samsungModel = matchFirst(text, [
      /\bGalaxy\s+(?:S|A|M|Note)\s*\d{1,3}\b/i,
      /\bGalaxy\s+Z\s+(?:Fold|Flip)\s*\d{1,2}\b/i,
      /\b(?:S|A|M)\s*\d{1,3}\b/i,
      /\bNote\s*\d{1,3}\b/i,
      /\bZ\s+(?:Fold|Flip)\s*\d{1,2}\b/i,
    ]);
    if (samsungModel) {
      return /^galaxy\b/i.test(samsungModel)
        ? samsungModel.replace(/^galaxy/i, "Galaxy")
        : `Galaxy ${samsungModel.toUpperCase().replace(/\s+/g, " ")}`;
    }
  }

  const knownDeviceModel = matchFirst(text, [
    /\bGalaxy\s+(?:S|A|M|Note)\s*\d{1,3}\b/i,
    /\bGalaxy\s+Z\s+(?:Fold|Flip)\s*\d{1,2}\b/i,
    /\bPixel\s*\d{1,2}[a-z]?\b/i,
    /\b(?:OPPO|Oppo)\s*[A-Z]?\d{1,3}[a-z]?\b/i,
    /\b(?:Redmi\s+Note|Redmi|Xiaomi)\s*\d{1,3}[a-z]?\b/i,
    /\bMoto\s+[A-Z]?\d{1,3}[a-z]?\b/i,
    /\bNokia\s*[A-Z]?\d{1,3}[a-z]?\b/i,
  ]);
  if (knownDeviceModel) return knownDeviceModel;

  const beforeAccessoryWords = text
    .split(
      /\b(?:case|cover|protector|screen|glass|cable|charger|magsafe|holder|lanyard|keyboard|otterbox|heavy|leather|clear|black|white)\b/i
    )[0]
    ?.trim();
  const fallback = beforeAccessoryWords || text;

  const multiFromFallback = fallback.match(IPHONE_MULTI_MODEL_PATTERN);
  if (multiFromFallback?.[1]) {
    return `iPhone ${normalizeIphoneVariant(multiFromFallback[1])}`;
  }

  return fallback.split(/\s+/).slice(0, 4).join(" ");
}
