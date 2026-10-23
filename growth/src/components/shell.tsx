"use client";

import { usePathname } from "next/navigation";
import { Mark } from "@/components/icons";
import type { AppId } from "@/lib/host";

const NAV: Record<AppId, { href: string; label: string }[]> = {
  paidads: [
    { href: "", label: "Overview" },
    { href: "/campaigns", label: "Campaigns" },
    { href: "/changes", label: "What changed" },
    { href: "/notes", label: "Notes" },
  ],
  retention: [
    { href: "", label: "Overview" },
    { href: "/flows", label: "Flows" },
    { href: "/campaigns", label: "Campaigns" },
    { href: "/customers", label: "Customers" },
    { href: "/plan", label: "Q4 plan" },
  ],
};

export function Shell({
  app,
  base,
  otherHref,
  otherLabel,
  user,
  children,
}: {
  app: AppId;
  base: string;
  otherHref: string;
  otherLabel: string;
  user: { name: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const home = base || "/";

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <img src="/mailbakes-logo.svg" alt="MailBakes" className="brand-logo" />
          <span className="brand-row">
            <span className="mark">
              <Mark kind={app === "paidads" ? "megaphone" : "repeat"} size={14} />
            </span>
            <i>{app === "paidads" ? "Paid Ads" : "Retention"}</i>
          </span>
        </div>
        <div className="nav-group">{app === "paidads" ? "Ads" : "Lifecycle"}</div>
        {NAV[app].map((link) => {
          const href = `${base}${link.href}` || "/";
          const active = link.href === "" ? pathname === home || pathname === `${home}/` : pathname === href;
          return (
            <a key={link.href} href={href} className={`nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              <span>{link.label}</span>
            </a>
          );
        })}
        <div className="sidebar-footer">
          <a className="subtle small" href={otherHref}>
            {otherLabel}
          </a>
          <div className="muted small">Signed in as {user.name}</div>
          <button className="subtle" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
