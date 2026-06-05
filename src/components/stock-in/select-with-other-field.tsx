"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SELECT_OTHER_VALUE = "__other__";

interface SelectWithOtherFieldProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  otherPlaceholder?: string;
  selectPlaceholder?: string;
}

export function SelectWithOtherField({
  label,
  options,
  value,
  onChange,
  otherPlaceholder = "Enter custom value",
  selectPlaceholder = "Select…",
}: SelectWithOtherFieldProps) {
  const isOther = value.length > 0 && !options.includes(value);
  const selectValue = isOther ? SELECT_OTHER_VALUE : value || undefined;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === SELECT_OTHER_VALUE) {
            onChange(isOther ? value : "");
            return;
          }
          onChange(next);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={selectPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value={SELECT_OTHER_VALUE}>Other</SelectItem>
        </SelectContent>
      </Select>
      {selectValue === SELECT_OTHER_VALUE && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
        />
      )}
    </div>
  );
}
