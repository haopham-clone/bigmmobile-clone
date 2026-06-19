"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { RepairJob } from "@/types/database";
import { deleteRepairJobAction } from "@/app/dashboard/repairs/actions";
import { RepairJobForm } from "@/components/repairs/repair-job-form";
import { formatAUD } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RepairDetailClientProps {
  job: RepairJob;
}

export function RepairDetailClient({ job }: RepairDetailClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRepairJobAction(job.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Repair deleted");
      router.push("/dashboard/repairs");
    });
  }

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit repair</CardTitle>
        </CardHeader>
        <CardContent>
          <RepairJobForm
            mode="edit"
            job={job}
            onCancel={() => setIsEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsEditing(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-medium">{job.customer_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Phone</p>
            <p className="font-medium">{job.phone_number ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Device model</p>
            <p className="font-medium">{job.device_model}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Repair date</p>
            <p className="font-medium">
              {new Date(job.repair_date).toLocaleString("en-AU")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="font-medium">
              {job.price != null ? formatAUD(Number(job.price)) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Recorded by</p>
            <p className="font-medium">{job.recorded_by_email ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Last updated</p>
            <p className="font-medium">
              {new Date(job.updated_at).toLocaleString("en-AU")}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Issue</p>
            <p className="whitespace-pre-wrap font-medium">{job.issue}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Parts used / repairs</p>
            <p className="whitespace-pre-wrap font-medium">{job.parts_used}</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete repair record?</DialogTitle>
            <DialogDescription>
              This will permanently remove the repair for {job.customer_name} (
              {job.device_model}). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
