import { cookies } from "next/headers";
import { decodeHomeStateCookie, HOME_STATE_COOKIE } from "@/lib/cookie-codec";
import { HomeClient } from "./home-client";

export default async function Page() {
  const cookieStore = await cookies();
  const initialHomeState = decodeHomeStateCookie(
    cookieStore.get(HOME_STATE_COOKIE)?.value,
  );
  return <HomeClient initialHomeState={initialHomeState} />;
}
