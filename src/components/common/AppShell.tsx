"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppStateProvider, useAppState } from "@/lib/store";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { MainNav } from "@/components/nav/MainNav";
import { InstallPrompt } from "@/components/common/InstallPrompt";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { ReportDialog } from "@/components/common/ReportDialog";
import { ThemeRuntime } from "@/components/common/ThemeRuntime";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { AppBootState } from "@/lib/cookie-codec";
import { openUserMenu } from "@/lib/navigation-events";

export function AppProviders({
  children,
  initialBootState,
}: {
  children: React.ReactNode;
  initialBootState?: AppBootState | null;
}) {
  return (
    <AppStateProvider initialBootState={initialBootState}>
      <I18nProvider>
        <ThemeRuntime />
        <ViewportRuntime />
        <RouteQueryRuntime />
        <ShellFrame>{children}</ShellFrame>
      </I18nProvider>
    </AppStateProvider>
  );
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
  }, [app.userdata.jwt, app.visibilityState]);
  return null;
}

function RouteQueryRuntime() {
  const app = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
      return;
    }
    if (suppressLangPreserveRef.current) return;
    const preservedLang = langOverrideRef.current;
    if (!preservedLang) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", preservedLang);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);
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

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const app = useAppState();
  const { t } = useI18n();
  const [showTwitter, setShowTwitter] = useState(false);
  const base = "mx-auto min-h-screen max-w-[1600px] px-3 pb-28 sm:px-5 lg:pb-10";
  const specClass = pathname.startsWith("/watch") ? "min-h-screen w-full overflow-x-hidden px-0 pt-[65px]"
    : pathname.startsWith("/multiview") ? "h-screen w-full overflow-hidden p-0"
    : pathname.startsWith("/search") ? `${base} pt-[76px] sm:pt-[80px]`
    : null;
  const mainClass = specClass ?? base;
  const mainStyle = specClass ? {} : { paddingTop: "var(--nav-total-height, 120px)" } as React.CSSProperties;

  useEffect(() => {
    const user = app.userdata?.user;
    if (user?.twitter_id && !user?.discord_id && !user?.google_id)
      setShowTwitter(true);
  }, [app.userdata?.user]);

  return (
    <div className="relative z-0 min-h-screen" style={{ backgroundColor: "var(--colorbg)", color: "var(--color-foreground)" }} suppressHydrationWarning>
      <MainNav />
      <main className={cn(mainClass)} style={mainStyle}>
        <PullToRefresh />
        {children}
      </main>
      {showTwitter ? (
        <div className="fixed inset-x-3 top-20 z-50 mx-auto max-w-lg">
          <Card className="border border-amber-300/20 bg-amber-300/12 p-4 text-amber-50">
            <div className="text-sm font-semibold">
              {t("views.login.twitterMsg.0")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
          </Card>
        </div>
      ) : null}
      <ReportDialog />
      {app.isMobile ? <InstallPrompt /> : null}
    </div>
  );
}
