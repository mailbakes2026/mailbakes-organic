"use client";

import { useState } from "react";

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
    <main className="signin">
      <form className="card signin-card" onSubmit={onSubmit}>
        <img src="/mailbakes-logo.svg" alt="MailBakes" className="brand-logo" />
        <div>
          <h1>Organic social</h1>
          <p className="muted intro">
            Plan posts for the MailBakes channels. Approving something here never publishes it.
          </p>
        </div>
        <label className="field" htmlFor="email">
          Email
          <input id="email" name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field" htmlFor="password">
          Password
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </label>
        {setup ? <p className="alert warn">{setup}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
