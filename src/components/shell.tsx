"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { UserDTO } from "@/lib/types";

export function Shell({ user, children }: { user: UserDTO; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const nav = (
    <>
      <div className="rounded-lg bg-[#fff8f3] px-3 py-2">
        <img src="/mailbakes-logo.svg" alt="MailBakes" className="h-6 w-auto" />
      </div>
      <p className="mt-3 text-xs tracking-wide text-white/70 uppercase">Organic social</p>
      <div className="mt-6 rounded-lg bg-[#2c5a48] px-3 py-2 text-sm font-semibold">Social media</div>
      <div className="mt-auto pt-8">
        <p className="text-sm font-semibold">{user.name}</p>
        <p className="text-xs text-white/70">{user.role === "MANAGEMENT" ? "Management" : "Team"}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-4 text-sm text-white/80 underline-offset-2 hover:underline"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#1b3d32] p-4 text-white lg:flex">
        {nav}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#17261f]/50"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[#1b3d32] p-4 text-white">
            {nav}
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-60">
        <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 lg:hidden">
          <Button type="button" variant="outline" className="h-10 bg-white" onClick={() => setOpen(true)}>
            Menu
          </Button>
          <img src="/mailbakes-logo.svg" alt="MailBakes" className="h-5 w-auto" />
        </div>
        <div className="px-4 py-5 sm:px-8 sm:py-7">{children}</div>
      </div>
    </div>
  );
}
