import { getSessionUser } from "@/lib/auth";
import {
  buildRepairExportWorkbook,
  endOfDayIso,
  startOfDayIso,
} from "@/lib/repair-import-export";
import { fetchRepairJobs } from "@/lib/repairs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  if (!from || !to) {
    return new Response("from and to date parameters are required (YYYY-MM-DD)", {
      status: 400,
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return new Response("Dates must use YYYY-MM-DD format", { status: 400 });
  }

  if (from > to) {
    return new Response("Start date must be on or before end date", { status: 400 });
  }

  const { data: jobs, error } = await fetchRepairJobs({
    fromDate: startOfDayIso(from),
    toDate: endOfDayIso(to),
  });

  if (error) {
    return new Response(error, { status: 500 });
  }

  const workbook = buildRepairExportWorkbook(jobs);
  const filename = `repairs-${from}-to-${to}.xlsx`;

  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
