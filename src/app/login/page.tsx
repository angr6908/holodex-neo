"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const app = useAppState();
  const [processing, setProcessing] = useState(false);

  // Discord returns the token in the URL fragment, which only the browser sees, so the login
  // completes here and then leaves for the home page.
  const completeLogin = useEffectEvent(async (isCancelled: () => boolean) => {
    const params = new URL(window.location.href).searchParams;
    const service = params.get("service");
    if (service === "discord" && window.location.hash) {
      setProcessing(true);
      try {
        const hash = window.location.hash.substring(1);
        const discordAuthParams = new URLSearchParams(hash);
        const accessToken = discordAuthParams.get("access_token") || "";
        const resp = await api.login(app.userdata.jwt, accessToken, "discord");
        if (!isCancelled() && resp?.data) {
          app.setUser(resp.data);
          await app.resetFavorites();
        }
      } catch (e) {
        console.error("Discord login failed:", e);
      }
    }
    if (!isCancelled()) router.replace("/");
  });

  useEffect(() => {
    let cancelled = false;
    void completeLogin(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-10 pt-(--nav-total-height,120px) sm:px-5 flex items-center justify-center">
      {processing ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          <span>{t("views.login.loggingIn")}</span>
        </div>
      ) : null}
    </div>
  );
}
