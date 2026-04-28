import type { NextRequest } from "next/server";

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
  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (!(["GET", "HEAD"].includes(request.method))) init.body = await request.arrayBuffer();
  const upstream = await fetch(target, init);
  const outHeaders = new Headers(upstream.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: outHeaders });
}

export const GET = proxy, POST = proxy, PUT = proxy, PATCH = proxy, DELETE = proxy, HEAD = proxy, OPTIONS = proxy;
