"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { Product } from "@/types/database";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function formatProductLabel(p: Product): string {
  const cat =
    PRODUCT_CATEGORIES_SELECT.find((c) => c.slug === p.category)?.label ?? p.category;
  return `[${cat}] ${p.brand} — ${p.model} (${p.sku}) · Qty ${p.quantity}`;
}

function matchesProduct(p: Product, query: string): boolean {
  const q = query.toLowerCase();
  const catLabel =
    PRODUCT_CATEGORIES_SELECT.find((c) => c.slug === p.category)?.label ?? p.category;
  return (
    p.brand.toLowerCase().includes(q) ||
    p.model.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    catLabel.toLowerCase().includes(q)
  );
}

interface ProductSearchSelectProps {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
}

export function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder = "Type to search brand, model, SKU...",
}: ProductSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = products.find((p) => p.id === value);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (q.length < 1) return [];
    return products.filter((p) => matchesProduct(p, q)).slice(0, 100);
  }, [products, query]);

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

  function handleSelect(productId: string) {
    onChange(productId);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleClear() {
    onChange("");
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  const inputValue = open ? query : selected ? formatProductLabel(selected) : query;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          onFocus={() => {
            setOpen(true);
            if (selected) {
              setQuery("");
            }
          }}
          placeholder={placeholder}
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {(value || query) && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {query.trim().length < 1 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Type to search {products.length.toLocaleString("en-AU")} active products
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No products match &quot;{query}&quot;</p>
          ) : (
            <>
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    p.id === value && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(p.id)}
                >
                  {p.id === value ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <span>{formatProductLabel(p)}</span>
                </button>
              ))}
              {filtered.length === 100 && (
                <p className="border-t p-2 text-xs text-muted-foreground">
                  Showing first 100 matches. Refine your search for more.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
