export const MATCH_INTERVAL_MS = 10 * 60 * 1000;

const FLAG = "__mbTiktokMatch";

type MatchGlobal = typeof globalThis & { [FLAG]?: boolean };

async function defaultRun() {
  const { matchTiktokOrders } = await import("./records.ts");
  await matchTiktokOrders();
}

function runOnce(run: () => Promise<unknown>) {
  void Promise.resolve(run()).catch(() => {
    console.error("TikTok order match did not finish.");
  });
}

/** Once at startup, then every ten minutes. Overlapping runs share the in-process match. */
export function startTiktokMatchSchedule(run: () => Promise<unknown> = defaultRun) {
  const scope = globalThis as MatchGlobal;
  if (scope[FLAG]) return;
  scope[FLAG] = true;
  runOnce(run);
  const timer = setInterval(() => runOnce(run), MATCH_INTERVAL_MS);
  if (typeof timer === "object" && timer && "unref" in timer && typeof timer.unref === "function") timer.unref();
}
