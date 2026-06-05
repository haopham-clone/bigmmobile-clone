import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { fetchRepairJobById } from "@/lib/repairs";
import { RepairDetailClient } from "./repair-detail-client";
import { Button } from "@/components/ui/button";

interface RepairDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RepairDetailPage({ params }: RepairDetailPageProps) {
  const { id } = await params;
  const { data: job, error } = await fetchRepairJobById(id);

  if (error) {
    return (
      <div className="rounded-md border border-destructive p-4 text-destructive">
        Failed to load repair: {error}
      </div>
    );
  }

  if (!job) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="-ml-2 gap-2" asChild>
          <Link href="/dashboard/repairs">
            <ArrowLeft className="h-4 w-4" />
            Back to repair list
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Repair detail</h1>
        <p className="text-muted-foreground">
          {job.customer_name} — {job.device_model}
        </p>
      </div>

      <RepairDetailClient job={job} />
    </div>
  );
}
