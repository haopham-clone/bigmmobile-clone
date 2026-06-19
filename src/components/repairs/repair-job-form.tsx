"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RepairJob, RepairJobInput } from "@/types/database";
import {
  createRepairJobAction,
  updateRepairJobAction,
} from "@/app/dashboard/repairs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultRepairDate(): string {
  return toDatetimeLocalValue(new Date().toISOString());
}

interface RepairJobFormProps {
  mode: "create" | "edit";
  job?: RepairJob;
  onCancel?: () => void;
  redirectOnSuccess?: string;
}

export function RepairJobForm({
  mode,
  job,
  onCancel,
  redirectOnSuccess,
}: RepairJobFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customerName, setCustomerName] = useState(job?.customer_name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(job?.phone_number ?? "");
  const [deviceModel, setDeviceModel] = useState(job?.device_model ?? "");
  const [issue, setIssue] = useState(job?.issue ?? "");
  const [partsUsed, setPartsUsed] = useState(job?.parts_used ?? "");
  const [price, setPrice] = useState(
    job?.price != null ? String(job.price) : ""
  );
  const [repairDate, setRepairDate] = useState(
    job ? toDatetimeLocalValue(job.repair_date) : defaultRepairDate()
  );

  function buildPayload(): RepairJobInput {
    const trimmedPrice = price.trim();
    return {
      customer_name: customerName,
      phone_number: phoneNumber.trim() || undefined,
      device_model: deviceModel,
      issue,
      parts_used: partsUsed,
      price: trimmedPrice === "" ? null : Number(trimmedPrice),
      repair_date: new Date(repairDate).toISOString(),
    };
  }

  function handleSubmit() {
    startTransition(async () => {
      const payload = buildPayload();
      const result =
        mode === "create"
          ? await createRepairJobAction(payload)
          : await updateRepairJobAction(job!.id, payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Repair recorded" : "Repair updated");
      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
        return;
      }
      if (mode === "create" && "id" in result && result.id) {
        router.push(`/dashboard/repairs/${result.id}`);
        return;
      }
      router.refresh();
      onCancel?.();
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customer_name">Customer name</Label>
          <Input
            id="customer_name"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="e.g. Dianne"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone_number">Phone number</Label>
          <Input
            id="phone_number"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="e.g. 0432451126"
            type="tel"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="device_model">Device model</Label>
          <Input
            id="device_model"
            value={deviceModel}
            onChange={(event) => setDeviceModel(event.target.value)}
            placeholder='e.g. IP13 Pro'
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="repair_date">Repair date & time</Label>
          <Input
            id="repair_date"
            type="datetime-local"
            value={repairDate}
            onChange={(event) => setRepairDate(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="issue">Issue</Label>
        <Textarea
          id="issue"
          value={issue}
          onChange={(event) => setIssue(event.target.value)}
          placeholder="Describe the customer's issue"
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="parts_used">Parts used / repairs</Label>
        <Textarea
          id="parts_used"
          value={partsUsed}
          onChange={(event) => setPartsUsed(event.target.value)}
          placeholder="e.g. New LCD Screen and protector"
          rows={3}
          required
        />
      </div>

      <div className="space-y-2 sm:max-w-xs">
        <Label htmlFor="price">Price (AUD)</Label>
        <Input
          id="price"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving..."
            : mode === "create"
              ? "Save repair"
              : "Save changes"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
