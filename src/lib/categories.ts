import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Cpu,
  LayoutGrid,
  Monitor,
  Package,
  Plug,
  Shield,
  Tablet,
  Wrench,
  Zap,
} from "lucide-react";

export type CategorySlug =
  | "all"
  | "phone-cases"
  | "tablet-cases"
  | "screen-protectors"
  | "phone-parts"
  | "tablet-parts"
  | "accessories"
  | "tech-hub"
  | "repair-products"
  | "other"
  | "devices";

export interface ProductCategory {
  slug: CategorySlug;
  label: string;
  icon: LucideIcon;
  hidden?: boolean;
}

/** All known categories including hidden internal ones */
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { slug: "all", label: "All Products", icon: LayoutGrid },
  { slug: "phone-cases", label: "Phone Cases", icon: Briefcase },
  { slug: "tablet-cases", label: "Tablet Cases", icon: Tablet },
  { slug: "screen-protectors", label: "Screen Protectors", icon: Shield },
  { slug: "phone-parts", label: "Phone Parts", icon: Cpu },
  { slug: "tablet-parts", label: "Tablet Parts", icon: Monitor },
  { slug: "accessories", label: "Accessories", icon: Plug },
  { slug: "tech-hub", label: "Tech Hub", icon: Zap },
  { slug: "repair-products", label: "Repair Products", icon: Wrench },
  { slug: "other", label: "Other", icon: Package },
  { slug: "devices", label: "Devices", icon: Package, hidden: true },
];

/** Sidebar navigation (excludes hidden categories) */
export const SIDEBAR_CATEGORIES = PRODUCT_CATEGORIES.filter((c) => !c.hidden);

/** Add-product form (no "all", no hidden) */
export const PRODUCT_CATEGORIES_SELECT = PRODUCT_CATEGORIES.filter(
  (c) => c.slug !== "all" && !c.hidden
);

export const HIDDEN_CATEGORY_SLUGS = new Set<CategorySlug>(
  PRODUCT_CATEGORIES.filter((c) => c.hidden).map((c) => c.slug)
);

const VALID_SLUGS = new Set<string>(PRODUCT_CATEGORIES.map((c) => c.slug));

const PUBLIC_SLUGS = new Set<string>(
  PRODUCT_CATEGORIES.filter((c) => !c.hidden).map((c) => c.slug)
);

export function isValidCategorySlug(slug: string): slug is CategorySlug {
  return VALID_SLUGS.has(slug);
}

/** Public routes only — hidden slugs like `devices` return false */
export function isPublicCategorySlug(slug: string): slug is CategorySlug {
  return PUBLIC_SLUGS.has(slug);
}

export function getCategoryLabel(slug: CategorySlug): string {
  return PRODUCT_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export function isHiddenCategory(slug: string): boolean {
  return HIDDEN_CATEGORY_SLUGS.has(slug as CategorySlug);
}

/**
 * Map raw crawler category + product name to BigM-style inventory group.
 */
export function resolveCategorySlug(
  rawCategory: string | null | undefined,
  name: string | null | undefined
): Exclude<CategorySlug, "all"> {
  const c = (rawCategory ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  const combined = `${c} ${n}`;

  // Hidden: finished devices for sale
  if (
    /devices for sale|refurbished phones/.test(c) ||
    (/refurbish/.test(c) && !/case|screen|part|protector|flex|battery/.test(c))
  ) {
    return "devices";
  }

  // Repair products (check before generic part rules)
  if (/repair products?/.test(c) || (/repair/.test(c) && !/case/.test(c))) {
    return "repair-products";
  }

  // Tablet cases before generic phone case rule. BigM sometimes nests iPad cases
  // under a broad "Phone Cases" source category, so inspect the product name too.
  if (
    /tablet cases?|ipad cases?/.test(c) ||
    (/\b(ipad|tablet)\b/.test(combined) && /\b(case|cover|folio|keyboard)\b/.test(combined))
  ) {
    return "tablet-cases";
  }

  // Screen protectors before generic part/case rules
  if (/screen protectors?|camera lens protector|hydrogel film/.test(combined)) {
    return "screen-protectors";
  }

  // Phone cases (any category containing "case" not caught above)
  if (/case/.test(c)) {
    return "phone-cases";
  }

  // Tablet parts
  if (
    (/ipad|tablet/.test(combined) &&
      /part|screen|flex|battery|digitizer|lcd|oled|charging port|housing/.test(combined)) ||
    /ipad air.*parts|ipad.*screen and parts|tablet.*parts/.test(c)
  ) {
    return "tablet-parts";
  }

  // Phone parts
  if (
    /screen.?(&|and)? ?parts|screen & parts|screen and parts|compatible|flex|battery|sim card|loudspeaker|earpiece|camera lens|power flex|digitizer|lcd|oled|display|housing assembly|back glass|charging port/.test(
      combined
    )
  ) {
    return "phone-parts";
  }

  // Tech Hub
  if (
    /myfone techub|tech hub|tools|drones?|gaming|home & lifestyle|dashcams?|cameras|creator gear|smart watches?|trackers|computer|laptop accessories/.test(
      combined
    )
  ) {
    return "tech-hub";
  }

  // Accessories
  if (
    /accessor|cable|speaker|charger|power bank|bluetooth|audio|adapter|holder|stand|car holder|wireless earbuds|memory cards|watch accessories/.test(
      combined
    )
  ) {
    return "accessories";
  }

  return "other";
}
