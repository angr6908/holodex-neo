"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";

export function LoginPage() {
  const router = useRouter();
  const app = useAppState();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const params = new URL(window.location.href).searchParams;
      const service = params.get("service");
      if (service === "discord" && window.location.hash) {
        setProcessing(true);
        try {
          const hash = window.location.hash.substring(1);
          const discordAuthParams = new URLSearchParams(hash);
          const accessToken = discordAuthParams.get("access_token") || "";
          const resp = await api.login(app.userdata.jwt, accessToken, "discord");
          if (!cancelled && resp?.data) {
            app.setUser(resp.data);
            await app.resetFavorites();
          }
        } catch (e) {
          console.error("Discord login failed:", e);
        }
      }
      if (!cancelled) router.replace("/");
    }
    void run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      {processing ? <div className="text-sm text-[color:var(--color-muted-foreground)]">Logging in...</div> : null}
    </div>
  );
}
