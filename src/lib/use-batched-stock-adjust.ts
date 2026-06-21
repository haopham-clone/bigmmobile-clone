"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Product } from "@/types/database";
import { adjustStock } from "@/app/dashboard/products/actions";

const FLUSH_DELAY_MS = 400;

interface PendingBatch {
  delta: number;
  baselineQty: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export function useBatchedStockAdjust(
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
  onSynced?: () => void
) {
  const pendingRef = useRef<Map<string, PendingBatch>>(new Map());
  const flushingRef = useRef<Set<string>>(new Set());

  const flush = useCallback(
    async (productId: string) => {
      const entry = pendingRef.current.get(productId);
      if (!entry || entry.delta === 0 || flushingRef.current.has(productId)) return;

      const { delta, baselineQty } = entry;
      pendingRef.current.delete(productId);
      flushingRef.current.add(productId);

      const result = await adjustStock(productId, delta);
      flushingRef.current.delete(productId);

      if (result.error) {
        pendingRef.current.delete(productId);
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, quantity: baselineQty } : p))
        );
        toast.error(result.error);
        return;
      }

      const nextPending = pendingRef.current.get(productId);
      if (nextPending && nextPending.delta !== 0) {
        void flush(productId);
        return;
      }

      if (result.quantity !== undefined) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, quantity: result.quantity! } : p))
        );
      }
      onSynced?.();
    },
    [setProducts, onSynced]
  );

  const scheduleFlush = useCallback(
    (productId: string) => {
      const entry = pendingRef.current.get(productId);
      if (!entry) return;

      if (entry.delta === 0) {
        if (entry.timer) clearTimeout(entry.timer);
        pendingRef.current.delete(productId);
        return;
      }

      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        entry.timer = null;
        void flush(productId);
      }, FLUSH_DELAY_MS);
    },
    [flush]
  );

  const adjust = useCallback(
    (product: Product, delta: number) => {
      const prevQty = product.quantity;
      const optimisticQty = Math.max(0, prevQty + delta);
      if (optimisticQty === prevQty) return;

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, quantity: optimisticQty } : p))
      );

      let entry = pendingRef.current.get(product.id);
      if (!entry) {
        entry = { delta: 0, baselineQty: prevQty, timer: null };
        pendingRef.current.set(product.id, entry);
      }
      entry.delta += delta;
      scheduleFlush(product.id);
    },
    [setProducts, scheduleFlush]
  );

  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const entry of pending.values()) {
        if (entry.timer) clearTimeout(entry.timer);
      }
    };
  }, []);

  return { adjust };
}
