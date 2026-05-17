"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Search, LayoutDashboard } from "@/lib/icons";
import { PlaylistSvgIcon, SettingsSvgIcon } from "@/components/nav/NavSvgIcons";
import { PlaylistPanel } from "@/components/nav/PlaylistPanel";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsPage } from "@/components/setting/SettingsPage";
import { AboutSection } from "@/components/setting/AboutSection";
import { NavUserMenu } from "@/components/nav/NavUserMenu";
import { SearchDropdown } from "@/components/search/SearchDropdown";
import { useTranslations } from "next-intl";
import { useAppState } from "@/lib/store";
import { musicdexURL } from "@/lib/consts";
import { cn } from "@/lib/utils";
function NavSettingsMenu() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="ghost" size="icon" className="border-0 text-muted-foreground hover:text-foreground" title={t("component.mainNav.settings")} />}>
        <SettingsSvgIcon className="size-5" aria-hidden="true" />
        <span className="sr-only">{t("component.mainNav.settings")}</span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="z-[160] flex max-h-[min(80vh,700px)] w-[26rem] flex-col overflow-hidden p-0">
        <Tabs defaultValue="settings" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex items-center px-3 py-2">
            <TabsList>
              <TabsTrigger value="settings">{t("component.mainNav.settings")}</TabsTrigger>
              <TabsTrigger value="about">{t("component.mainNav.about")}</TabsTrigger>
            </TabsList>
          </div>
          <Separator className="bg-[color:var(--color-border)]" />
          <TabsContent value="settings" className="min-h-0 flex-1 overflow-hidden"><SettingsPage /></TabsContent>
          <TabsContent value="about" className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]"><AboutSection /></TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function NavIconBtn({ render, onClick, children }: { render?: React.ReactElement; onClick?: () => void; children: React.ReactNode }) {
  const props = { variant: "ghost" as const, size: "icon" as const, className: "border-0 text-muted-foreground hover:text-foreground", ...(render ? { nativeButton: false, render } : { onClick }) };
  return <Button {...props}>{children}</Button>;
}

const MUSICDEX_PATH = "M12 3V13.55A4 4 0 1 0 14 17V7H19V3H12Z";

function Logo({ width = 49.531, height = 46.719, className = "block" }: { width?: number | string; height?: number | string; className?: string }) {
  return (
    <svg width={width} height={height} version="1.1" viewBox="0 0 49.531 46.719" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g transform="translate(-71.24 -130.01)">
        <path d="m118.65 149.7a4.2333 4.2333 0 0 1 0 7.3324l-33.127 19.126a4.2333 4.2333 0 0 1-6.35-3.6662v-38.252a4.2333 4.2333 0 0 1 6.35-3.6662" fill="#f06292" />
        <path d="m110.72 149.68a4.2333 4.2333 0 0 1 0 7.3324l-33.127 19.126a4.2333 4.2333 0 0 1-6.35-3.6662v-38.252a4.2333 4.2333 0 0 1 6.35-3.6662" fill="#64b5f6" />
      </g>
    </svg>
  );
}

function MusicdexIcon({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="3" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5DA2F2" />
          <stop offset="0.55" stopColor="#F06292" />
          <stop offset="1" stopColor="#FF3A81" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d={MUSICDEX_PATH} />
    </svg>
  );
}

export function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const app = useAppState();
  const navRoot = useRef<HTMLDivElement>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const isHomeRoute = pathname === "/";
  const isVideoEditRoute = pathname.startsWith("/edit/video");
  const showTopBar =
    !pathname.startsWith("/multiview") &&
    !pathname.startsWith("/tlclient") &&
    !pathname.startsWith("/scripteditor") &&
    !pathname.startsWith("/watch");
  const showMainNavExt = !isVideoEditRoute;
  const showMobileBottomNav = !isVideoEditRoute;
  const playlistCount = app.playlist.length;

  useLayoutEffect(() => {
    if (!showTopBar) return;
    const el = navRoot.current;
    if (!el) return;
    const update = () => {
      const total = Math.ceil(el.getBoundingClientRect().height);
      const header = Math.ceil(
        el.querySelector("header")?.getBoundingClientRect().height || total,
      );
      document.documentElement.style.setProperty(
        "--nav-total-height",
        `${total}px`,
      );
      document.documentElement.style.setProperty(
        "--nav-header-height",
        `${header}px`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTopBar, mobileSearchOpen]);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname, searchParams]);
  useEffect(() => {
    if (!app.orgs.length) app.fetchOrgs();
    app.loginCheck();
  }, []);

  function goHomeFromLogo(e: React.MouseEvent) {
    e.preventDefault();
    const page = app.settings.defaultOpen;
    router.push(page === "multiview" ? "/multiview" : "/");
    void app.reloadCurrentPage({
      source: "logo-home",
      consumed: false,
      defaultOpen: page,
    });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  if (!showTopBar) return null;

  return (
    <div ref={navRoot} className="fixed inset-x-0 top-0 z-[90]">
      <header className="relative z-[130] border-b border-[color:var(--color-border)] bg-[color:var(--surface-nav)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-5 py-3 sm:px-7">
          <a
            href="/"
            className="flex shrink-0 items-center gap-2.5 pr-2 text-left no-underline select-none min-[960px]:pr-4"
            onClick={goHomeFromLogo}
          >
            <Logo width="30" height="28" />
            <div className="hidden min-w-0 text-[1.02rem] font-semibold tracking-[0.01em] text-[color:var(--color-foreground)] sm:block">
              Holodex
            </div>
          </a>
          <div className="hidden min-w-0 flex-1 items-center gap-3 min-[960px]:flex">
            <HomeOrgMultiSelect inline buttonClass="h-10 w-auto min-w-0 max-w-[min(36vw,24rem)] shrink justify-between rounded-xl px-3 text-[0.8rem] font-normal" />
            <SearchDropdown />
            <div className="flex items-center gap-2">
              <NavIconBtn render={<a href={musicdexURL} target="_blank" rel="noopener noreferrer" title="Musicdex" />}>
                <MusicdexIcon className="size-5" /><span className="sr-only">Musicdex</span>
              </NavIconBtn>
              <NavIconBtn render={<Link href="/multiview" title={t("component.mainNav.multiview")} />}>
                <LayoutDashboard className="size-5" />
              </NavIconBtn>
              <Popover open={playlistOpen} onOpenChange={setPlaylistOpen}>
                <PopoverTrigger render={<Button variant="ghost" size="icon" className="group relative border-0 text-muted-foreground hover:text-foreground" title={t("component.mainNav.playlist")} />}>
                  <PlaylistSvgIcon className="size-5" aria-hidden="true" />
                  {playlistCount ? <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center border-border bg-card px-1.5 text-[10px] font-normal normal-case leading-none tracking-normal text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-muted">{playlistCount}</Badge> : null}
                </PopoverTrigger>
                <PlaylistPanel open={playlistOpen} onOpenChange={setPlaylistOpen} />
              </Popover>
              <NavSettingsMenu />
              <NavUserMenu />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1 min-[960px]:hidden">
            <NavIconBtn onClick={() => setMobileSearchOpen((v) => !v)}>
              <span className="sr-only">{t("component.search.toggleSearch")}</span>
              <Search className="h-4 w-4" />
            </NavIconBtn>
            <NavIconBtn render={<Link href="/multiview" title={t("component.mainNav.multiview")} />}>
              <LayoutDashboard className="h-4 w-4" />
            </NavIconBtn>
            <NavIconBtn render={<a href={musicdexURL} target="_blank" rel="noopener noreferrer" title="Musicdex" />}>
              <MusicdexIcon className="h-4 w-4" /><span className="sr-only">Musicdex</span>
            </NavIconBtn>
          </div>
        </div>
        {mobileSearchOpen ? (
          <div className="border-t border-[color:var(--color-border)] px-3 pb-3 min-[960px]:hidden">
            <SearchDropdown />
          </div>
        ) : null}
      </header>
      {showMainNavExt ? (
        <div
          className={cn(
            "main-nav-ext pointer-events-none relative z-[90] px-3 py-2 sm:px-5",
            isHomeRoute && "max-[959.98px]:min-h-[62px]",
          )}
        >
          <div className="pointer-events-auto mx-auto max-w-[1600px]">
            <div id="mainNavExt" className="contents" />
          </div>
        </div>
      ) : null}
      {showMobileBottomNav ? (
        <nav className="fixed inset-x-3 bottom-3 z-40 min-[960px]:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-2">
            <Link
              href="/"
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-[color:var(--color-muted-foreground)] transition",
                isHomeRoute &&
                  "bg-[color:var(--surface-soft)] text-[color:var(--color-foreground)]",
              )}
            >
              <span className="truncate">{t("component.mainNav.home")}</span>
            </Link>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
