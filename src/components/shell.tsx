"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { UserDTO } from "@/lib/types";

export type AppTab = "meta-posts" | "meta-stories" | "tiktok" | "calendar";

const TAB_IDS: AppTab[] = ["meta-posts", "meta-stories", "tiktok", "calendar"];

const LEGACY: Record<string, AppTab> = {
  approval: "meta-posts",
  grid: "meta-posts",
  notes: "calendar",
  connections: "meta-posts",
  reports: "meta-posts",
  tiktok: "tiktok",
  calendar: "calendar",
  "meta-posts": "meta-posts",
  "meta-stories": "meta-stories",
};

const TabContext = createContext<{ tab: AppTab; setTab: (tab: AppTab) => void } | null>(null);

export function useAppTab() {
  const value = useContext(TabContext);
  if (!value) throw new Error("useAppTab must be used inside Shell");
  return value;
}

const LINKS: { id: AppTab; label: string }[] = [
  { id: "meta-posts", label: "Meta posts" },
  { id: "meta-stories", label: "Meta stories" },
  { id: "tiktok", label: "TikTok" },
  { id: "calendar", label: "Content calendar" },
];

export function Shell({ user, children }: { user: UserDTO; children: React.ReactNode }) {
  const [tab, setTabState] = useState<AppTab>("meta-posts");

  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    const next = view ? LEGACY[view] : null;
    if (next && TAB_IDS.includes(next)) setTabState(next);
  }, []);

  function setTab(next: AppTab) {
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === "meta-posts") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url.toString());
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const access = user.role === "MANAGEMENT" ? "Approver" : "Manager";

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
            <div className="signed-in">
              Signed in as {user.name}
              <span className="muted"> · {access}</span>
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
