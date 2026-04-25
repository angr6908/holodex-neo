import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const musicdexURL = host === "holodex.net" ? "https://music.holodex.net" : "https://music-staging.holodex.net";
  redirect(`${musicdexURL}/channel/${id}`);
}
