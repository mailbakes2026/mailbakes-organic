"use client";

import { usePathname } from "next/navigation";
import { Mark } from "@/components/icons";
import type { AppId } from "@/lib/host";

type Link = { href: string; label: string; badge?: number };

const PAID: Link[] = [
  { href: "", label: "Overview" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/changes", label: "What changed" },
  { href: "/notes", label: "Notes" },
];

const RETENTION: { group: string; links: { href: string; label: string; count?: boolean }[] }[] = [
  {
    group: "Lifecycle",
    links: [
      { href: "/calendar", label: "Calendar", count: true },
      { href: "", label: "Overview" },
      { href: "/flows", label: "Flows" },
      { href: "/campaigns", label: "Campaigns" },
      { href: "/customers", label: "Customers" },
    ],
  },
  { group: "Settings", links: [{ href: "/settings", label: "Settings" }] },
];

export function Shell({
  app,
  base,
  otherHref,
  otherLabel,
  user,
  needsOk = 0,
  klaviyoConnected = false,
  children,
}: {
  app: AppId;
  base: string;
  otherHref: string;
  otherLabel: string;
  user: { name: string };
  needsOk?: number;
  klaviyoConnected?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const home = base || "/";
  const retention = app === "retention";

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function item(link: Link) {
    const href = `${base}${link.href}` || "/";
    const active = link.href === "" ? pathname === home || pathname === `${home}/` : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <a key={link.href || "home"} href={href} className={`nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
        <span>{link.label}</span>
        {link.badge ? <span className="nav-badge">{link.badge}</span> : null}
      </a>
    );
  }

  return (
    <div className={`shell${retention ? " app-retention" : ""}`}>
      <nav className="sidebar">
        <div className="brand">
          <img src="/mailbakes-logo.svg" alt="MailBakes" className="brand-logo" />
          {retention ? (
            <div className="signed-in">Signed in as {user.name}</div>
          ) : (
            <span className="brand-row">
              <span className="mark">
                <Mark kind="megaphone" size={14} />
              </span>
              <i>Paid Ads</i>
            </span>
          )}
        </div>
        {retention ? (
          RETENTION.map((section) => (
            <div key={section.group}>
              <div className="nav-group">{section.group}</div>
              {section.links.map((link) => item({ href: link.href, label: link.label, badge: link.count && needsOk > 0 ? needsOk : undefined }))}
            </div>
          ))
        ) : (
          <>
            <div className="nav-group">Ads</div>
            {PAID.map((link) => item(link))}
          </>
        )}
        <div className="sidebar-footer">
          {retention ? (
            <span className={`live-pill${klaviyoConnected ? "" : " is-off"}`}>
              <i />
              {klaviyoConnected ? "Live" : "Klaviyo off"}
            </span>
          ) : null}
          <a className="subtle small" href={otherHref}>
            {otherLabel}
          </a>
          {retention ? null : <div className="signed-in">Signed in as {user.name}</div>}
          <button className="subtle" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
