import Link from "next/link";
import { fetchStockReceipts } from "@/lib/stock-receipts";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function StockInHistoryPage() {
  const { data: receipts, error } = await fetchStockReceipts();

  if (error) {
    return (
      <div className="rounded-md border border-destructive p-4 text-destructive">
        Failed to load history: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock In History</h1>
          <p className="text-muted-foreground">Past receiving transactions</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/stock-in">New receipt</Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Received by</TableHead>
              <TableHead>Invoice / Ref</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Total qty</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No receipts yet
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell>
                    {new Date(receipt.created_at).toLocaleString("en-AU")}
                  </TableCell>
                  <TableCell>{receipt.received_by_email ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {receipt.invoice_number ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {receipt.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {receipt.total_quantity}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/stock-in/history/${receipt.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
