import { cookies, headers } from "next/headers";
import {
  APP_BOOT_COOKIE,
  type AppBootState,
  decodeAppBootCookie,
  decodeHomeStateCookie,
  HOME_STATE_COOKIE,
} from "@/lib/cookie-codec";

// The state the server renders a request with: the boot cookie (a mirror of the user's settings
// kept by the inline boot script and the store), with the viewport guessed from the user agent
// until the browser has reported it.
export async function readBootState() {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const cookieBootState = decodeAppBootCookie(cookieStore.get(APP_BOOT_COOKIE)?.value);
  const requestIsMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(
    requestHeaders.get("user-agent") || "",
  );
  const boot: AppBootState = {
    ...cookieBootState,
    isMobile: cookieBootState?.isMobile ?? requestIsMobile,
    windowWidth: cookieBootState?.windowWidth ?? (requestIsMobile ? 390 : 1440),
  };
  // Client-side navigations and prefetches fetch the page's RSC payload instead of loading the
  // document. Next.js keeps its own `RSC` header from the page, so this goes by the browser's
  // fetch metadata (or, without it, by whether HTML was asked for).
  const fetchDest = requestHeaders.get("sec-fetch-dest");
  const isDocumentRequest = fetchDest
    ? fetchDest === "document" || fetchDest === "iframe"
    : (requestHeaders.get("accept") || "").includes("text/html");
  return {
    boot,
    homeState: decodeHomeStateCookie(cookieStore.get(HOME_STATE_COOKIE)?.value),
    isDocumentRequest,
  };
}
