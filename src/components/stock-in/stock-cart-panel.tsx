"use client";

import { Trash2 } from "lucide-react";
import type { StockCartItem } from "@/lib/stock-cart";
import { cartTotalQuantity } from "@/lib/stock-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StockCartPanelProps {
  items: StockCartItem[];
  onQuantityChange: (cartId: string, quantity: number) => void;
  onRemove: (cartId: string) => void;
  onClear: () => void;
}

export function StockCartPanel({
  items,
  onQuantityChange,
  onRemove,
  onClear,
}: StockCartPanelProps) {
  const totalQty = cartTotalQuantity(items);

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Receiving cart</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"} · {totalQty} units · saved locally
          </p>
        </div>
        {items.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            Clear cart
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Search products or add from line builders below. Items stay here until you submit the receipt.
        </p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="w-28 text-right">Qty</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.cartId}>
                  <TableCell className="capitalize">{item.mode}</TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {item.brand} {item.model}
                    </div>
                  </TableCell>
                  <TableCell>{item.color}</TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      className="ml-auto h-8 w-20 text-right"
                      value={item.quantity_received}
                      onChange={(event) =>
                        onQuantityChange(item.cartId, Number(event.target.value) || 0)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onRemove(item.cartId)}
                      aria-label="Remove from cart"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
