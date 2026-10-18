"use client";

import { createContext, useContext, useState } from "react";
import type { UserDTO } from "@/lib/types";

export type AppTab = "approval" | "feed" | "calendar";

const TabContext = createContext<{ tab: AppTab; setTab: (tab: AppTab) => void } | null>(null);

export function useAppTab() {
  const value = useContext(TabContext);
  if (!value) throw new Error("useAppTab must be used inside Shell");
  return value;
}

const LINKS: { id: AppTab; label: string }[] = [
  { id: "approval", label: "Posts for approval" },
  { id: "feed", label: "Feed preview" },
  { id: "calendar", label: "Content calendar" },
];

export function Shell({ user, children }: { user: UserDTO; children: React.ReactNode }) {
  const [tab, setTab] = useState<AppTab>("approval");

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const access = user.role === "MANAGEMENT" ? " · full access" : " · team";

  return (
    <TabContext.Provider value={{ tab, setTab }}>
      <div className="shell">
        <nav className="sidebar">
          <div className="brand">
            <img src="/mailbakes-logo.svg" alt="MailBakes" className="brand-logo" />
            <i>Organic social</i>
          </div>
          <div className="nav-group">Plan</div>
          {LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className={`nav-link${tab === link.id ? " active" : ""}`}
              aria-current={tab === link.id ? "page" : undefined}
              onClick={() => setTab(link.id)}
            >
              <span>{link.label}</span>
            </button>
          ))}
          <div className="sidebar-footer">
            <div className="muted small">
              Signed in as {user.name}
              {access}
            </div>
            <button className="subtle" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </nav>
        <main className="main">{children}</main>
      </div>
    </TabContext.Provider>
  );
}
