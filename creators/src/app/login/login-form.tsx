"use client";

import { useState } from "react";
import { SIGN_IN_ERROR } from "@/lib/sign-in";

// Same sign-in form in the Organic, Personal, Creators, and Growth apps.
export function LoginForm({ setup, nextPath }: { setup: string | null; nextPath: string }) {
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
        name: form.get("name"),
        password: form.get("password"),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error || SIGN_IN_ERROR);
      return;
    }
    window.location.href = nextPath;
  }

  return (
    <main className="signin">
      <form className="card signin-card" onSubmit={onSubmit}>
        <h1 className="signin-logo">
          <img src="/mailbakes-logo.svg" alt="MailBakes" />
        </h1>
        <label className="field" htmlFor="name">
          Name
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            disabled={Boolean(setup)}
          />
        </label>
        <label className="field" htmlFor="password">
          Password
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={Boolean(setup)}
          />
        </label>
        {setup ? <p className="alert warn">{setup}</p> : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn" type="submit" disabled={pending || Boolean(setup)}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
