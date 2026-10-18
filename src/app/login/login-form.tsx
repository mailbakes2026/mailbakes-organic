"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ setup }: { setup: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Those details don't match. Try again.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center rounded-xl bg-white px-6 py-4">
          <img src="/mailbakes-logo.svg" alt="MailBakes" className="h-8 w-auto" />
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold">Organic social</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan posts for the MailBakes channels. Approving something here never publishes it.
          </p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="username" required className="h-11 bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-11 bg-white"
              />
            </div>
            {setup ? <p className="rounded-lg bg-[#fff4e8] px-3 py-2 text-sm text-[#7a4b12]">{setup}</p> : null}
            {error ? <p className="rounded-lg bg-[#fdecee] px-3 py-2 text-sm text-[#9f2d3a]">{error}</p> : null}
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
