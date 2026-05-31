"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { insertProduct, updateStock } from "@/lib/data";

const productSchema = z.object({
  image_url: z
    .string()
    .optional()
    .refine((v) => !v || v === "" || /^https?:\/\/.+/.test(v), "Invalid image URL"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  storage_ram: z.string().optional(),
  color: z.string().optional(),
  condition: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  cost_price: z.coerce.number().min(0),
  selling_price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(0),
});

export async function addProduct(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const raw = {
    image_url: (formData.get("image_url") as string) || "",
    brand: formData.get("brand") as string,
    model: formData.get("model") as string,
    storage_ram: (formData.get("storage_ram") as string) || "",
    color: (formData.get("color") as string) || "",
    condition: (formData.get("condition") as string) || "",
    sku: formData.get("sku") as string,
    cost_price: formData.get("cost_price"),
    selling_price: formData.get("selling_price"),
    quantity: formData.get("quantity"),
  };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const result = await insertProduct({
    image_url: data.image_url || null,
    brand: data.brand,
    model: data.model,
    storage_ram: data.storage_ram || null,
    color: data.color || null,
    condition: data.condition || null,
    sku: data.sku,
    cost_price: data.cost_price,
    selling_price: data.selling_price,
    quantity: data.quantity,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  return { success: true };
}

export async function adjustStock(productId: string, delta: number) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const result = await updateStock(productId, delta);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  return { success: true, quantity: result.quantity };
}
