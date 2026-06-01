import { notFound } from "next/navigation";
import { fetchProductById } from "@/lib/data";
import { ProductDetailClient } from "./product-detail-client";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const { data: product, error } = await fetchProductById(id);

  if (error) {
    return (
      <div className="rounded-md border border-destructive p-4 text-destructive">
        Failed to load product: {error}
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
