"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Pipeline" },
  { href: "/inquiries", label: "Inquiries" },
  { href: "/performance", label: "Performance" },
];

export function Shell({
  user,
  inquiryCount,
  children,
}: {
  user: { name: string };
  inquiryCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <img src="/mailbakes-logo.svg" alt="MailBakes" className="brand-logo" />
          <i>Creators</i>
        </div>
        <div className="nav-group">Sample cards</div>
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              className={`nav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span>{link.label}</span>
              {link.href === "/inquiries" && inquiryCount > 0 ? <span className="pill">{inquiryCount}</span> : null}
            </a>
          );
        })}
        <div className="sidebar-footer">
          <div className="signed-in">Signed in as {user.name}</div>
          <button className="subtle" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
