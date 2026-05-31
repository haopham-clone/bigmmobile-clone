import { fetchProducts } from "@/lib/data";
import { ProductClient } from "./product-client";

export default async function ProductsPage() {
  const { data, error } = await fetchProducts();

  if (error) {
    return (
      <div className="rounded-md border border-destructive p-4 text-destructive">
        Failed to load products: {error}
      </div>
    );
  }

  return <ProductClient products={data} />;
}
