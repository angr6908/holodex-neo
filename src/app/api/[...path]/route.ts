import type { NextRequest } from "next/server";
import { injectLiveViewerCounts } from "@/lib/server/live-viewers";
export const runtime = "nodejs";
const API_BASE_URL = "https://holodex.net";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = new URL(`${API_BASE_URL}/api/${(path || []).join("/")}`);
  const incoming = new URL(request.url);
  target.search = incoming.search;
  const headers = new Headers(request.headers);
  headers.set("origin", API_BASE_URL);
  headers.set("referer", `${API_BASE_URL}/`);
  headers.delete("host");
  const isLiveList = request.method === "GET" && path?.[path.length - 1] === "live";
  const init: RequestInit = { method: request.method, headers, redirect: "manual", ...(isLiveList && { cache: "no-store" as const }) };
  if (!(["GET", "HEAD"].includes(request.method))) init.body = await request.arrayBuffer();
  const upstream = await fetch(target, init);
  const outHeaders = new Headers(upstream.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");

  // Live-list responses (`/api/v2/live`, `/api/v2/users/live`): pull concurrent viewers
  // straight from YouTube/Twitch server-side and inject `_ccv` before handing the array to
  // the client, so it sorts by viewers on the first paint with no extra round-trip, no
  // count pop-in, and no reshuffle. Everything else streams through untouched.
  if (isLiveList && upstream.ok && (upstream.headers.get("content-type") || "").includes("application/json")) {
    // CCV is computed for this response, so neither the browser nor an intermediary may
    // reuse an older list and skip the viewer-count injection on the next poll.
    outHeaders.set("cache-control", "no-store, no-cache, must-revalidate");
    outHeaders.set("pragma", "no-cache");
    outHeaders.set("expires", "0");
    const text = await upstream.text();
    try {
      const data = JSON.parse(text);
      const injected = Array.isArray(data) ? await injectLiveViewerCounts(data) : data;
      return Response.json(injected, { status: upstream.status, headers: outHeaders });
    } catch {
      return new Response(text, { status: upstream.status, statusText: upstream.statusText, headers: outHeaders });
    }
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: outHeaders });
}

export const GET = proxy, POST = proxy, PUT = proxy, PATCH = proxy, DELETE = proxy, HEAD = proxy, OPTIONS = proxy;
