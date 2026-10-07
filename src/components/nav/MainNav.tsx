"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import {
  type HomeNavMode,
  HomeNavSegments,
  type HomeNavSelection,
} from "@/components/nav/HomeNavSegments";
import { useNavUserMenu } from "@/components/nav/NavUserMenu";
import { PlaylistPanel } from "@/components/nav/PlaylistPanel";
import { VideoListTopControls } from "@/components/nav/VideoListTopControls";
import { SearchDropdown } from "@/components/search/SearchDropdown";
import { AboutSection } from "@/components/setting/AboutSection";
import { SettingsPage } from "@/components/setting/SettingsPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { musicdexURL } from "@/lib/consts";
import { type AppBootState, HOME_TABS, type HomeUiState } from "@/lib/cookie-codec";
import { displayModeFor } from "@/lib/display-mode";
import { LayoutDashboard, ListVideo, Music, Search, Settings as SettingsIcon } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

// Nav buttons dip on press even when they open a popup (the Button base skips aria-haspopup).
const NAV_BUTTON_PRESS_CLASS = "active:translate-y-px";

const liveCountFrom = (videos: any[] | undefined | null) =>
  (videos || []).filter((v) => v?.status === "live").length;

function homeNavModeFor(tab: number, viewMode: "streams" | "channels"): HomeNavMode {
  if (viewMode === "channels") return "channels";
  if (tab === HOME_TABS.ARCHIVE) return "archive";
  if (tab === HOME_TABS.CLIPS) return "clips";
  return "live-upcoming";
}

// The live count on the Home/Favorites segment: hidden with live streams, from the store once it
// has data, else from the server-rendered boot state.
function navLiveCount(
  app: ReturnType<typeof useAppState>,
  initialBootState: AppBootState | null | undefined,
) {
  if (app.settings.hideLive) return undefined;
  const isFavPage = app.homeNav.isFavPage;
  const selectedLive = isFavPage ? app.favoritesLive : app.homeLive;
  if (app.hydrated || selectedLive.length) return liveCountFrom(selectedLive);
  return isFavPage ? initialBootState?.favoritesLiveCount : initialBootState?.homeLiveCount;
}

// Publishes the nav's height as CSS variables for the pages laid out under it.
function useNavHeightVars(
  navRoot: React.RefObject<HTMLDivElement | null>,
  showTopBar: boolean,
  mobileSearchOpen: boolean,
) {
  useLayoutEffect(() => {
    if (!showTopBar) return;
    const el = navRoot.current;
    if (!el) return;
    const update = () => {
      const total = Math.ceil(el.getBoundingClientRect().height);
      const header = Math.ceil(el.querySelector("header")?.getBoundingClientRect().height || total);
      document.documentElement.style.setProperty("--nav-total-height", `${total}px`);
      document.documentElement.style.setProperty("--nav-header-height", `${header}px`);
      document.documentElement.style.setProperty("--nav-h", `${header}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [navRoot, showTopBar, mobileSearchOpen]);
}

// Home/Favorites/tab segments plus the slot the active list portals its controls into. Until the
// store hydrates, a placeholder copy of the controls holds their space on the streams view.
function NavHomeControls({ initialBootState }: { initialBootState?: AppBootState | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const app = useAppState();
  const isHomePath = pathname === "/";
  const storedHomeNavState = app.homeNav;
  const { hideLive, hideUpcoming } = app.settings;
  const homeSelection: HomeNavSelection = isHomePath
    ? {
        fav: storedHomeNavState.isFavPage,
        mode: homeNavModeFor(storedHomeNavState.tab, storedHomeNavState.viewMode),
      }
    : null;
  const showNavControlsSkeleton =
    isHomePath && storedHomeNavState.viewMode === "streams" && !app.hydrated;

  function openHome(next: HomeUiState) {
    app.setHomeNav(next);
    if (!isHomePath) router.push("/");
  }

  const openHomeStreams = (fav: boolean) => {
    const tab = pathname === "/" ? storedHomeNavState.tab : HOME_TABS.LIVE_UPCOMING;
    openHome({ viewMode: "streams", isFavPage: fav, tab });
  };

  const openHomeTab = (tab: number) => {
    openHome({
      viewMode: "streams",
      isFavPage: pathname === "/" ? storedHomeNavState.isFavPage : false,
      tab,
    });
  };

  const openHomeChannels = () => {
    openHome({
      viewMode: "channels",
      isFavPage: pathname === "/" ? storedHomeNavState.isFavPage : false,
      tab: pathname === "/" ? storedHomeNavState.tab : HOME_TABS.LIVE_UPCOMING,
    });
  };

  return (
    <div
      id="mainNavHomeControls"
      className="-my-px flex min-w-0 items-center gap-1.5 overflow-x-auto py-px [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <HomeNavSegments
        selection={homeSelection}
        hideBoth={hideLive && hideUpcoming}
        hideLive={hideLive}
        liveCount={navLiveCount(app, initialBootState)}
        onHome={() => openHomeStreams(false)}
        onFavorites={() => openHomeStreams(true)}
        onTab={openHomeTab}
        onChannels={openHomeChannels}
      />
      <div id="mainNavPageControls" className="flex shrink-0 items-center gap-1.5 empty:hidden">
        {showNavControlsSkeleton ? (
          <div
            data-nav-controls-skeleton
            inert
            className="pointer-events-none flex shrink-0 items-center gap-1.5"
            aria-hidden="true"
          >
            <VideoListTopControls
              tab={storedHomeNavState.tab}
              isActive
              sortBy="viewers"
              displayMode={displayModeFor(app.settings.homeViewMode, app.currentGridSize)}
              toDate={null}
              clipLangs={app.settings.clipLangs || []}
              onSortByChange={() => {}}
              onDisplayModeChange={() => {}}
              onToDateChange={() => {}}
              onToggleClipLang={() => {}}
            />
          </div>
        ) : null}
        <div id="date-selectorfalse" className="contents empty:hidden" />
        <div id="date-selectortrue" className="contents empty:hidden" />
        <div id="channels-panel-portal" className="contents empty:hidden" />
      </div>
    </div>
  );
}

function PlaylistButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const app = useAppState();
  const playlistCount = app.playlist.length;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label={t("component.mainNav.playlist")}
            title={t("component.mainNav.playlist")}
            className={cn("relative", NAV_BUTTON_PRESS_CLASS)}
            pressHighlight
            selected={open}
          />
        }
      >
        <ListVideo className="size-4" aria-hidden="true" />
        {playlistCount ? (
          <Badge variant="secondary" className="absolute -right-1 -top-1">
            {playlistCount}
          </Badge>
        ) : null}
      </PopoverTrigger>
      <PlaylistPanel open={open} onOpenChange={onOpenChange} />
    </Popover>
  );
}

function SettingsButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label={t("component.mainNav.settings")}
            title={t("component.mainNav.settings")}
            className={NAV_BUTTON_PRESS_CLASS}
            pressHighlight
            selected={open}
          />
        }
      >
        <SettingsIcon className="size-4" aria-hidden="true" />
      </PopoverTrigger>
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
          <TabsContent
            value="about"
            className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]"
          >
            <AboutSection />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function UserMenuButton({ userMenu }: { userMenu: ReturnType<typeof useNavUserMenu> }) {
  const app = useAppState();
  const hasUser = !!app.userdata?.user;
  return (
    <Popover open={userMenu.menuOpen} onOpenChange={userMenu.setMenuOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={cn(
              "cursor-pointer overflow-hidden",
              NAV_BUTTON_PRESS_CLASS,
              hasUser && "w-9 p-0",
            )}
            pressHighlight
            selected={userMenu.menuOpen}
            aria-label={userMenu.triggerLabel}
          />
        }
      >
        {userMenu.triggerContent}
      </PopoverTrigger>
      {userMenu.content}
    </Popover>
  );
}

// Search (narrow screens), Musicdex (wide screens), multiview, playlist, settings and the user
// menu.
function NavActions({
  windowWidth,
  mobileSearchOpen,
  onToggleMobileSearch,
  playlistOpen,
  onPlaylistOpenChange,
  settingsOpen,
  onSettingsOpenChange,
  userMenu,
}: {
  windowWidth: number;
  mobileSearchOpen: boolean;
  onToggleMobileSearch: () => void;
  playlistOpen: boolean;
  onPlaylistOpenChange: (open: boolean) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  userMenu: ReturnType<typeof useNavUserMenu>;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const onMultiview = pathname.startsWith("/multiview");
  return (
    <ButtonGroup>
      {windowWidth < 960 ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-label={t("component.search.toggleSearch")}
          aria-pressed={mobileSearchOpen || undefined}
          title={t("component.search.toggleSearch")}
          onClick={onToggleMobileSearch}
          className={NAV_BUTTON_PRESS_CLASS}
          pressHighlight
          selected={mobileSearchOpen}
        >
          <Search className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
      {windowWidth >= 768 ? (
        <Button
          nativeButton={false}
          render={
            <a href={musicdexURL} target="_blank" rel="noopener noreferrer" aria-label="Musicdex" />
          }
          variant="outline"
          size="lg"
          title="Musicdex"
          className={NAV_BUTTON_PRESS_CLASS}
          pressHighlight
        >
          <Music className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        nativeButton={false}
        render={<Link href="/multiview" aria-label={t("component.mainNav.multiview")} />}
        variant="outline"
        size="lg"
        aria-pressed={onMultiview || undefined}
        title={t("component.mainNav.multiview")}
        className={NAV_BUTTON_PRESS_CLASS}
        pressHighlight
        selected={onMultiview}
      >
        <LayoutDashboard className="size-4" aria-hidden="true" />
      </Button>

      <PlaylistButton open={playlistOpen} onOpenChange={onPlaylistOpenChange} />
      <SettingsButton open={settingsOpen} onOpenChange={onSettingsOpenChange} />
      <UserMenuButton userMenu={userMenu} />
    </ButtonGroup>
  );
}

export function MainNav({ initialBootState }: { initialBootState?: AppBootState | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const app = useAppState();
  const navRoot = useRef<HTMLDivElement>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const userMenu = useNavUserMenu();

  const showTopBar =
    !pathname.startsWith("/multiview") &&
    !pathname.startsWith("/tlclient") &&
    !pathname.startsWith("/scripteditor");

  useNavHeightVars(navRoot, showTopBar, mobileSearchOpen);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname, searchParams]);

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
      <div ref={navRoot} className="fixed inset-x-0 top-0 z-40 bg-background pb-1">
        <header className="relative z-10 bg-background">
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-5 py-2 sm:gap-3 sm:px-8 lg:px-10 xl:px-12">
            <Link
              href="/"
              onClick={goHomeFromLogo}
              className="flex shrink-0 items-center gap-2 pr-1 text-left no-underline select-none"
            >
              <img
                src="/img/icons/uetchy_logo_morespace.png"
                className="h-7 w-7 object-contain"
                alt=""
              />
              <span className="hidden font-brand text-base font-semibold leading-none tracking-tight text-foreground sm:inline">
                Holodex
              </span>
            </Link>

            <div className="shrink-0 sm:hidden">
              <HomeOrgMultiSelect
                iconOnly
                buttonVariant="outline"
                className="size-9 p-0 justify-center dark:data-[popup-open]:bg-muted! active:translate-y-0!"
                buttonPressHighlight
              />
            </div>
            <div className="hidden shrink-0 sm:block">
              <HomeOrgMultiSelect
                buttonVariant="outline"
                className="h-9 w-auto min-w-0 max-w-[12rem] min-[960px]:max-w-[18rem] dark:data-[popup-open]:bg-muted! active:translate-y-0!"
                buttonPressHighlight
              />
            </div>

            <NavHomeControls initialBootState={initialBootState} />

            <div className="hidden min-w-0 flex-1 min-[960px]:block">
              <SearchDropdown />
            </div>

            <div className="ml-auto flex shrink-0 items-center">
              <NavActions
                windowWidth={app.windowWidth || initialBootState?.windowWidth || 1440}
                mobileSearchOpen={mobileSearchOpen}
                onToggleMobileSearch={() => setMobileSearchOpen((v) => !v)}
                playlistOpen={playlistOpen}
                onPlaylistOpenChange={setPlaylistOpen}
                settingsOpen={settingsOpen}
                onSettingsOpenChange={setSettingsOpen}
                userMenu={userMenu}
              />
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
