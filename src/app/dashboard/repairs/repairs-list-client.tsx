"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RepairsListClientProps {
  initialQuery: string;
}

export function RepairsListClient({ initialQuery }: RepairsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  function applySearch(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = nextQuery.trim();
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    const search = params.toString();
    startTransition(() => {
      router.replace(`/dashboard/repairs${search ? `?${search}` : ""}`);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form
        className="flex w-full max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(query);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by customer name or phone…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          Search
        </Button>
      </form>
      <Button asChild>
        <Link href="/dashboard/repairs/new">New repair</Link>
      </Button>
    </div>
  );
}
