"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LayoutDashboard, ListVideo, Music, Search, Settings as SettingsIcon, type AnyIcon } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AboutSection } from "@/components/setting/AboutSection";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import { NavUserMenu } from "@/components/nav/NavUserMenu";
import { PlaylistPanel } from "@/components/nav/PlaylistPanel";
import { SearchDropdown } from "@/components/search/SearchDropdown";
import { SettingsPage } from "@/components/setting/SettingsPage";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import { musicdexURL } from "@/lib/consts";
import { useTranslations } from "next-intl";

function NavIconButton({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: AnyIcon;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={onClick}
            className={className}
          />
        }
      >
        <Icon className="size-5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function NavIconLink({
  icon: Icon,
  label,
  href,
  external,
  className,
}: {
  icon: AnyIcon;
  label: string;
  href: string;
  external?: boolean;
  className?: string;
}) {
  const anchor = external
    ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} />
    : <Link href={href} aria-label={label} />;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button nativeButton={false} render={anchor} variant="ghost" size="icon" className={className} />
        }
      >
        <Icon className="size-5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const showTopBar =
    !pathname.startsWith("/multiview") &&
    !pathname.startsWith("/tlclient") &&
    !pathname.startsWith("/scripteditor") &&
    !pathname.startsWith("/watch");
  const playlistCount = app.playlist.length;

  useLayoutEffect(() => {
    if (!showTopBar) return;
    const el = navRoot.current;
    if (!el) return;
    const update = () => {
      const total = Math.ceil(el.getBoundingClientRect().height);
      const header = Math.ceil(el.querySelector("header")?.getBoundingClientRect().height || total);
      document.documentElement.style.setProperty("--nav-total-height", `${total}px`);
      document.documentElement.style.setProperty("--nav-header-height", `${header}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTopBar, mobileSearchOpen]);

  useEffect(() => { setMobileSearchOpen(false); }, [pathname, searchParams]);
  useEffect(() => {
    if (!app.orgs.length) app.fetchOrgs();
    app.loginCheck();
  }, []);

  function goHomeFromLogo(e: React.MouseEvent) {
    e.preventDefault();
    const page = app.settings.defaultOpen;
    router.push(page === "multiview" ? "/multiview" : "/");
    void app.reloadCurrentPage({ source: "logo-home", consumed: false, defaultOpen: page });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  if (!showTopBar) return null;

  return (
    <TooltipProvider>
      <div ref={navRoot} className="fixed inset-x-0 top-0 z-40">
        <header className="relative z-10 border-b bg-background">
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-5">
            <a
              href="/"
              onClick={goHomeFromLogo}
              className="flex shrink-0 items-center gap-2 pr-1 text-left no-underline select-none"
            >
              <img src="/img/icons/uetchy_logo_morespace.png" className="h-7 w-7 object-contain" alt="" />
              <span className="hidden text-base font-semibold tracking-tight text-foreground sm:inline">Holodex</span>
            </a>

            <div className="shrink-0 sm:hidden">
              <HomeOrgMultiSelect iconOnly buttonVariant="ghost" buttonClass="size-8 p-0 justify-center" />
            </div>
            <div className="hidden shrink-0 sm:block">
              <HomeOrgMultiSelect buttonClass="w-auto min-w-0 max-w-[12rem] min-[960px]:max-w-[18rem]" />
            </div>

            <div
              id="mainNavHomeControls"
              className="min-w-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            />

            <div className="hidden min-w-0 flex-1 min-[960px]:block">
              <SearchDropdown />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <NavIconButton
                icon={Search}
                label={t("component.search.toggleSearch")}
                onClick={() => setMobileSearchOpen((v) => !v)}
                className="min-[960px]:hidden"
              />

              <NavIconLink icon={Music} label="Musicdex" href={musicdexURL} external className="hidden md:inline-flex" />
              <NavIconLink icon={LayoutDashboard} label={t("component.mainNav.multiview")} href="/multiview" />

              <Popover open={playlistOpen} onOpenChange={setPlaylistOpen}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("component.mainNav.playlist")}
                            className={cn("relative")}
                          />
                        }
                      />
                    }
                  >
                    <ListVideo className="size-5" aria-hidden="true" />
                    {playlistCount ? (
                      <Badge variant="secondary" className="absolute -right-1 -top-1">{playlistCount}</Badge>
                    ) : null}
                  </TooltipTrigger>
                  <TooltipContent>{t("component.mainNav.playlist")}</TooltipContent>
                </Tooltip>
                <PlaylistPanel open={playlistOpen} onOpenChange={setPlaylistOpen} />
              </Popover>

              <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("component.mainNav.settings")}
                          />
                        }
                      />
                    }
                  >
                    <SettingsIcon className="size-5" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>{t("component.mainNav.settings")}</TooltipContent>
                </Tooltip>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="flex max-h-[min(80dvh,44rem)] w-[min(92vw,26rem)] flex-col overflow-hidden p-0"
                >
                  <Tabs defaultValue="settings" className="flex min-h-0 flex-1 flex-col gap-0">
                    <div className="flex items-center px-3 py-2">
                      <TabsList>
                        <TabsTrigger value="settings">{t("component.mainNav.settings")}</TabsTrigger>
                        <TabsTrigger value="about">{t("component.mainNav.about")}</TabsTrigger>
                      </TabsList>
                    </div>
                    <Separator />
                    <TabsContent value="settings" className="min-h-0 flex-1 overflow-hidden">
                      <SettingsPage />
                    </TabsContent>
                    <TabsContent value="about" className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
                      <AboutSection />
                    </TabsContent>
                  </Tabs>
                </PopoverContent>
              </Popover>

              <NavUserMenu />
            </div>
          </div>

          {mobileSearchOpen ? (
            <div className="border-t border-border px-3 py-3 min-[960px]:hidden">
              <SearchDropdown />
            </div>
          ) : null}
        </header>
      </div>
    </TooltipProvider>
  );
}
