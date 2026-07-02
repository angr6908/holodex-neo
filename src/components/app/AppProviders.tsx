"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppStateProvider, useAppState } from "@/lib/store";
import { useLocale, useTranslations } from "next-intl";
import { MainNav } from "@/components/nav/MainNav";
import { ReportDialog } from "@/components/app/ReportDialog";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { configureDayjsLocale } from "@/lib/time";
import { openUserMenu, setLocaleCookie } from "@/lib/browser";
import { pullToRefresh } from "@/lib/mobile-pull-to-refresh";
import * as icons from "@/lib/icons";
import { applyThemeColor, getComputedThemeColor } from "@/lib/themes";
import { viewportBand } from "@/lib/utils";
import type { AppBootState, HomeUiState } from "@/lib/cookie-codec";

export function AppProviders({
  children,
  initialBootState,
  initialHomeState,
}: {
  children: React.ReactNode;
  initialBootState?: AppBootState | null;
  initialHomeState?: HomeUiState | null;
}) {
  return (
    <AppStateProvider initialBootState={initialBootState}>
      <LocaleRuntime />
      <DarkModeRuntime />
      <ThemeRuntime />
      <ViewportRuntime />
      <RouteQueryRuntime />
      <AppChrome initialHomeState={initialHomeState} initialBootState={initialBootState} />
      {children}
    </AppStateProvider>
  );
}

function LocaleRuntime() {
  const locale = useLocale();
  useEffect(() => { configureDayjsLocale(locale); document.documentElement.lang = locale; }, [locale]);
  return null;
}

function DarkModeRuntime() {
  const { settings } = useAppState();
  const { darkMode, followSystemTheme } = settings;

  useLayoutEffect(() => {
    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    if (followSystemTheme) {
      apply(window.matchMedia("(prefers-color-scheme: dark)").matches);
    } else {
      apply(darkMode);
    }
  }, [darkMode, followSystemTheme]);

  useEffect(() => {
    if (!followSystemTheme) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
      document.documentElement.style.colorScheme = e.matches ? "dark" : "light";
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [followSystemTheme]);

  return null;
}

function ThemeRuntime() {
  useEffect(() => {
    const stored = localStorage.getItem("theme-color");
    if (stored && /^#[0-9a-f]{6}$/i.test(stored)) {
      applyThemeColor(stored);
    } else {
      const color = getComputedThemeColor();
      applyThemeColor(color);
      try { localStorage.setItem("theme-color", color); } catch {}
    }
  }, []);
  return null;
}

function ViewportRuntime() {
  const app = useAppState();
  useLayoutEffect(() => {
    let raf: number | null = null;
    let lastBand = -1;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const apply = () => {
      raf = null;
      const w = window.innerWidth;
      const band = viewportBand(w);
      if (band === lastBand) return;
      lastBand = band;
      // Columns change at the breakpoint; within a band nothing re-renders.
      app.setWindowWidth(w);
      app.setIsMobile(w < 960);
    };
    const update = () => {
      // Suppress card transitions while actively resizing so cards don't animate their fluid size change.
      document.documentElement.classList.add("holo-resizing");
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => document.documentElement.classList.remove("holo-resizing"), 150);
      if (raf == null) raf = requestAnimationFrame(apply);
    };
    const onVis = () => app.setVisibilityState(document.visibilityState);
    apply(); onVis();
    window.addEventListener("resize", update, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => { if (raf != null) cancelAnimationFrame(raf); if (settle) clearTimeout(settle); document.documentElement.classList.remove("holo-resizing"); window.removeEventListener("resize", update); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  useEffect(() => { if (app.visibilityState === "visible") app.fetchFavoritesLive({ force: false, minutes: 5 }); }, [app.visibilityState, app.userdata.jwt]);
  useEffect(() => { if (!app.orgs.length) app.fetchOrgs(); }, [app.orgs.length]);
  useEffect(() => { app.loginCheck(); }, [app.userdata.jwt]);
  useEffect(() => {
    const timer = setInterval(() => app.fetchFavoritesLive({ force: false, minutes: 5 }), 6 * 60 * 1000);
    const first = setTimeout(() => app.fetchFavoritesLive({ force: false, minutes: 2 }), 5000);
    return () => { clearInterval(timer); clearTimeout(first); };
  }, [app.userdata.jwt]);
  return null;
}

function RouteQueryRuntime() {
  const app = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const locale = useLocale();
  const langRef = useRef<string | null>(null);
  const suppress = useRef(false);

  useEffect(() => {
    const clear = () => { langRef.current = null; suppress.current = true; };
    window.addEventListener("holodex-clear-lang-override", clear);
    return () => window.removeEventListener("holodex-clear-lang-override", clear);
  }, []);

  useEffect(() => {
    const lang = sp.get("lang");
    if (lang) {
      langRef.current = lang; suppress.current = false;
      setLocaleCookie(lang);
      if (lang !== locale) router.refresh();
      return;
    }
    if (suppress.current) return;
    const preserved = langRef.current;
    if (!preserved) return;
    const p = new URLSearchParams(sp.toString());
    p.set("lang", preserved);
    router.replace(`${pathname}${p.toString() ? `?${p.toString()}` : ""}`, { scroll: false });
  }, [locale, pathname, router, sp]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const lang = langRef.current || sp.get("lang");
      if (!lang || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!(e.target instanceof Element)) return;
      const a = e.target.closest<HTMLAnchorElement>("a[href]");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      url.searchParams.set("lang", lang);
      a.href = `${url.pathname}${url.search}${url.hash}`;
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [sp]);

  useEffect(() => {
    const q = sp.get("org");
    if (!q || app.currentOrg.name === q) return;
    const apply = (orgs: any[]) => { const o = orgs.find((x) => x.name === q); if (o) app.setCurrentOrg(o); };
    if (app.orgs.length) apply(app.orgs);
    else app.fetchOrgs().then((orgs) => apply(orgs || []));
  }, [sp, app.currentOrg.name, app.orgs.length]);
  return null;
}

function PullToRefresh() {
  const pathname = usePathname();
  const app = useAppState();
  const ref = useRef(app);
  useEffect(() => { ref.current = app; }, [app]);
  useEffect(() => {
    if (!("ontouchstart" in window)) return;
    const disabled = ["/watch", "/edit/video", "/multiview", "/tlclient", "/scripteditor"].some((p) => pathname.startsWith(p));
    return pullToRefresh({
      container: document.body,
      shouldPullToRefresh: () => !window.scrollY && !disabled && !ref.current.navDrawer,
      async refresh() {
        const r = await ref.current.reloadCurrentPage({ source: "ptr", consumed: false });
        if (!r.consumed) location.reload();
        await new Promise((res) => setTimeout(res, 300));
      },
    });
  }, [pathname]);
  return (
    <div className="pull-to-refresh-material__control pointer-events-none fixed left-1/2 top-0 z-40 hidden size-10 -translate-x-1/2 items-center justify-center rounded-full bg-background text-primary shadow-md group-[.pull-to-refresh--aborting]/ptr:flex group-[.pull-to-refresh--pulling]/ptr:flex group-[.pull-to-refresh--reached]/ptr:flex group-[.pull-to-refresh--refreshing]/ptr:flex group-[.pull-to-refresh--restoring]/ptr:flex">
      <icons.RefreshCw className="size-6 group-[.pull-to-refresh--refreshing]/ptr:hidden group-[.pull-to-refresh--restoring]/ptr:hidden" aria-hidden="true" />
      <Spinner className="hidden size-6 group-[.pull-to-refresh--refreshing]/ptr:block group-[.pull-to-refresh--restoring]/ptr:block" />
    </div>
  );
}

function AppChrome({
  initialHomeState,
  initialBootState,
}: {
  initialHomeState?: HomeUiState | null;
  initialBootState?: AppBootState | null;
}) {
  const app = useAppState();
  const t = useTranslations();
  const [showTwitter, setShowTwitter] = useState(false);

  useEffect(() => {
    const u = app.userdata?.user;
    if (u?.twitter_id && !u?.discord_id && !u?.google_id) setShowTwitter(true);
  }, [app.userdata?.user]);

  return (
    <>
      <MainNav initialHomeState={initialHomeState} initialBootState={initialBootState} />
      <PullToRefresh />
      {showTwitter ? (
        <Alert className="fixed inset-x-3 top-20 z-40 mx-auto max-w-lg">
          <AlertDescription className="gap-3">
            <div className="text-sm font-normal">{t("views.login.twitterMsg.0")}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { setShowTwitter(false); openUserMenu(); }}>{t("views.login.linkAcc")}</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowTwitter(false)}>{t("views.app.close_btn")}</Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      <ReportDialog />
    </>
  );
}
