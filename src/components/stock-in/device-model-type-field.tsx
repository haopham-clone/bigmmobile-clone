"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SELECT_OTHER_VALUE } from "@/components/stock-in/select-with-other-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SUGGESTION_LIMIT = 20;

interface DeviceModelTypeFieldProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label?: string;
}

export function DeviceModelTypeField({
  value,
  options,
  onChange,
  label = "Model type",
}: DeviceModelTypeFieldProps) {
  const [mode, setMode] = useState<"list" | "other">("list");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, SUGGESTION_LIMIT);
    return options.filter((type) => type.toLowerCase().includes(q)).slice(0, SUGGESTION_LIMIT);
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectType(type: string) {
    onChange(type);
    setMode("list");
    setQuery("");
    setOpen(false);
  }

  if (mode === "other") {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select
          value={SELECT_OTHER_VALUE}
          onValueChange={(next) => {
            if (next !== SELECT_OTHER_VALUE) {
              setMode("list");
              onChange(next);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
            <SelectItem value={SELECT_OTHER_VALUE}>Other (custom)</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. iPhone 17 PRO MAX"
        />
      </div>
    );
  }

  const showDropdown = open && (filtered.length > 0 || query.trim().length > 0);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div ref={containerRef} className="relative">
        <Input
          ref={inputRef}
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
            if (e.key === "Enter" && filtered.length === 1) {
              e.preventDefault();
              selectType(filtered[0]);
            }
          }}
          placeholder="Search iPhone 17 PRO MAX…"
          autoComplete="off"
        />

        {showDropdown && (
          <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
            {filtered.map((type) => (
              <button
                key={type}
                type="button"
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  type === value && "bg-accent text-accent-foreground"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectType(type)}
              >
                {type}
              </button>
            ))}
            {filtered.length === 0 && query.trim() ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No match — keep typing or choose Other below
              </p>
            ) : null}
            <button
              type="button"
              className="flex w-full border-t px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setMode("other");
                onChange(query.trim() || value);
                setOpen(false);
              }}
            >
              Other (custom type)…
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Device family only (e.g. iPhone 17 PRO MAX). Type to filter, or use Other for new types.
      </p>
    </div>
  );
}
