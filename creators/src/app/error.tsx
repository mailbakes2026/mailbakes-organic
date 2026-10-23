"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="signin">
      <div className="card signin-card">
        <img src="/mailbakes-logo.svg" alt="MailBakes" className="brand-logo" />
        <h1>Something went wrong</h1>
        <p className="muted">Try again. If it keeps happening, the database may be unreachable.</p>
        <button className="btn" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
