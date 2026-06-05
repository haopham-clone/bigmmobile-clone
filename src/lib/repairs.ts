import type { RepairJob, RepairJobInput } from "@/types/database";
import { isMockMode } from "@/lib/config";
import {
  mockBulkCreateRepairJobs,
  mockCreateRepairJob,
  mockDeleteRepairJob,
  mockGetRepairJob,
  mockListRepairJobs,
  mockUpdateRepairJob,
} from "@/lib/mock-db";
import { createClient } from "@/utils/supabase/server";

export interface FetchRepairJobsOptions {
  q?: string;
  fromDate?: string;
  toDate?: string;
}

function normalizePhoneForSearch(phone: string): string {
  return phone.replace(/\s+/g, "");
}

export async function fetchRepairJobs(
  options: FetchRepairJobsOptions = {}
): Promise<{ data: RepairJob[]; error?: string }> {
  if (isMockMode()) {
    return {
      data: mockListRepairJobs({
        q: options.q,
        fromDate: options.fromDate,
        toDate: options.toDate,
      }),
    };
  }

  const supabase = await createClient();
  let query = supabase.from("repair_jobs").select("*").order("repair_date", { ascending: false });

  if (options.fromDate) {
    query = query.gte("repair_date", options.fromDate);
  }
  if (options.toDate) {
    query = query.lte("repair_date", options.toDate);
  }

  const search = options.q?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    const phonePattern = `%${normalizePhoneForSearch(escaped)}%`;
    query = query.or(
      `customer_name.ilike.${pattern},phone_number.ilike.${pattern},phone_number.ilike.${phonePattern}`
    );
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as RepairJob[] };
}

export async function fetchRepairJobById(
  id: string
): Promise<{ data: RepairJob | null; error?: string }> {
  if (isMockMode()) {
    return { data: mockGetRepairJob(id) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: (data as RepairJob | null) ?? null };
}

export async function createRepairJob(
  userId: string,
  userEmail: string,
  input: RepairJobInput
): Promise<{ data?: RepairJob; error?: string }> {
  if (isMockMode()) {
    return mockCreateRepairJob(userId, userEmail, input);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_jobs")
    .insert({
      user_id: userId,
      recorded_by_email: userEmail || null,
      customer_name: input.customer_name,
      phone_number: input.phone_number || null,
      device_model: input.device_model,
      issue: input.issue,
      parts_used: input.parts_used,
      repair_date: input.repair_date,
    })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create repair job" };
  return { data: data as RepairJob };
}

export async function updateRepairJob(
  id: string,
  input: RepairJobInput
): Promise<{ data?: RepairJob; error?: string }> {
  if (isMockMode()) {
    return mockUpdateRepairJob(id, input);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_jobs")
    .update({
      customer_name: input.customer_name,
      phone_number: input.phone_number || null,
      device_model: input.device_model,
      issue: input.issue,
      parts_used: input.parts_used,
      repair_date: input.repair_date,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to update repair job" };
  return { data: data as RepairJob };
}

export async function deleteRepairJob(id: string): Promise<{ error?: string }> {
  if (isMockMode()) {
    return mockDeleteRepairJob(id);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("repair_jobs").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function bulkCreateRepairJobs(
  userId: string,
  userEmail: string,
  inputs: RepairJobInput[]
): Promise<{ imported: number; error?: string }> {
  if (inputs.length === 0) {
    return { imported: 0, error: "No valid rows to import" };
  }

  if (isMockMode()) {
    return mockBulkCreateRepairJobs(userId, userEmail, inputs);
  }

  const supabase = await createClient();
  const rows = inputs.map((input) => ({
    user_id: userId,
    recorded_by_email: userEmail || null,
    customer_name: input.customer_name,
    phone_number: input.phone_number || null,
    device_model: input.device_model,
    issue: input.issue,
    parts_used: input.parts_used,
    repair_date: input.repair_date,
  }));

  const { error } = await supabase.from("repair_jobs").insert(rows);
  if (error) return { imported: 0, error: error.message };
  return { imported: inputs.length };
}
