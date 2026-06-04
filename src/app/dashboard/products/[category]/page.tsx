import { notFound } from "next/navigation";
import {
  getCategoryLabel,
  isHiddenCategory,
  isPublicCategorySlug,
  PRODUCT_CATEGORIES_SELECT,
} from "@/lib/categories";
import type { CategorySlug } from "@/lib/categories";
import type { ProductSortOption } from "@/types/database";
import { fetchProductBrands, fetchProductsPaginated } from "@/lib/product-queries";
import { ProductClient } from "../product-client";

interface CategoryProductsPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function spString(
  value: string | string[] | undefined,
  fallback = ""
): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function spBool(value: string | string[] | undefined, defaultValue: boolean): boolean {
  const v = spString(value);
  if (!v) return defaultValue;
  return v === "1" || v === "true";
}

export default async function CategoryProductsPage({
  params,
  searchParams,
}: CategoryProductsPageProps) {
  const { category } = await params;
  const sp = await searchParams;

  if (!isPublicCategorySlug(category) || isHiddenCategory(category)) {
    notFound();
  }

  const slug = category as CategorySlug;
  const sort = (spString(sp.sort, "updated_desc") as ProductSortOption) || "updated_desc";

  const filters = {
    categorySlug: slug,
    page: Math.max(1, Number(spString(sp.page, "1")) || 1),
    pageSize: 50,
    search: spString(sp.q),
    modelType: spString(sp.type),
    modelTypePrefix: spString(sp.typePrefix),
    brand: spString(sp.brand, "all"),
    sort,
    lowStockOnly: spBool(sp.lowStock, false),
    hideZeroStock: spBool(sp.hideZero, false),
    hideInactive: spBool(sp.hideInactive, true),
  };

  const [result, brandsResult] = await Promise.all([
    fetchProductsPaginated(filters),
    fetchProductBrands(slug),
  ]);

  if (result.error) {
    return (
      <div className="rounded-md border border-destructive p-4 text-destructive">
        Failed to load products: {result.error}
      </div>
    );
  }

  const defaultCategory =
    slug === "all" ? PRODUCT_CATEGORIES_SELECT[0]?.slug ?? "phone-cases" : slug;

  return (
    <ProductClient
      products={result.data}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      totalPages={result.totalPages}
      brands={brandsResult.data}
      activeCategory={slug}
      categoryLabel={getCategoryLabel(slug)}
      defaultCategory={defaultCategory}
      initialFilters={{
        search: filters.search,
        modelType: filters.modelType,
        modelTypePrefix: filters.modelTypePrefix,
        brand: filters.brand,
        sort: filters.sort,
        lowStockOnly: filters.lowStockOnly,
        hideZeroStock: filters.hideZeroStock,
        hideInactive: filters.hideInactive,
      }}
    />
  );
}
