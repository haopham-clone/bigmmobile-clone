"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { parseRepairImportFile } from "@/lib/repair-import-export";
import {
  bulkCreateRepairJobs,
  createRepairJob,
  deleteRepairJob,
  updateRepairJob,
} from "@/lib/repairs";
import type { RepairJobInput } from "@/types/database";

const repairJobSchema = z.object({
  customer_name: z.string().trim().min(1, "Customer name is required"),
  phone_number: z.string().trim().optional(),
  device_model: z.string().trim().min(1, "Device model is required"),
  issue: z.string().trim().min(1, "Issue description is required"),
  parts_used: z.string().trim().min(1, "Parts used is required"),
  price: z
    .union([z.number().min(0, "Price must be 0 or greater"), z.null()])
    .optional(),
  repair_date: z
    .string()
    .min(1, "Repair date is required")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Invalid repair date",
    }),
});

function parseRepairInput(payload: RepairJobInput) {
  const parsed = repairJobSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  return {
    data: {
      ...parsed.data,
      phone_number: parsed.data.phone_number || undefined,
      price: parsed.data.price ?? null,
      repair_date: new Date(parsed.data.repair_date).toISOString(),
    } satisfies RepairJobInput,
  };
}

function revalidateRepairPaths(id?: string) {
  revalidatePath("/dashboard/repairs");
  if (id) revalidatePath(`/dashboard/repairs/${id}`);
}

export async function createRepairJobAction(payload: RepairJobInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = parseRepairInput(payload);
  if (parsed.error || !parsed.data) return { error: parsed.error };

  const result = await createRepairJob(user.id, user.email, parsed.data);
  if (result.error) return { error: result.error };

  revalidateRepairPaths(result.data?.id);
  return { success: true, id: result.data?.id };
}

export async function updateRepairJobAction(id: string, payload: RepairJobInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = parseRepairInput(payload);
  if (parsed.error || !parsed.data) return { error: parsed.error };

  const result = await updateRepairJob(id, parsed.data);
  if (result.error) return { error: result.error };

  revalidateRepairPaths(id);
  return { success: true };
}

export async function deleteRepairJobAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const result = await deleteRepairJob(id);
  if (result.error) return { error: result.error };

  revalidateRepairPaths(id);
  return { success: true };
}

const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export async function importRepairJobsAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Choose a CSV or Excel file to import" };
  }

  const lowerName = file.name.toLowerCase();
  if (
    !lowerName.endsWith(".csv") &&
    !lowerName.endsWith(".xlsx") &&
    !lowerName.endsWith(".xls")
  ) {
    return { error: "Supported formats: .csv, .xlsx, .xls" };
  }

  if (file.size > IMPORT_MAX_BYTES) {
    return { error: "File is too large (max 5 MB)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseRepairImportFile(buffer, file.name);

  if (parsed.rows.length === 0) {
    const detail = parsed.errors[0] ?? "No valid rows found";
    return { error: detail, errors: parsed.errors };
  }

  const validatedInputs: RepairJobInput[] = [];
  const validationErrors = [...parsed.errors];

  for (const row of parsed.rows) {
    const result = parseRepairInput(row.input);
    if (result.error || !result.data) {
      validationErrors.push(`Row ${row.rowNumber}: ${result.error}`);
      continue;
    }
    validatedInputs.push(result.data);
  }

  if (validatedInputs.length === 0) {
    return {
      error: validationErrors[0] ?? "No valid rows to import",
      errors: validationErrors,
    };
  }

  const importResult = await bulkCreateRepairJobs(user.id, user.email, validatedInputs);
  if (importResult.error) {
    return { error: importResult.error, errors: validationErrors };
  }

  revalidateRepairPaths();

  return {
    success: true,
    imported: importResult.imported,
    skipped: parsed.rows.length - validatedInputs.length,
    errors: validationErrors,
  };
}
