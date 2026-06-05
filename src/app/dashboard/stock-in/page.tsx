import Link from "next/link";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import {
  collectDeviceModelTypesFromSidebarTree,
  fetchProductBrands,
  fetchSidebarProductTree,
} from "@/lib/product-queries";
import { StockInClient } from "./stock-in-client";
import { Button } from "@/components/ui/button";

export default async function StockInPage() {
  const [{ data: productTree }, brandsResult] = await Promise.all([
    fetchSidebarProductTree(),
    fetchProductBrands(),
  ]);
  const deviceModelTypeSuggestions =
    collectDeviceModelTypesFromSidebarTree(productTree);
  const deviceModelTypesByCategory = Object.fromEntries(
    PRODUCT_CATEGORIES_SELECT.map((category) => [
      category.slug,
      collectDeviceModelTypesFromSidebarTree(productTree, category.slug),
    ])
  );
  const brandSuggestions = brandsResult.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock In</h1>
          <p className="text-muted-foreground">
            Receive multiple products in one transaction
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/stock-in/history">View history</Link>
        </Button>
      </div>
      <StockInClient
        deviceModelTypeSuggestions={deviceModelTypeSuggestions}
        deviceModelTypesByCategory={deviceModelTypesByCategory}
        brandSuggestions={brandSuggestions}
      />
    </div>
  );
}
