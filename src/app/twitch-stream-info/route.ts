import { getTwitchStreamInfo } from "@/lib/server/live-viewers";

export const runtime = "nodejs";

// Watch-page description source for Twitch streams: channel bio + current title/category,
// pulled straight from Twitch's public GQL (via the shared cache). Holodex placeholder
// descriptions for external Twitch streams are auto-generated bot junk, so the watch page
// asks here instead. Shape: { title, category, description } | null.
export async function GET(request: Request) {
  const login = new URL(request.url).searchParams.get("login")?.trim() ?? "";
  if (!login || login.length > 60) return Response.json(null, { headers: { "cache-control": "no-store" } });
  const info = await getTwitchStreamInfo(login).catch(() => null);
  return Response.json(info, { headers: { "cache-control": "public, max-age=60" } });
}
