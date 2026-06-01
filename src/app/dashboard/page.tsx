import { fetchDashboardStats } from "@/lib/data";
import { formatAUD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, DollarSign, AlertTriangle, Hash } from "lucide-react";
import type { Product } from "@/types/database";

export default async function DashboardPage() {
  const { products, lowStockItems } = await fetchDashboardStats();

  const rows = products as Pick<Product, "quantity" | "cost_price">[];
  const totalUnits = rows.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
  const inventoryValue = rows.reduce(
    (sum, p) => sum + (p.quantity ?? 0) * Number(p.cost_price ?? 0),
    0
  );
  const totalSkus = rows.length;
  const lowStockCount = lowStockItems.length;

  const kpis = [
    {
      title: "Total units",
      value: totalUnits.toLocaleString("en-AU"),
      description: "Units in stock",
      icon: Package,
    },
    {
      title: "Inventory value",
      value: formatAUD(inventoryValue),
      description: "Cost price × quantity",
      icon: DollarSign,
    },
    {
      title: "Low stock alert",
      value: lowStockCount.toString(),
      description: "Products with 1–2 units",
      icon: AlertTriangle,
      highlight: lowStockCount > 0,
    },
    {
      title: "Total SKUs",
      value: totalSkus.toLocaleString("en-AU"),
      description: "Product line count",
      icon: Hash,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Current inventory overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ title, value, description, icon: Icon, highlight }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{value}</div>
                {highlight && <Badge variant="destructive">!</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {lowStockCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Low stock products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {lowStockItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    {item.brand} {item.model}{" "}
                    <span className="text-muted-foreground">({item.sku})</span>
                  </span>
                  <Badge variant="destructive">{item.quantity} left</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
