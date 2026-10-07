import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { APP_BOOT_COOKIE, decodeAppBootCookie } from "@/lib/cookie-codec";
import { HomeClient } from "./home-client";

export default async function Page() {
  // The boot cookie mirrors the user's settings (kept in sync by the inline boot script and the
  // store), so users who open to multiview are redirected before the home page renders.
  const boot = decodeAppBootCookie((await cookies()).get(APP_BOOT_COOKIE)?.value);
  if (boot?.settings?.defaultOpen === "multiview") redirect("/multiview");
  return <HomeClient />;
}
