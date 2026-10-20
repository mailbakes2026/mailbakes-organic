"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { UserDTO } from "@/lib/types";

export type AppTab = "approval" | "grid" | "tiktok" | "calendar" | "reports";

const TAB_IDS: AppTab[] = ["approval", "grid", "tiktok", "calendar", "reports"];

const TabContext = createContext<{ tab: AppTab; setTab: (tab: AppTab) => void } | null>(null);

export function useAppTab() {
  const value = useContext(TabContext);
  if (!value) throw new Error("useAppTab must be used inside Shell");
  return value;
}

const LINKS: { id: AppTab; label: string }[] = [
  { id: "approval", label: "Posts for approval" },
  { id: "grid", label: "Meta preview" },
  { id: "tiktok", label: "TikTok preview" },
  { id: "calendar", label: "Content calendar" },
  { id: "reports", label: "Reports" },
];

export function Shell({ user, children }: { user: UserDTO; children: React.ReactNode }) {
  const [tab, setTabState] = useState<AppTab>("approval");

  // Each tab has its own address (/?view=grid) so it can be bookmarked or shared.
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view") as AppTab | null;
    if (view && TAB_IDS.includes(view)) setTabState(view);
  }, []);

  function setTab(next: AppTab) {
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === "approval") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url.toString());
  }

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
