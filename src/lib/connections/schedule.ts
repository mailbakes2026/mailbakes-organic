const globalForSync = globalThis as { __mbDailySync?: boolean };

export function startDailySync() {
  if (globalForSync.__mbDailySync) return;
  globalForSync.__mbDailySync = true;
  const tick = () => {
    void import("@/lib/connections/service")
      .then((mod) => mod.syncConnections(false))
      .catch((error) => {
        console.error("Daily connection sync failed.", error);
      });
  };
  setTimeout(tick, 20_000);
  setInterval(tick, 60 * 60 * 1000);
}
