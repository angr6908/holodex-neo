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
import type { AppBootState } from "@/lib/cookie-codec";
import { configureDayjsLocale } from "@/lib/time";
import { openUserMenu, setLocaleCookie } from "@/lib/browser";
import { pullToRefresh } from "@/lib/mobile-pull-to-refresh";
import * as icons from "@/lib/icons";

export function AppProviders({ children, initialBootState }: { children: React.ReactNode; initialBootState?: AppBootState | null }) {
  return (
    <AppStateProvider initialBootState={initialBootState}>
      <LocaleRuntime />
      <ViewportRuntime />
      <RouteQueryRuntime />
      <AppChrome />
      {children}
    </AppStateProvider>
  );
}

function LocaleRuntime() {
  const locale = useLocale();
  useEffect(() => { configureDayjsLocale(locale); document.documentElement.lang = locale; }, [locale]);
  return null;
}

function ViewportRuntime() {
  const app = useAppState();
  useLayoutEffect(() => {
    const update = () => { app.setWindowWidth(window.innerWidth); app.setIsMobile(window.innerWidth < 960); };
    const onVis = () => app.setVisibilityState(document.visibilityState);
    update(); onVis();
    window.addEventListener("resize", update, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("resize", update); document.removeEventListener("visibilitychange", onVis); };
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

function AppChrome() {
  const app = useAppState();
  const t = useTranslations();
  const [showTwitter, setShowTwitter] = useState(false);

  useEffect(() => {
    const u = app.userdata?.user;
    if (u?.twitter_id && !u?.discord_id && !u?.google_id) setShowTwitter(true);
  }, [app.userdata?.user]);

  return (
    <>
      <MainNav />
      <PullToRefresh />
      {showTwitter ? (
        <Alert className="fixed inset-x-3 top-20 z-40 mx-auto max-w-lg">
          <AlertDescription className="gap-3">
            <div className="text-sm font-semibold">{t("views.login.twitterMsg.0")}</div>
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
