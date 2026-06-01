import Link from "next/link";
import { fetchActiveProductsForStockIn } from "@/lib/stock-receipts";
import { StockInClient } from "./stock-in-client";
import { Button } from "@/components/ui/button";

export default async function StockInPage() {
  const { data: products, error } = await fetchActiveProductsForStockIn();

  if (error) {
    return (
      <div className="rounded-md border border-destructive p-4 text-destructive">
        Failed to load products: {error}
      </div>
    );
  }

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
      <StockInClient products={products} />
    </div>
  );
}
