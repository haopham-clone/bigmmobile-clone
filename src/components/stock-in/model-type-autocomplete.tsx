"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { searchStockInModelSuggestions } from "@/app/dashboard/stock-in/actions";
import type { StockInModelSuggestion } from "@/lib/product-queries";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface StockInModelSelection {
  label: string;
  modelType: string;
  productModel?: string;
}

interface ModelTypeAutocompleteProps {
  value: string;
  typeSuggestions: string[];
  onChange: (value: string) => void;
  onSelect?: (selection: StockInModelSelection) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ModelTypeAutocomplete({
  value,
  typeSuggestions,
  onChange,
  onSelect,
  placeholder = "iPhone 17 PRO MAX",
  disabled = false,
}: ModelTypeAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockInModelSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await searchStockInModelSuggestions(query, typeSuggestions);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [open, query, typeSuggestions]);

  function handleSelect(suggestion: StockInModelSuggestion) {
    onChange(suggestion.label);
    onSelect?.({
      label: suggestion.label,
      modelType: suggestion.modelType,
      productModel: suggestion.productModel,
    });
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleClear() {
    onChange("");
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  const showDropdown = open && (loading || results.length > 0);
  const inputValue = open ? query : value;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          disabled={disabled}
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
            if (e.key === "Enter" && results.length === 1) {
              e.preventDefault();
              handleSelect(results[0]);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="pr-9"
        />
        {value && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
            aria-label="Clear model"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 max-h-80 w-full min-w-[min(100%,28rem)] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {loading ? (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </p>
          ) : (
            results.map((suggestion) => {
              const isSelected = suggestion.label === value;
              return (
                <button
                  key={`${suggestion.kind}:${suggestion.label}`}
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(suggestion)}
                >
                  {isSelected ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-normal break-words font-medium">
                      {suggestion.label}
                    </span>
                    {suggestion.kind === "product" && suggestion.modelType ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {suggestion.modelType}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
