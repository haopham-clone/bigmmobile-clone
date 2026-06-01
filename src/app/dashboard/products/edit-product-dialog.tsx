"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import type { Product } from "@/types/database";
import { editProduct } from "./actions";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const categoryValues = PRODUCT_CATEGORIES_SELECT.map((c) => c.slug) as [string, ...string[]];

const formSchema = z.object({
  image_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  storage_ram: z.string().optional(),
  color: z.string().optional(),
  condition: z.string().optional(),
  category: z.enum(categoryValues, { message: "Category is required" }),
  sku: z.string().min(1, "SKU is required"),
  cost_price: z.coerce.number().min(0, "Must be ≥ 0"),
  selling_price: z.coerce.number().min(0, "Must be ≥ 0"),
  quantity: z.coerce.number().int().min(0, "Must be ≥ 0"),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

function productToFormValues(product: Product): FormValues {
  return {
    image_url: product.image_url ?? "",
    brand: product.brand,
    model: product.model,
    storage_ram: product.storage_ram ?? "",
    color: product.color ?? "",
    condition: product.condition ?? "",
    category: product.category as FormValues["category"],
    sku: product.sku,
    cost_price: Number(product.cost_price),
    selling_price: Number(product.selling_price),
    quantity: product.quantity,
    is_active: product.is_active,
  };
}

interface EditProductDialogProps {
  product: Product;
  variant?: "icon" | "default";
}

export function EditProductDialog({ product, variant = "default" }: EditProductDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: productToFormValues(product),
  });

  function onSubmit(values: FormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, val]) => {
      formData.append(key, String(val ?? ""));
    });

    startTransition(async () => {
      const result = await editProduct(product.id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Product updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(productToFormValues(product));
      }}
    >
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label="Edit product"
            onClick={(e) => e.stopPropagation()}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline" onClick={(e) => e.stopPropagation()}>
            <Pencil className="h-4 w-4" />
            Edit product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>Update product details and stock quantity</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCT_CATEGORIES_SELECT.map(({ slug, label }) => (
                        <SelectItem key={slug} value={slug}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="storage_ram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage / RAM</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="cost_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost (AUD)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="selling_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sell (AUD)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active status</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Inactive items stay in inventory but are hidden from dashboard stats
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
