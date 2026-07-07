import { getYoutubeViewers } from "@/lib/server/live-viewers";

export const runtime = "nodejs";

// Standalone endpoint the client still polls to keep live counts fresh between list
// refreshes. Shares getYoutubeViewers' cache + in-flight de-dupe with the API-proxy
// injector, so a stream is fetched from YouTube at most once per window across both.
const isValidId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{11}$/.test(v);
const miss = { live_viewers: null, isLive: false, found: false };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as any);

  // Batch form (video grids): many ids in one request, fetched in parallel with no
  // concurrency cap so the whole grid resolves in a single wave.
  if (Array.isArray(body?.videoIds)) {
    const ids = ([...new Set<unknown>(body.videoIds)]).filter(isValidId).slice(0, 500);
    const results = await Promise.all(ids.map((id) => getYoutubeViewers(id).catch(() => miss)));
    const entries = ids.map((id, i) => [id, results[i]] as const);
    return Response.json(Object.fromEntries(entries), { headers: { "cache-control": "no-store" } });
  }

  const { videoId } = body;
  if (!isValidId(videoId)) return Response.json(miss, { status: 400 });
  try {
    return Response.json(await getYoutubeViewers(videoId), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(miss, { status: 502 });
  }
}
