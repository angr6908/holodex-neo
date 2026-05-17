"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppStateProvider, useAppState } from "@/lib/store";
import { useLocale, useTranslations } from "next-intl";
import { MainNav } from "@/components/nav/MainNav";
import { InstallPrompt } from "@/components/app/InstallPrompt";
import { ReportDialog } from "@/components/app/ReportDialog";
import { ThemeRuntime } from "@/components/app/ThemeRuntime";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AppBootState } from "@/lib/cookie-codec";
import { configureDayjsLocale } from "@/lib/time";
import { openUserMenu, setLocaleCookie } from "@/lib/browser";
import { pullToRefresh } from "@/lib/mobile-pull-to-refresh";
import * as icons from "@/lib/icons";

export function AppProviders({
  children,
  initialBootState,
}: {
  children: React.ReactNode;
  initialBootState?: AppBootState | null;
}) {
  return (
    <AppStateProvider initialBootState={initialBootState}>
      <LocaleRuntime />
      <ThemeRuntime />
      <ViewportRuntime />
      <RouteQueryRuntime />
      <AppChrome />
      {children}
    </AppStateProvider>
  );
}

function LocaleRuntime() {
  const locale = useLocale();
  useEffect(() => {
    configureDayjsLocale(locale);
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

function ViewportRuntime() {
  const app = useAppState();
  useLayoutEffect(() => {
    const update = () => {
      app.setWindowWidth(window.innerWidth);
      app.setIsMobile(window.innerWidth < 960);
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    const onVisibility = () => app.setVisibilityState(document.visibilityState);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  useEffect(() => {
    if (app.visibilityState === "visible")
      app.fetchFavoritesLive({ force: false, minutes: 5 });
  }, [app.visibilityState, app.userdata.jwt]);
  useEffect(() => {
    if (!app.orgs.length) app.fetchOrgs();
  }, [app.orgs.length]);
  useEffect(() => {
    app.loginCheck();
  }, [app.userdata.jwt]);
  useEffect(() => {
    const timer = setInterval(
      () => {
        app.fetchFavoritesLive({ force: false, minutes: 5 });
      },
      6 * 60 * 1000,
    );
    const firstRefresh = setTimeout(() => {
      app.fetchFavoritesLive({ force: false, minutes: 2 });
    }, 5000);
    return () => {
      clearInterval(timer);
      clearTimeout(firstRefresh);
    };
  }, [app.userdata.jwt]);
  return null;
}

function RouteQueryRuntime() {
  const app = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocale = useLocale();
  const langOverrideRef = useRef<string | null>(null);
  const suppressLangPreserveRef = useRef(false);
  useEffect(() => {
    function clearLangOverride() {
      langOverrideRef.current = null;
      suppressLangPreserveRef.current = true;
    }
    window.addEventListener("holodex-clear-lang-override", clearLangOverride);
    return () => window.removeEventListener("holodex-clear-lang-override", clearLangOverride);
  }, []);
  useEffect(() => {
    const langOverride = searchParams.get("lang");
    if (langOverride) {
      langOverrideRef.current = langOverride;
      suppressLangPreserveRef.current = false;
      setLocaleCookie(langOverride);
      if (langOverride !== currentLocale) router.refresh();
      return;
    }
    if (suppressLangPreserveRef.current) return;
    const preservedLang = langOverrideRef.current;
    if (!preservedLang) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", preservedLang);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }, [currentLocale, pathname, router, searchParams]);
  useEffect(() => {
    const preserveLangOnClick = (event: MouseEvent) => {
      const langOverride = langOverrideRef.current || searchParams.get("lang");
      if (!langOverride || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      url.searchParams.set("lang", langOverride);
      anchor.href = `${url.pathname}${url.search}${url.hash}`;
    };
    document.addEventListener("click", preserveLangOnClick, true);
    return () => document.removeEventListener("click", preserveLangOnClick, true);
  }, [searchParams]);
  useEffect(() => {
    const queryOrg = searchParams.get("org");
    if (!queryOrg || app.currentOrg.name === queryOrg) return;
    const applyOrg = (orgs: any[]) => {
      const overrideOrg = orgs.find((o) => o.name === queryOrg);
      if (overrideOrg) app.setCurrentOrg(overrideOrg);
    };
    if (app.orgs.length) applyOrg(app.orgs);
    else app.fetchOrgs().then((orgs) => applyOrg(orgs || []));
  }, [searchParams, app.currentOrg.name, app.orgs.length]);
  return null;
}

function PullToRefresh() {
  const pathname = usePathname();
  const app = useAppState();
  const appRef = useRef(app);
  useEffect(() => { appRef.current = app; }, [app]);
  useEffect(() => {
    const container = document.body;
    if (!container || !("ontouchstart" in window)) return undefined;
    const disabled = ["/watch", "/edit/video", "/multiview", "/tlclient", "/scripteditor"].some((p) => pathname.startsWith(p));
    return pullToRefresh({
      container,
      shouldPullToRefresh: () => !window.scrollY && !disabled && !appRef.current.navDrawer,
      async refresh() {
        const res = await appRef.current.reloadCurrentPage({ source: "ptr", consumed: false });
        if (!res.consumed) location.reload();
        await new Promise((resolve) => setTimeout(resolve, 300));
      },
    });
  }, [pathname]);
  return (
    <div className="pull-to-refresh-material__control pointer-events-none fixed left-1/2 top-0 z-[120] hidden size-10 -translate-x-1/2 items-center justify-center rounded-full bg-background text-primary shadow-md group-[.pull-to-refresh--aborting]/ptr:flex group-[.pull-to-refresh--pulling]/ptr:flex group-[.pull-to-refresh--reached]/ptr:flex group-[.pull-to-refresh--refreshing]/ptr:flex group-[.pull-to-refresh--restoring]/ptr:flex">
      <icons.RefreshCw className="size-6 group-[.pull-to-refresh--refreshing]/ptr:hidden group-[.pull-to-refresh--restoring]/ptr:hidden" aria-hidden="true" />
      <Spinner className="hidden size-6 group-[.pull-to-refresh--refreshing]/ptr:block group-[.pull-to-refresh--restoring]/ptr:block" />
    </div>
  );
}

function AppChrome() {
  const app = useAppState();
  const t = useTranslations();
  const [showTwitter, setShowTwitter] = useState(false);

  useEffect(() => {
    const user = app.userdata?.user;
    if (user?.twitter_id && !user?.discord_id && !user?.google_id)
      setShowTwitter(true);
  }, [app.userdata?.user]);

  return (
    <>
      <MainNav />
      <PullToRefresh />
      {showTwitter ? (
        <Alert className="fixed inset-x-3 top-20 z-50 mx-auto max-w-lg rounded-xl border border-amber-300/20 bg-amber-300/12 p-4 text-amber-50 shadow-sm">
          <AlertDescription className="gap-3 text-amber-50">
            <div className="text-sm font-semibold">
              {t("views.login.twitterMsg.0")}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setShowTwitter(false);
                  openUserMenu();
                }}
              >
                {t("views.login.linkAcc")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTwitter(false)}
              >
                {t("views.app.close_btn")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      <ReportDialog />
      {app.isMobile ? <InstallPrompt /> : null}
    </>
  );
}
