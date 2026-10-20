export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Next awaits register() before it reports Ready. A bootstrap that waits on
  // the previous instance's advisory lock would keep this process from serving.
  // Kick it off and return. Pages retry it; the work itself does not block.
  const { bootstrap } = await import("@/lib/bootstrap");
  void bootstrap().catch((error) => {
    console.error("Bootstrap failed.", error);
  });
  const { startDailySync } = await import("@/lib/connections/schedule");
  startDailySync();
}
