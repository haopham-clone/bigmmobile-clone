import { notFound } from "next/navigation";
import { fetchProducts } from "@/lib/data";
import {
  getCategoryLabel,
  isHiddenCategory,
  isPublicCategorySlug,
  PRODUCT_CATEGORIES_SELECT,
} from "@/lib/categories";
import type { CategorySlug } from "@/lib/categories";
import { ProductClient } from "../product-client";

interface CategoryProductsPageProps {
  params: Promise<{ category: string }>;
}

export default async function CategoryProductsPage({
  params,
}: CategoryProductsPageProps) {
  const { category } = await params;

  if (!isPublicCategorySlug(category) || isHiddenCategory(category)) {
    notFound();
  }

  const slug = category as CategorySlug;
  const { data, error } = await fetchProducts(slug);

  if (error) {
    return (
      <div className="rounded-md border border-destructive p-4 text-destructive">
        Failed to load products: {error}
      </div>
    );
  }

  const defaultCategory =
    slug === "all" ? PRODUCT_CATEGORIES_SELECT[0]?.slug ?? "phone-cases" : slug;

  return (
    <ProductClient
      products={data}
      activeCategory={slug}
      categoryLabel={getCategoryLabel(slug)}
      defaultCategory={defaultCategory}
    />
  );
}
