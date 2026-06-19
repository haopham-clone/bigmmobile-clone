"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { importRepairJobsAction } from "@/app/dashboard/repairs/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function defaultExportFrom(): string {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function defaultExportTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RepairsImportExport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportFrom, setExportFrom] = useState(defaultExportFrom);
  const [exportTo, setExportTo] = useState(defaultExportTo);
  const [isImporting, startImport] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  function handleImport() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a CSV or Excel file first");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startImport(async () => {
      const result = await importRepairJobsAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const skipped = result.skipped ?? 0;
      const message =
        skipped > 0
          ? `Imported ${result.imported} repair(s), skipped ${skipped} row(s)`
          : `Imported ${result.imported} repair(s)`;
      toast.success(message);

      if (result.errors && result.errors.length > 0) {
        console.warn("Repair import warnings:", result.errors);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      router.refresh();
    });
  }

  async function handleExport() {
    if (!exportFrom || !exportTo) {
      toast.error("Choose a start and end date");
      return;
    }
    if (exportFrom > exportTo) {
      toast.error("Start date must be on or before end date");
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams({ from: exportFrom, to: exportTo });
      const response = await fetch(`/dashboard/repairs/export?${params.toString()}`);
      if (!response.ok) {
        const message = await response.text();
        toast.error(message || "Export failed");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `repairs-${exportFrom}-to-${exportTo}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import & export</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Import spreadsheet</p>
            <p className="text-sm text-muted-foreground">
              Upload .csv, .xlsx, or .xls with columns: Date, Name, Phone Number,
              Models, Issue, Repairs, Price
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="repair_import_file">File</Label>
            <Input
              id="repair_import_file"
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={handleImport}
            disabled={isImporting}
          >
            <Upload className="h-4 w-4" />
            {isImporting ? "Importing..." : "Import"}
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Export to Excel</p>
            <p className="text-sm text-muted-foreground">
              Download repairs between two dates as .xlsx
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="export_from">From</Label>
              <Input
                id="export_from"
                type="date"
                value={exportFrom}
                onChange={(event) => setExportFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export_to">To</Label>
              <Input
                id="export_to"
                type="date"
                value={exportTo}
                onChange={(event) => setExportTo(event.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Exporting..." : "Export .xlsx"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
