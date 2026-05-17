"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
export default function LoginPage() {
  const t = useTranslations();
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
    <div className="app-page flex items-center justify-center">
      {processing ? (
        <div className="flex items-center gap-2 text-sm text-[color:var(--color-muted-foreground)]">
          <Spinner className="size-4" />
          <span>{t("views.login.loggingIn")}</span>
        </div>
      ) : null}
    </div>
  );
}
