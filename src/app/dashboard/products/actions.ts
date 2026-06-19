"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import { deriveProductModelType } from "@/lib/model-type";
import { uploadProductImageFile } from "@/lib/product-image-upload";
import { insertProduct, setProductActive, updateProduct as updateProductRecord, updateProductImageUrl, updateStock } from "@/lib/data";

const categoryValues = PRODUCT_CATEGORIES_SELECT.map((c) => c.slug) as [string, ...string[]];

const productSchema = z.object({
  image_url: z
    .string()
    .optional()
    .refine((v) => !v || v === "" || /^https?:\/\/.+/.test(v), "Invalid image URL"),
  brand: z.string().min(1, "Brand is required"),
  model_type: z.string().optional(),
  model: z.string().min(1, "Model is required"),
  storage_ram: z.string().optional(),
  color: z.string().optional(),
  condition: z.string().optional(),
  category: z.enum(categoryValues, { message: "Category is required" }),
  sku: z.string().min(1, "SKU is required"),
  cost_price: z.coerce.number().min(0),
  selling_price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(0),
  is_active: z.coerce.boolean().optional(),
});

const editProductSchema = productSchema.extend({
  is_active: z.boolean(),
});

export async function addProduct(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const raw = {
    image_url: (formData.get("image_url") as string) || "",
    brand: formData.get("brand") as string,
    model_type: (formData.get("model_type") as string) || "",
    model: formData.get("model") as string,
    storage_ram: (formData.get("storage_ram") as string) || "",
    color: (formData.get("color") as string) || "",
    condition: (formData.get("condition") as string) || "",
    category: formData.get("category") as string,
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
    model_type: data.model_type || deriveProductModelType(data.brand, data.model, data.category),
    model: data.model,
    storage_ram: data.storage_ram || null,
    color: data.color || null,
    condition: data.condition || null,
    category: data.category,
    sku: data.sku,
    cost_price: data.cost_price,
    selling_price: data.selling_price,
    quantity: data.quantity,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products", "layout");
  return { success: true };
}

export async function adjustStock(productId: string, delta: number) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const result = await updateStock(productId, delta);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products", "layout");
  revalidatePath(`/dashboard/products/item/${productId}`);
  return { success: true, quantity: result.quantity };
}

export async function editProduct(productId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const raw = {
    image_url: (formData.get("image_url") as string) || "",
    brand: formData.get("brand") as string,
    model_type: (formData.get("model_type") as string) || "",
    model: formData.get("model") as string,
    storage_ram: (formData.get("storage_ram") as string) || "",
    color: (formData.get("color") as string) || "",
    condition: (formData.get("condition") as string) || "",
    category: formData.get("category") as string,
    sku: formData.get("sku") as string,
    cost_price: formData.get("cost_price"),
    selling_price: formData.get("selling_price"),
    quantity: formData.get("quantity"),
    is_active: formData.get("is_active") === "true",
  };

  const parsed = editProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const result = await updateProductRecord(productId, {
    image_url: data.image_url || null,
    brand: data.brand,
    model_type: data.model_type || deriveProductModelType(data.brand, data.model, data.category),
    model: data.model,
    storage_ram: data.storage_ram || null,
    color: data.color || null,
    condition: data.condition || null,
    category: data.category,
    sku: data.sku,
    cost_price: data.cost_price,
    selling_price: data.selling_price,
    quantity: data.quantity,
    is_active: data.is_active,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products", "layout");
  revalidatePath(`/dashboard/products/item/${productId}`);
  return { success: true };
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const result = await setProductActive(productId, isActive);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products", "layout");
  revalidatePath(`/dashboard/products/item/${productId}`);
  return { success: true };
}

const imageUrlSchema = z
  .string()
  .nullable()
  .refine(
    (v) =>
      v == null ||
      v === "" ||
      /^https?:\/\/.+/.test(v) ||
      /^data:image\//.test(v),
    "Invalid image URL"
  );

export async function uploadProductImageAction(productId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Choose an image file to upload" };
  }

  const uploaded = await uploadProductImageFile(productId, file);
  if (uploaded.error || !uploaded.url) {
    return { error: uploaded.error ?? "Upload failed" };
  }

  const result = await updateProductImageUrl(productId, uploaded.url);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/products", "layout");
  revalidatePath(`/dashboard/products/item/${productId}`);
  return { success: true, url: uploaded.url };
}

export async function updateProductImageAction(
  productId: string,
  imageUrl: string | null
) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = imageUrlSchema.safeParse(imageUrl);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid image URL" };
  }

  const normalized = parsed.data?.trim() ? parsed.data.trim() : null;
  const result = await updateProductImageUrl(productId, normalized);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/products", "layout");
  revalidatePath(`/dashboard/products/item/${productId}`);
  return { success: true };
}
