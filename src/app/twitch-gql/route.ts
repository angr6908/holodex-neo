export const runtime = "nodejs";
export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-Id": request.headers.get("client-id") || "kimne78kx3ncx6brgo4mv6wki5h1ko",
      "Content-Type": "application/json",
      Origin: "https://www.twitch.tv",
      Referer: "https://www.twitch.tv/",
    },
    body,
  });
  return new Response(upstream.body, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}
