"use client";

import { usePathname } from "next/navigation";
import type { GoogleStatus } from "@/lib/google-status";
import { SetupBanner } from "@/components/setup-banner";

// Reminders, Run-through and Briefings still work by address, but live in the Diary now.
const LINKS = [
  { href: "/diary", label: "Diary" },
  { href: "/calendar", label: "Calendar" },
  { href: "/inbox", label: "Inbox" },
  { href: "/payslips", label: "Payslips" },
];

export function Shell({
  user,
  google,
  children,
}: {
  user: { name: string };
  google: GoogleStatus;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const googleOn = google.connected && !google.lastError;

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <img src="/mailbakes-logo.svg" alt="MailBakes" className="brand-logo" />
          <i>Personal</i>
        </div>
        <div className="nav-group">With your PA</div>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              className={`nav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span>{link.label}</span>
            </a>
          );
        })}
        <div className="sidebar-footer">
          <span className={googleOn ? "live-pill" : "live-pill offline"}>
            <span className="dot" />
            <span>{googleOn ? "Google on" : "Setup needed"}</span>
          </span>
          <div className="signed-in">Signed in as {user.name}</div>
          <button className="subtle" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="main">
        <SetupBanner google={google} />
        {children}
      </main>
    </div>
  );
}
