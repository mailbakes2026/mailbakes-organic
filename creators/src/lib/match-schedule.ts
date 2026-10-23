export const MATCH_INTERVAL_MS = 10 * 60 * 1000;

const FLAG = "__mbTiktokMatch";

type MatchGlobal = typeof globalThis & { [FLAG]?: boolean };

async function defaultRun() {
  const { matchTiktokOrders } = await import("./records.ts");
  await matchTiktokOrders();
}

/** Every ten minutes. Does not run at startup. Overlapping runs share the in-process match. */
export function startTiktokMatchSchedule(run: () => Promise<unknown> = defaultRun) {
  const scope = globalThis as MatchGlobal;
  if (scope[FLAG]) return;
  scope[FLAG] = true;
  const timer = setInterval(() => {
    void Promise.resolve()
      .then(run)
      .catch(() => {
        console.error("TikTok order match did not finish.");
      });
  }, MATCH_INTERVAL_MS);
  if (typeof timer === "object" && timer && "unref" in timer && typeof timer.unref === "function") timer.unref();
}
