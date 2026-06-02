function matchFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0].replace(/\s+/g, " ").trim();
  }
  return null;
}

function normalizeIphoneVariant(value: string): string {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (compact === "XSMAX") return "XS MAX";
  return value.replace(/\s+/g, " ").toUpperCase();
}

export function getModelTypeSortRank(modelType: string): number {
  const normalized = modelType.trim().toUpperCase().replace(/\s+/g, " ");
  const iphoneMatch = normalized.match(/^IPHONE\s+(.+)$/);

  if (iphoneMatch?.[1]) {
    const variant = iphoneMatch[1].replace(/\s+/g, "");
    const numeric = variant.match(/^(\d{1,2})/);
    if (numeric) {
      const version = Number(numeric[1]);
      const suffixBoost =
        variant.includes("E") || variant.includes("PRO") || variant.includes("MAX") ? 0.5 : 0;
      return 10_000 + version + suffixBoost;
    }

    if (variant === "XSMAX") return 10_010.3;
    if (variant === "XS") return 10_010.2;
    if (variant === "X/XS") return 10_010.15;
    if (variant === "XR") return 10_010.1;
    if (variant === "X") return 10_010;
    if (variant === "SE") return 10_000;
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
    const iphoneMatch = text.match(
      /\biPhone\s*(X\/XS|XS\s*Max|XS|XR|X|SE|\d{1,2}E?)(?=\s|\/|-|$|[A-Z])/i
    );
    if (iphoneMatch?.[1]) {
      return `iPhone ${normalizeIphoneVariant(iphoneMatch[1])}`;
    }

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

  return fallback.split(/\s+/).slice(0, 4).join(" ");
}
