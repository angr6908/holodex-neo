import { getTwitchViewers } from "@/lib/server/live-viewers";

export const runtime = "nodejs";

// Watch-page counterpart of /youtube-live-viewers: concurrent viewers straight from Twitch's
// public GQL, via the shared getTwitchViewers cache + in-flight de-dupe. Response is keyed by
// (lowercased) login, mirroring the YouTube route's shape: { login: { live_viewers, isLive } }.
const clean = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= 60;
const miss = { live_viewers: null, isLive: false };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as any);
  const raw: unknown[] = Array.isArray(body?.logins)
    ? body.logins
    : body?.login != null
      ? [body.login]
      : [];
  const logins = [...new Set(raw.filter(clean).map((l) => l.trim().toLowerCase()))].slice(0, 200);
  if (!logins.length) return Response.json({}, { headers: { "cache-control": "no-store" } });

  const counts = await getTwitchViewers(logins).catch(() => ({}) as Record<string, number>);
  const out = Object.fromEntries(
    logins.map((l) => {
      const n = counts[l];
      return [l, typeof n === "number" && n >= 0 ? { live_viewers: n, isLive: true } : miss];
    }),
  );
  return Response.json(out, { headers: { "cache-control": "no-store" } });
}
