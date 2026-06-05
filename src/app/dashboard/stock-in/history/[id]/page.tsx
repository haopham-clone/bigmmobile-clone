import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { fetchStockReceiptById } from "@/lib/stock-receipts";
import { getCategoryLabel } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReceiptDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptDetailPage({ params }: ReceiptDetailPageProps) {
  const { id } = await params;
  const { data: receipt, error } = await fetchStockReceiptById(id);

  if (error) {
    return (
      <div className="rounded-md border border-destructive p-4 text-destructive">
        Failed to load receipt: {error}
      </div>
    );
  }

  if (!receipt) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="-ml-2 gap-2" asChild>
          <Link href="/dashboard/stock-in/history">
            <ArrowLeft className="h-4 w-4" />
            Back to history
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Receipt detail</h1>
        <p className="text-muted-foreground">
          {new Date(receipt.created_at).toLocaleString("en-AU")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Received by</p>
            <p className="font-medium">{receipt.received_by_email ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Invoice / reference</p>
            <p className="font-medium">{receipt.invoice_number ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total quantity</p>
            <p className="font-medium">{receipt.total_quantity}</p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-sm text-muted-foreground">Notes</p>
            <p className="font-medium">{receipt.note ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipt.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/products/item/${item.product_id}`}
                    className="font-medium hover:underline"
                  >
                    {item.brand} {item.model}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                <TableCell>{getCategoryLabel(item.category as never)}</TableCell>
                <TableCell className="text-right font-semibold text-green-600">
                  +{item.quantity_received}
                </TableCell>
                <TableCell className="text-right">{item.previous_quantity}</TableCell>
                <TableCell className="text-right">{item.new_quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
