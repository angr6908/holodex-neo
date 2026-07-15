import { NextResponse } from "next/server";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const musicdexURL =
    host === "holodex.net" ? "https://music.holodex.net" : "https://music-staging.holodex.net";

  return NextResponse.redirect(`${musicdexURL}/channel/${id}`);
}

export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) {
  return GET(request, context);
}
