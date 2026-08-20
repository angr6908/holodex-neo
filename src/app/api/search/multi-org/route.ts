import { type NextRequest, NextResponse } from "next/server";

const SEARCH_URL = "https://holodex.net/api/v2/search/videoSearch";
const MAX_ORGANIZATIONS = 32;

type OrgRequest = { org: string; offset: number };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const query = body?.query && typeof body.query === "object" ? body.query : {};
  const limit = Math.min(100, Math.max(1, Number(body?.limit) || 30));
  const requests = Array.isArray(body?.requests)
    ? (body.requests as OrgRequest[])
        .filter((item) => typeof item?.org === "string" && item.org)
        .slice(0, MAX_ORGANIZATIONS)
        .map((item) => ({ org: item.org, offset: Math.max(0, Number(item.offset) || 0) }))
    : [];

  if (!requests.length) return NextResponse.json({ results: [] });

  const results = await Promise.all(
    requests.map(async ({ org, offset }) => {
      try {
        const response = await fetch(SEARCH_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://holodex.net",
            referer: "https://holodex.net/",
          },
          body: JSON.stringify({ ...query, org: [org], paginated: true, offset, limit }),
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`Organization search failed: ${response.status}`);
        return { org, offset, data: await response.json(), failed: false };
      } catch {
        return { org, offset, data: null, failed: true };
      }
    }),
  );

  return NextResponse.json({ results });
}
