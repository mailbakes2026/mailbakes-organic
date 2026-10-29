"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatLondonStamp } from "@/lib/dates";
import type { NoticeDto } from "@/lib/notify";
import { NOTIFY_LABELS, NOTIFY_SOURCES, type NotifySource } from "@/lib/notify-rules";

type PhoneState = "checking" | "unsupported" | "needs-install" | "blocked" | "off" | "on";

function base64ToBytes(value: string) {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isIphone() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function installed() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  return "Browser";
}

export function NotificationsBoard({
  publicKey,
  notices,
  muted: initialMuted,
  devices,
}: {
  publicKey: string | null;
  notices: NoticeDto[];
  muted: NotifySource[];
  devices: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<PhoneState>("checking");
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState<NotifySource[]>(initialMuted);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIphone() && !installed() ? "needs-install" : "unsupported");
        return;
      }
      if (isIphone() && !installed()) return setState("needs-install");
      if (Notification.permission === "denied") return setState("blocked");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    if (!publicKey) return setError("Notifications need TOKEN_ENCRYPTION_KEY or SESSION_SECRET set on Render.");
    setBusy("on");
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) }));
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), label: deviceLabel() }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "That didn't work. Try again.");
      setState("on");
      setInfo("Notifications are on for this phone. Press Send a test to check.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notifications couldn't be turned on.");
    } finally {
      setBusy(null);
    }
  }

  async function turnOff() {
    setBusy("off");
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
      setInfo("Notifications are off for this phone.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setError(null);
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string; sent?: number };
      if (!response.ok) throw new Error(data.error || "The test didn't send.");
      setInfo(`Test sent to ${data.sent} ${data.sent === 1 ? "device" : "devices"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The test didn't send.");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(source: NotifySource) {
    const next = muted.includes(source) ? muted.filter((item) => item !== source) : [...muted, source];
    setMuted(next);
    const response = await fetch("/api/push/muted", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted: next }),
    });
    if (!response.ok) {
      setMuted(muted);
      setError("That setting didn't save. Try again.");
    }
  }

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted">
            Your phone buzzes when something happens in the other MailBakes apps: Jess finishes the day, someone calls in sick,
            new posts land in Organic, reminders and appointments.
          </p>
        </div>
      </div>

      {info ? <p className="alert ok">{info}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="card nt-phone">
        <h2>This phone</h2>
        {state === "checking" ? <p className="muted">Checking…</p> : null}
        {state === "needs-install" ? (
          <p>
            On iPhone, notifications only work from the home-screen app. In Safari tap <b>Share</b> → <b>Add to Home Screen</b>,
            open MailBakes from your home screen, then come back to this page.
          </p>
        ) : null}
        {state === "unsupported" ? <p className="muted">This browser can&apos;t show notifications. Try the home-screen app on your phone.</p> : null}
        {state === "blocked" ? (
          <p>
            Notifications are blocked for this app. On iPhone: <b>Settings → Notifications → MailBakes</b> → Allow. Then come back
            here.
          </p>
        ) : null}
        {state === "off" ? (
          <button className="btn" type="button" onClick={turnOn} disabled={busy !== null}>
            {busy === "on" ? "Turning on…" : "Turn on notifications"}
          </button>
        ) : null}
        {state === "on" ? (
          <div className="row">
            <span className="nt-on">● On for this phone</span>
            <button className="btn sm" type="button" onClick={test} disabled={busy !== null}>
              {busy === "test" ? "Sending…" : "Send a test"}
            </button>
            <button className="btn ghost sm" type="button" onClick={turnOff} disabled={busy !== null}>
              Turn off
            </button>
          </div>
        ) : null}
        <p className="small muted">
          {devices === 0 ? "No devices turned on yet." : `${devices} ${devices === 1 ? "device" : "devices"} turned on.`}
        </p>
      </section>

      <section className="card">
        <h2>What buzzes</h2>
        <ul className="nt-sources">
          {NOTIFY_SOURCES.map((source) => (
            <li key={source}>
              <label>
                <input type="checkbox" checked={!muted.includes(source)} onChange={() => toggle(source)} />
                <span>{NOTIFY_LABELS[source]}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="small muted">Unticked ones still show in the list below, they just don&apos;t buzz.</p>
      </section>

      <section className="card">
        <h2>Recent</h2>
        {notices.length === 0 ? <p className="muted">Nothing yet.</p> : null}
        <ul className="nt-list">
          {notices.map((notice) => (
            <li key={notice.id}>
              <div className="nt-line">
                <span className={`nt-src nt-${notice.source}`}>{NOTIFY_LABELS[notice.source]?.split(" (")[0] ?? notice.source}</span>
                <span className="small muted">{formatLondonStamp(notice.createdAt)}</span>
              </div>
              <strong>{notice.title}</strong>
              {notice.body ? <p className="muted nt-body">{notice.body}</p> : null}
              {notice.url ? (
                <a className="small" href={notice.url} target={notice.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
                  Open
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
