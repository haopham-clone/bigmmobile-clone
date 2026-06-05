import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RepairJobForm } from "@/components/repairs/repair-job-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewRepairPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="-ml-2 gap-2" asChild>
          <Link href="/dashboard/repairs">
            <ArrowLeft className="h-4 w-4" />
            Back to repair list
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New repair</h1>
        <p className="text-muted-foreground">Record a customer repair job</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repair details</CardTitle>
        </CardHeader>
        <CardContent>
          <RepairJobForm mode="create" redirectOnSuccess="/dashboard/repairs" />
        </CardContent>
      </Card>
    </div>
  );
}
