import { redirect } from "next/navigation";
import { Suspense } from "react";
import { readBootState } from "@/lib/server/boot-state";
import { HomeClient } from "./home-client";
import { PreloadHomeLiveThumbnails, startHomeLive } from "./home-live";

export default async function Page() {
  // The boot cookie mirrors the user's settings (kept in sync by the inline boot script and the
  // store), so users who open to multiview are redirected before the home page renders.
  const { boot, homeState, isDocumentRequest } = await readBootState();
  if (boot.settings?.defaultOpen === "multiview") redirect("/multiview");
  // Opening the site starts loading the live list with the page; a client-side navigation
  // back home loads it from the client, as it may already have the list.
  const live = isDocumentRequest ? startHomeLive(boot, homeState) : null;
  return (
    <>
      <HomeClient liveSeeds={live?.seeds} />
      {live?.showsThumbnails ? (
        <Suspense fallback={null}>
          <PreloadHomeLiveThumbnails live={live} boot={boot} />
        </Suspense>
      ) : null}
    </>
  );
}
