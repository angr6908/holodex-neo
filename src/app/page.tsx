import { HomePage } from "@/views/HomePage";
import { cookies } from "next/headers";
import { decodeHomeStateCookie, HOME_STATE_COOKIE } from "@/lib/cookie-codec";

export default async function Page() {
  const cookieStore = await cookies();
  const initialHomeState = decodeHomeStateCookie(
    cookieStore.get(HOME_STATE_COOKIE)?.value,
  );
  return <HomePage initialHomeState={initialHomeState} />;
}
