"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import type { Product } from "@/types/database";
import { PRODUCT_CATEGORIES_SELECT } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  getProductForStockIn,
  searchProductsForStockIn,
} from "@/app/dashboard/stock-in/actions";

function formatProductLabel(p: Product): string {
  const cat =
    PRODUCT_CATEGORIES_SELECT.find((c) => c.slug === p.category)?.label ?? p.category;
  return `[${cat}] ${p.brand} — ${p.model} (${p.sku}) · Qty ${p.quantity}`;
}

interface ProductSearchSelectProps {
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
}

export function ProductSearchSelect({
  value,
  onChange,
  placeholder = "Type to search brand, model, SKU...",
}: ProductSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;

    let cancelled = false;
    getProductForStockIn(value).then((p) => {
      if (!cancelled && p) setSelected(p);
    });
    return () => {
      cancelled = true;
    };
  }, [value, selected?.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setResults([]);
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await searchProductsForStockIn(term);
        if (error) {
          setResults([]);
          setErrorMessage(error);
        } else {
          setResults(data);
          setErrorMessage(null);
        }
      } catch {
        setResults([]);
        setErrorMessage("Product search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(product: Product) {
    setSelected(product);
    onChange(product.id);
    setQuery("");
    setResults([]);
    setErrorMessage(null);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleClear() {
    setSelected(null);
    onChange("");
    setQuery("");
    setResults([]);
    setErrorMessage(null);
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
            if (value) {
              onChange("");
              setSelected(null);
            }
          }}
          onFocus={() => {
            setOpen(true);
            if (selected) setQuery("");
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
              Type to search active products (server-side)
            </p>
          ) : loading ? (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </p>
          ) : errorMessage ? (
            <p className="p-3 text-sm text-destructive">{errorMessage}</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No products match &quot;{query}&quot;
            </p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  p.id === value && "bg-accent text-accent-foreground"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(p)}
              >
                {p.id === value ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span>{formatProductLabel(p)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
