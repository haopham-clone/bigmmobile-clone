"use client";

import { useState } from "react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DB === "true";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsPending(true);
    try {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Inventory</CardTitle>
          <CardDescription>
            Internal mobile device inventory management
          </CardDescription>
          {isMockMode && (
            <Badge variant="secondary" className="mx-auto mt-2">
              Mock mode — no Supabase required
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {isMockMode && (
            <p className="mb-4 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
              Use any email and password (e.g.{" "}
              <code className="text-foreground">demo@local.dev</code> /{" "}
              <code className="text-foreground">demo</code>). Data is stored in
              memory and resets when you restart the dev server.
            </p>
          )}
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="staff@example.com"
                defaultValue={isMockMode ? "demo@local.dev" : undefined}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                defaultValue={isMockMode ? "demo" : undefined}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
