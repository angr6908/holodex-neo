import { type NextRequest, NextResponse } from "next/server";
import { VIDEO_SEARCH_MAX_LIMIT, videoSearchBody, videoSearchPage } from "@/lib/video-search";

const SEARCH_URL = "https://holodex.net/api/v3/search/videoSearch";
const MAX_ORGANIZATIONS = 32;

type OrgRequest = { org: string; offset: number };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const query = body?.query && typeof body.query === "object" ? body.query : {};
  const filters = query.q && typeof query.q === "object" ? query.q : {};
  const sort = typeof query.sort === "string" ? query.sort : "latest";
  const limit = Math.min(VIDEO_SEARCH_MAX_LIMIT, Math.max(1, Number(body?.limit) || 30));
  const requests = Array.isArray(body?.requests)
    ? (body.requests as OrgRequest[])
        .filter((item) => typeof item?.org === "string" && item.org)
        .slice(0, MAX_ORGANIZATIONS)
        .map((item) => ({ org: item.org, offset: Math.max(0, Number(item.offset) || 0) }))
    : [];

  if (!requests.length) return NextResponse.json({ results: [] });

  const results = await Promise.all(
    requests.map(async ({ org, offset }) => {
      const search = videoSearchBody({ q: { ...filters, org: [org] }, sort }, offset, limit);
      // Past the results v3 can page to, the org has nothing more to give.
      if (!search) return { org, offset, data: { items: [], total: null }, failed: false };
      try {
        const response = await fetch(SEARCH_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://holodex.net",
            referer: "https://holodex.net/",
          },
          body: JSON.stringify(search),
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`Organization search failed: ${response.status}`);
        return { org, offset, data: videoSearchPage(await response.json()), failed: false };
      } catch {
        return { org, offset, data: null, failed: true };
      }
    }),
  );

  return NextResponse.json({ results });
}
