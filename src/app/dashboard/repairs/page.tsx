import Link from "next/link";
import { Suspense } from "react";
import { fetchRepairJobs } from "@/lib/repairs";
import { RepairsImportExport } from "@/components/repairs/repairs-import-export";
import { RepairsListClient } from "./repairs-list-client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RepairsPageProps {
  searchParams: Promise<{ q?: string }>;
}

function truncate(text: string, max = 48): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export default async function RepairsPage({ searchParams }: RepairsPageProps) {
  const { q } = await searchParams;
  const { data: jobs, error } = await fetchRepairJobs({ q });

  if (error) {
    return (
      <div className="rounded-md border border-destructive p-4 text-destructive">
        Failed to load repair list: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Repair list</h1>
        <p className="text-muted-foreground">
          Track customer repairs, issues, and parts used
        </p>
      </div>

      <Suspense fallback={null}>
        <RepairsListClient initialQuery={q ?? ""} />
      </Suspense>

      <RepairsImportExport />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Parts used</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {q ? "No repairs match your search" : "No repairs yet"}
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    {new Date(job.repair_date).toLocaleString("en-AU")}
                  </TableCell>
                  <TableCell className="font-medium">{job.customer_name}</TableCell>
                  <TableCell>{job.phone_number ?? "—"}</TableCell>
                  <TableCell>{job.device_model}</TableCell>
                  <TableCell className="max-w-xs truncate" title={job.issue}>
                    {truncate(job.issue)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={job.parts_used}>
                    {truncate(job.parts_used)}
                  </TableCell>
                  <TableCell>{job.recorded_by_email ?? "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/repairs/${job.id}`}>View</Link>
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
