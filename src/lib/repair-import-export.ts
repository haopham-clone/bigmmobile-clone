import * as XLSX from "xlsx";
import type { RepairJob, RepairJobInput } from "@/types/database";

const HEADER_ALIASES: Record<string, keyof RepairJobInput> = {
  date: "repair_date",
  "repair date": "repair_date",
  name: "customer_name",
  "customer name": "customer_name",
  customer: "customer_name",
  phone: "phone_number",
  "phone number": "phone_number",
  mobile: "phone_number",
  model: "device_model",
  models: "device_model",
  "device model": "device_model",
  device: "device_model",
  issue: "issue",
  issues: "issue",
  problem: "issue",
  repairs: "parts_used",
  repair: "parts_used",
  "parts used": "parts_used",
  parts: "parts_used",
};

export interface ParsedRepairImportRow {
  rowNumber: number;
  input: RepairJobInput;
}

export interface RepairImportParseResult {
  rows: ParsedRepairImportRow[];
  errors: string[];
}

export interface RepairExportRow {
  Date: string;
  Name: string;
  "Phone Number": string;
  Models: string;
  Issue: string;
  Repairs: string;
  "Recorded by": string;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[_\s]+/g, " ").trim();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseRepairDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S).toISOString();
    }
  }

  const text = cellText(value);
  if (!text) return null;

  const auMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (auMatch) {
    const [, day, month, year, hour = "0", minute = "0"] = auMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}

function isRowEmpty(values: Record<string, unknown>): boolean {
  return Object.values(values).every((value) => cellText(value) === "");
}

function mapRowToInput(
  row: Record<string, unknown>,
  rowNumber: number
): { input?: RepairJobInput; error?: string } {
  const mapped: Partial<Record<keyof RepairJobInput, string>> = {};
  let repairDate: string | null = null;

  for (const [header, value] of Object.entries(row)) {
    const field = HEADER_ALIASES[normalizeHeader(header)];
    if (!field) continue;
    if (field === "repair_date") {
      repairDate = parseRepairDate(value);
      continue;
    }
    mapped[field] = cellText(value);
  }

  const customerName = mapped.customer_name?.trim();
  const deviceModel = mapped.device_model?.trim();
  const issue = mapped.issue?.trim();
  const partsUsed = mapped.parts_used?.trim();

  if (!customerName && !deviceModel && !issue && !partsUsed) {
    return {};
  }

  if (!customerName) {
    return { error: `Row ${rowNumber}: customer name is required` };
  }
  if (!deviceModel) {
    return { error: `Row ${rowNumber}: device model is required` };
  }
  if (!issue) {
    return { error: `Row ${rowNumber}: issue is required` };
  }
  if (!partsUsed) {
    return { error: `Row ${rowNumber}: parts used / repairs is required` };
  }

  return {
    input: {
      customer_name: customerName,
      phone_number: mapped.phone_number?.trim() || undefined,
      device_model: deviceModel,
      issue,
      parts_used: partsUsed,
      repair_date: repairDate ?? new Date().toISOString(),
    },
  };
}

export function parseRepairImportFile(buffer: Buffer, filename: string): RepairImportParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: ["File has no worksheets"] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    return { rows: [], errors: [`No data rows found in ${filename}`] };
  }

  const rows: ParsedRepairImportRow[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (isRowEmpty(row)) return;

    const result = mapRowToInput(row, rowNumber);
    if (result.error) {
      errors.push(result.error);
      return;
    }
    if (result.input) {
      rows.push({ rowNumber, input: result.input });
    }
  });

  return { rows, errors };
}

export function repairJobsToExportRows(jobs: RepairJob[]): RepairExportRow[] {
  return jobs.map((job) => ({
    Date: new Date(job.repair_date).toLocaleString("en-AU"),
    Name: job.customer_name,
    "Phone Number": job.phone_number ?? "",
    Models: job.device_model,
    Issue: job.issue,
    Repairs: job.parts_used,
    "Recorded by": job.recorded_by_email ?? "",
  }));
}

export function buildRepairExportWorkbook(jobs: RepairJob[]): Buffer {
  const rows = repairJobsToExportRows(jobs);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Repairs");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function startOfDayIso(dateValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

export function endOfDayIso(dateValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}
