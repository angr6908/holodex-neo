import { injectLiveViewerCounts } from "@/lib/server/live-viewers";

const API_BASE_URL = "https://holodex.net";
// The page's HTML stays open until the list arrives, so a stuck request must not hold it.
const TIMEOUT_MS = 8000;

const inflight = new Map<string, Promise<any[]>>();

async function fetchLiveList(path: string): Promise<any[]> {
  const upstream = await fetch(`${API_BASE_URL}/api/v2${path}`, {
    headers: { origin: API_BASE_URL, referer: `${API_BASE_URL}/`, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!upstream.ok) throw new Error(`live list ${upstream.status}`);
  const data = await upstream.json();
  if (!Array.isArray(data)) throw new Error("live list: unexpected response");
  return injectLiveViewerCounts(data);
}

// A public live list (`path` from liveListPath) as the API proxy serves it: viewer counts
// injected and ended streams dropped. Concurrent page loads share one request.
export function loadLiveList(path: string): Promise<any[]> {
  const pending = inflight.get(path);
  if (pending) return pending;
  const p = fetchLiveList(path).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}
