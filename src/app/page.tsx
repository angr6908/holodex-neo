import { HomePage } from "@/views/HomePage";
import { cookies } from "next/headers";
import { decodeHomeState, HOME_STATE_COOKIE } from "@/lib/home-state";

export default async function Page() {
  const cookieStore = await cookies();
  const initialHomeState = decodeHomeState(
    cookieStore.get(HOME_STATE_COOKIE)?.value,
  );
  return <HomePage initialHomeState={initialHomeState} />;
}
