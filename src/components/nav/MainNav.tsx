"use client";

import dayjs from "dayjs";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import {
  type HomeNavMode,
  HomeNavSegments,
  type HomeNavSelection,
} from "@/components/nav/HomeNavSegments";
import { useNavUserMenu } from "@/components/nav/NavUserMenu";
import { PlaylistPanel } from "@/components/nav/PlaylistPanel";
import { SearchDropdown } from "@/components/search/SearchDropdown";
import { AboutSection } from "@/components/setting/AboutSection";
import { SettingsPage } from "@/components/setting/SettingsPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { SkeletonCardList } from "@/components/video/SkeletonCardList";
import { VideoCardList } from "@/components/video/VideoCardList";
import { ALL_VTUBERS_ORG, musicdexURL, TL_LANGS } from "@/lib/consts";
import { type AppBootState, HOME_TABS, type HomeUiState } from "@/lib/cookie-codec";
import { getLiveViewerCount } from "@/lib/functions";
import {
  buildHomeTabQuery,
  clearHomeMultiOrgVideoCache,
  ensureFavoritesVideoFetch,
  ensureHomeMultiOrgVideoFetch,
  getHomeMultiOrgVideoCache,
  hasHomeMultiOrgVideoCache,
} from "@/lib/home-video-loader";
import { useDomElement } from "@/lib/hooks";
import {
  type AnyIcon,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Eye,
  Grid2x2,
  Languages,
  LayoutDashboard,
  LayoutGrid,
  List,
  ListFilter,
  ListVideo,
  Music,
  Rows3,
  Search,
  Settings as SettingsIcon,
} from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useTopicsCache } from "@/lib/topics";
import { cn, getBreakpoint } from "@/lib/utils";

const NAV_ACTIVE_BUTTON_CLASS =
  "bg-muted! text-foreground! data-[popup-open]:bg-muted! data-[popup-open]:text-foreground!";
const NAV_BUTTON_PRESS_CLASS = "active:translate-y-px active:bg-muted! active:text-foreground!";

const liveCountFrom = (videos: any[] | undefined | null) =>
  (videos || []).filter((v) => v?.status === "live").length;

const displayModeFor = (viewMode: string | undefined, gridSize: number): DisplayMode => {
  if (viewMode === "list") return "list";
  if (viewMode === "denseList") return "denseList";
  return `grid-${Math.min(Math.max(gridSize ?? 0, 0), 2)}` as DisplayMode;
};

function homeNavModeFor(tab: number, viewMode: "streams" | "channels"): HomeNavMode {
  if (viewMode === "channels") return "channels";
  if (tab === HOME_TABS.ARCHIVE) return "archive";
  if (tab === HOME_TABS.CLIPS) return "clips";
  return "live-upcoming";
}

function getHomeCachedLoaderPage(cacheKey: string, page: number, limit: number) {
  const cached = getHomeMultiOrgVideoCache(cacheKey);
  if (!cached?.isReady()) return null;
  const offset = (page - 1) * limit;
  const snap = cached.getCurrentItems();
  if (!cached.isExhausted() && offset + limit > snap.length) return null;
  return {
    items: snap.slice(offset, offset + limit),
    offset,
    total: cached.isExhausted() ? snap.length : Math.max(snap.length + limit, offset + limit),
  };
}

export function MainNav({ initialBootState }: { initialBootState?: AppBootState | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
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
  const playlistCount = app.playlist.length;
  const isHomePath = pathname === "/";
  const storedHomeNavState = app.homeNav;
  const selectedLive = storedHomeNavState.isFavPage ? app.favoritesLive : app.homeLive;
  const hideLive = app.settings.hideLive;
  const hideUpcoming = app.settings.hideUpcoming;
  const bootLiveCount = storedHomeNavState.isFavPage
    ? initialBootState?.favoritesLiveCount
    : initialBootState?.homeLiveCount;
  const liveCount = hideLive
    ? undefined
    : app.hydrated || selectedLive.length
      ? liveCountFrom(selectedLive)
      : bootLiveCount;
  const homeSelection: HomeNavSelection = isHomePath
    ? {
        fav: storedHomeNavState.isFavPage,
        mode: homeNavModeFor(storedHomeNavState.tab, storedHomeNavState.viewMode),
      }
    : null;
  const skeletonDisplayMode = displayModeFor(app.settings.homeViewMode, app.currentGridSize);
  const showNavControlsSkeleton =
    isHomePath && storedHomeNavState.viewMode === "streams" && !app.hydrated;
  const navWindowWidth = app.windowWidth || initialBootState?.windowWidth || 1440;
  const showMobileSearchButton = navWindowWidth < 960;
  const showMusicButton = navWindowWidth >= 768;
  const hasUser = !!app.userdata?.user;

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
    void app.reloadCurrentPage({ source: "logo-home", consumed: false, defaultOpen: page });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

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

  if (!showTopBar) return null;

  return (
    <TooltipProvider>
      <div ref={navRoot} className="fixed inset-x-0 top-0 z-40 bg-background pb-1">
        <header className="relative z-10 bg-background">
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-5 py-2 sm:gap-3 sm:px-8 lg:px-10 xl:px-12">
            <a
              href="/"
              onClick={goHomeFromLogo}
              className="flex shrink-0 items-center gap-2 pr-1 text-left no-underline select-none"
            >
              <img
                src="/img/icons/uetchy_logo_morespace.png"
                className="h-7 w-7 object-contain"
                alt=""
              />
              <span
                className="hidden text-base font-semibold leading-none tracking-tight text-foreground sm:inline"
                style={{
                  fontFamily: '"IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif',
                  fontWeight: 600,
                }}
              >
                Holodex
              </span>
            </a>

            <div className="shrink-0 sm:hidden">
              <HomeOrgMultiSelect
                iconOnly
                buttonVariant="outline"
                buttonClass={cn(
                  "size-9 p-0 justify-center dark:data-[popup-open]:bg-muted!",
                  NAV_BUTTON_PRESS_CLASS,
                  "active:translate-y-0!",
                )}
              />
            </div>
            <div className="hidden shrink-0 sm:block">
              <HomeOrgMultiSelect
                buttonVariant="outline"
                buttonClass={cn(
                  "h-9 w-auto min-w-0 max-w-[12rem] min-[960px]:max-w-[18rem] dark:data-[popup-open]:bg-muted!",
                  NAV_BUTTON_PRESS_CLASS,
                  "active:translate-y-0!",
                )}
              />
            </div>

            <div
              id="mainNavHomeControls"
              className="-my-px flex min-w-0 items-center gap-1.5 overflow-x-auto py-px [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <HomeNavSegments
                selection={homeSelection}
                hideBoth={hideLive && hideUpcoming}
                hideLive={hideLive}
                liveCount={liveCount}
                onHome={() => openHomeStreams(false)}
                onFavorites={() => openHomeStreams(true)}
                onTab={openHomeTab}
                onChannels={openHomeChannels}
              />
              <div
                id="mainNavPageControls"
                className="flex shrink-0 items-center gap-1.5 empty:hidden"
              >
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
                      displayMode={skeletonDisplayMode}
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

            <div className="hidden min-w-0 flex-1 min-[960px]:block">
              <SearchDropdown />
            </div>

            <div className="ml-auto flex shrink-0 items-center">
              <ButtonGroup>
                {showMobileSearchButton ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    aria-label={t("component.search.toggleSearch")}
                    aria-pressed={mobileSearchOpen || undefined}
                    title={t("component.search.toggleSearch")}
                    onClick={() => setMobileSearchOpen((v) => !v)}
                    className={cn(
                      NAV_BUTTON_PRESS_CLASS,
                      mobileSearchOpen && NAV_ACTIVE_BUTTON_CLASS,
                    )}
                  >
                    <Search className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
                {showMusicButton ? (
                  <Button
                    nativeButton={false}
                    render={
                      <a
                        href={musicdexURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Musicdex"
                      />
                    }
                    variant="outline"
                    size="lg"
                    title="Musicdex"
                    className={NAV_BUTTON_PRESS_CLASS}
                  >
                    <Music className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
                <Button
                  nativeButton={false}
                  render={<Link href="/multiview" aria-label={t("component.mainNav.multiview")} />}
                  variant="outline"
                  size="lg"
                  aria-pressed={pathname.startsWith("/multiview") || undefined}
                  title={t("component.mainNav.multiview")}
                  className={cn(
                    NAV_BUTTON_PRESS_CLASS,
                    pathname.startsWith("/multiview") && NAV_ACTIVE_BUTTON_CLASS,
                  )}
                >
                  <LayoutDashboard className="size-4" aria-hidden="true" />
                </Button>

                <Popover open={playlistOpen} onOpenChange={setPlaylistOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        aria-label={t("component.mainNav.playlist")}
                        title={t("component.mainNav.playlist")}
                        className={cn(
                          "relative",
                          NAV_BUTTON_PRESS_CLASS,
                          playlistOpen && NAV_ACTIVE_BUTTON_CLASS,
                        )}
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
                  <PlaylistPanel open={playlistOpen} onOpenChange={setPlaylistOpen} />
                </Popover>

                <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        aria-label={t("component.mainNav.settings")}
                        title={t("component.mainNav.settings")}
                        className={cn(
                          NAV_BUTTON_PRESS_CLASS,
                          settingsOpen && NAV_ACTIVE_BUTTON_CLASS,
                        )}
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
                          <TabsTrigger value="settings">
                            {t("component.mainNav.settings")}
                          </TabsTrigger>
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
                          userMenu.menuOpen && NAV_ACTIVE_BUTTON_CLASS,
                        )}
                        aria-label={userMenu.triggerLabel}
                      />
                    }
                  >
                    {userMenu.triggerContent}
                  </PopoverTrigger>
                  {userMenu.content}
                </Popover>
              </ButtonGroup>
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

type VideoListFiltersProps = {
  topicFilter?: boolean;
  liveFilter?: boolean;
  upcomingFilter?: boolean;
  collabFilter?: boolean;
  placeholderFilter?: boolean;
  missingFilter?: boolean;
  showDescriptions?: boolean;
  compact?: boolean;
  className?: string;
  sortBy?: string;
  onSortByChange?: (value: string) => void;
};

const SORT_OPTIONS: { value: string; icon: AnyIcon; labelKey: string }[] = [
  { value: "viewers", icon: Eye, labelKey: "views.home.controls.viewers" },
  { value: "latest", icon: Clock, labelKey: "views.home.controls.latest" },
];

export function VideoListFilters({
  topicFilter = true,
  liveFilter = true,
  upcomingFilter = true,
  collabFilter = true,
  placeholderFilter = true,
  missingFilter = true,
  showDescriptions = true,
  compact = false,
  className = "",
  sortBy,
  onSortByChange,
}: VideoListFiltersProps) {
  const app = useAppState();
  const t = useTranslations();
  const { topics, topicsLoading, fetchTopics } = useTopicsCache();
  const topicComboboxAnchor = useComboboxAnchor();

  useEffect(() => {
    if (topicFilter) void fetchTopics();
  }, [topicFilter]);

  const ignoredTopics = app.settings.ignoredTopics || [];
  const topicValues = useMemo(() => topics.map((topic) => topic.value), [topics]);
  const showSort = sortBy !== undefined && onSortByChange !== undefined;

  function updateIgnoredTopics(values: string[]) {
    app.patchSettings({ ignoredTopics: [...new Set(values)].sort() });
  }

  function chip({
    checked,
    label,
    onChange,
  }: {
    checked: boolean;
    label: string;
    onChange: (value: boolean) => void;
  }) {
    return (
      <Toggle
        pressed={checked}
        variant="outline"
        className="w-full justify-start"
        aria-label={label}
        onPressedChange={onChange}
      >
        <span className="truncate">{label}</span>
      </Toggle>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        compact ? "" : "max-h-[60vh] overflow-y-auto pr-1",
        className,
      )}
    >
      {showSort ? (
        <div className="flex flex-col gap-[0.45rem]">
          <span className="text-[0.68rem] font-normal uppercase tracking-[0.16em] text-muted-foreground">
            {t("views.home.controls.sortBy")}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {SORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const label = t(option.labelKey as any);
              return (
                <Toggle
                  key={option.value}
                  pressed={sortBy === option.value}
                  variant="outline"
                  className="w-full justify-start"
                  aria-label={label}
                  onPressedChange={() => onSortByChange!(option.value)}
                >
                  <Icon className="size-4" />
                  <span className="truncate">{label}</span>
                </Toggle>
              );
            })}
          </div>
        </div>
      ) : null}

      {topicFilter ? (
        <div className="flex flex-col gap-[0.45rem]">
          <div className="space-y-1">
            <div className="text-[0.68rem] font-normal uppercase tracking-[0.16em] text-muted-foreground">
              {t("views.settings.filters.blockedTopics")}
            </div>
            {showDescriptions ? (
              <div className="text-xs text-muted-foreground">
                {topicsLoading
                  ? t("component.search.loading")
                  : t("views.settings.filters.blockedTopicsDescription")}
              </div>
            ) : null}
          </div>
          <Combobox
            multiple
            items={topicValues}
            value={ignoredTopics}
            onOpenChange={(open) => {
              if (open) void fetchTopics();
            }}
            onValueChange={updateIgnoredTopics}
          >
            <ComboboxChips ref={topicComboboxAnchor}>
              {ignoredTopics.map((topicValue) => (
                <ComboboxChip key={topicValue}>{topicValue}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                placeholder={
                  ignoredTopics.length
                    ? undefined
                    : topicsLoading
                      ? t("component.search.loading")
                      : t("views.settings.filters.searchTopics")
                }
                onFocus={() => {
                  void fetchTopics();
                }}
              />
            </ComboboxChips>
            <ComboboxContent anchor={topicComboboxAnchor}>
              <ComboboxEmpty>
                {topicsLoading
                  ? t("component.search.loading")
                  : t("component.search.noTopicsFound")}
              </ComboboxEmpty>
              <ComboboxList>
                {(topicValue: string, index: number) => (
                  <ComboboxItem key={topicValue} value={topicValue} index={index}>
                    {topicValue}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      ) : null}

      {liveFilter || upcomingFilter || collabFilter || placeholderFilter || missingFilter ? (
        <div className="flex flex-col gap-[0.45rem]">
          <span className="text-[0.68rem] font-normal uppercase tracking-[0.16em] text-muted-foreground">
            {t("views.settings.filters.hideStreams")}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {liveFilter
              ? chip({
                  checked: app.settings.hideLive,
                  label: t("views.home.liveLabel"),
                  onChange: (v) => app.patchSettings({ hideLive: v }),
                })
              : null}
            {upcomingFilter
              ? chip({
                  checked: app.settings.hideUpcoming,
                  label: t("views.home.upcomingLabel"),
                  onChange: (v) => app.patchSettings({ hideUpcoming: v }),
                })
              : null}
            {collabFilter
              ? chip({
                  checked: app.settings.hideCollabStreams,
                  label: t("views.settings.filters.collab"),
                  onChange: (v) => app.patchSettings({ hideCollabStreams: v }),
                })
              : null}
            {placeholderFilter
              ? chip({
                  checked: app.settings.hidePlaceholder,
                  label: t("views.settings.filters.placeholder"),
                  onChange: (v) => app.patchSettings({ hidePlaceholder: v }),
                })
              : null}
            {missingFilter
              ? chip({
                  checked: app.settings.hideMissing,
                  label: t("views.settings.filters.missing"),
                  onChange: (v) => app.patchSettings({ hideMissing: v }),
                })
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type DisplayMode = "grid-0" | "grid-1" | "grid-2" | "list" | "denseList";

const DISPLAY_OPTIONS: { value: DisplayMode; icon: AnyIcon; labelKey: string; fallback: string }[] =
  [
    {
      value: "grid-0",
      icon: LayoutGrid,
      labelKey: "views.settings.gridSize.0",
      fallback: "Large grid",
    },
    {
      value: "grid-1",
      icon: LayoutDashboard,
      labelKey: "views.settings.gridSize.1",
      fallback: "Medium grid",
    },
    {
      value: "grid-2",
      icon: Grid2x2,
      labelKey: "views.settings.gridSize.2",
      fallback: "Small grid",
    },
    { value: "list", icon: List, labelKey: "views.home.controls.list", fallback: "List" },
    {
      value: "denseList",
      icon: Rows3,
      labelKey: "views.home.controls.denseList",
      fallback: "Dense list",
    },
  ];

export function VideoListTopControls({
  tab,
  isActive,
  sortBy,
  displayMode,
  toDate,
  clipLangs,
  onSortByChange,
  onDisplayModeChange,
  onToDateChange,
  onToggleClipLang,
}: {
  tab: number;
  isActive: boolean;
  sortBy: string;
  displayMode: DisplayMode;
  toDate: string | null;
  clipLangs: string[];
  onSortByChange: (value: string) => void;
  onDisplayModeChange: (value: DisplayMode) => void;
  onToDateChange: (value: string | null) => void;
  onToggleClipLang: (value: string, checked: boolean) => void;
}) {
  const t = useTranslations();
  const [dateOpen, setDateOpen] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const showDate = tab !== HOME_TABS.LIVE_UPCOMING && isActive;
  const showClipLangs = tab === HOME_TABS.CLIPS && isActive;
  const showFilter = tab !== HOME_TABS.CLIPS;
  const selectedDate = toDate ? new Date(`${toDate}T12:00:00`) : undefined;

  const labelFor = (option: (typeof DISPLAY_OPTIONS)[number]) => {
    const label = t(option.labelKey as any);
    return label === option.labelKey ? option.fallback : label;
  };

  return (
    <ButtonGroup className="shrink-0">
      {showFilter ? (
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={cn(NAV_BUTTON_PRESS_CLASS, filterOpen && NAV_ACTIVE_BUTTON_CLASS)}
                aria-pressed={filterOpen}
                aria-label={t("views.settings.filters.hideStreams")}
                title={t("views.settings.filters.hideStreams")}
              />
            }
          >
            <ListFilter className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,22rem)]">
            <VideoListFilters
              showDescriptions={false}
              compact
              sortBy={tab === HOME_TABS.LIVE_UPCOMING ? sortBy : undefined}
              onSortByChange={tab === HOME_TABS.LIVE_UPCOMING ? onSortByChange : undefined}
            />
          </PopoverContent>
        </Popover>
      ) : null}

      {showClipLangs ? (
        <Popover open={clipOpen} onOpenChange={setClipOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={cn(NAV_BUTTON_PRESS_CLASS, clipOpen && NAV_ACTIVE_BUTTON_CLASS)}
                aria-pressed={clipOpen}
                aria-label={t("views.home.controls.clipLanguages")}
                title={t("views.home.controls.clipLanguages")}
              />
            }
          >
            <Languages className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,22rem)]">
            <div className="grid grid-cols-2 gap-2">
              {TL_LANGS.map((lang) => (
                <Toggle
                  key={`${lang.value}-clip`}
                  pressed={clipLangs.includes(lang.value)}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  aria-label={lang.text}
                  onPressedChange={(pressed) => onToggleClipLang(lang.value, pressed)}
                >
                  <span className="truncate">{lang.text}</span>
                </Toggle>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {showDate ? (
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={cn(
                  NAV_BUTTON_PRESS_CLASS,
                  (dateOpen || !!toDate) && NAV_ACTIVE_BUTTON_CLASS,
                )}
                aria-pressed={dateOpen || !!toDate}
                aria-label={t("views.home.controls.pickDate")}
                title={t("views.home.controls.pickDate")}
              />
            }
          >
            <CalendarIcon className="size-4" />
            {toDate ? <span>{dayjs(selectedDate).format("MMM D")}</span> : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                onToDateChange(date ? dayjs(date).format("YYYY-MM-DD") : null);
                setDateOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      ) : null}

      <Popover open={displayOpen} onOpenChange={setDisplayOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={cn(NAV_BUTTON_PRESS_CLASS, displayOpen && NAV_ACTIVE_BUTTON_CLASS)}
              aria-pressed={displayOpen}
              aria-label={t("views.home.controls.displayMode") || "Display mode"}
              title={t("views.home.controls.displayMode") || "Display mode"}
            />
          }
        >
          {(() => {
            const Icon = (
              DISPLAY_OPTIONS.find((option) => option.value === displayMode) ?? DISPLAY_OPTIONS[0]
            ).icon;
            return <Icon className="size-4" />;
          })()}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto min-w-36 gap-0 p-1">
          {DISPLAY_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onDisplayModeChange(option.value);
                  setDisplayOpen(false);
                }}
                className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
              >
                <Icon className="size-4" />
                <span className="flex-1 text-left whitespace-nowrap">{labelFor(option)}</span>
                {displayMode === option.value ? (
                  <Check className="absolute right-2 size-4" />
                ) : null}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </ButtonGroup>
  );
}

export function ConnectedVideoList({
  liveContent = null,
  isFavPage = false,
  tab = HOME_TABS.LIVE_UPCOMING,
  isActive = true,
  datePortalName = "",
  inMultiViewSelector,
  orgTargetsOverride = null,
  ...attrs
}: {
  liveContent?: any[] | null;
  isFavPage?: boolean;
  tab?: number;
  isActive?: boolean;
  datePortalName?: string;
  inMultiViewSelector?: boolean;
  orgTargetsOverride?: any[] | null;
  [key: string]: any;
}) {
  const app = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const t = useTranslations();
  const [toDate, setToDate] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("viewers");
  const prevOrgsKey = useRef<string | null>(null);
  const prevTab = useRef<number | null>(null);
  const [liveLimit, setLiveLimit] = useState(60);
  const liveSentinel = useRef<HTMLDivElement | null>(null);

  const clipLangs = app.settings.clipLangs || [];
  const viewMode = app.settings.homeViewMode || "grid";
  const scrollMode = app.settings.scrollMode;
  const prevScroll = useRef(scrollMode);
  const gs = app.currentGridSize;
  const cols = useMemo(
    () => ({ xs: 1 + gs, sm: 2 + gs, md: 3 + gs, lg: 4 + gs, xl: 5 + gs }),
    [gs],
  );
  const bp = useMemo(
    () =>
      getBreakpoint(app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440)),
    [app.windowWidth],
  );
  const includeAvatar = !((bp === "md" && gs > 1) || ((bp === "sm" || bp === "xs") && gs > 0));
  const perRow = cols[bp] || 5 + gs;
  const PAGE = perRow * 4;
  const orgsKey = JSON.stringify(app.selectedHomeOrgs || []);
  const overrideKey = JSON.stringify(orgTargetsOverride || []);
  const langsKey = JSON.stringify(clipLangs || []);
  const activeOrgs = isFavPage ? [] : app.selectedHomeOrgs || [];
  const activeOrgsKey = activeOrgs.join("\0");

  const keyFor = (tv: number, fav = isFavPage) =>
    [
      "vlx",
      fav ? "fav" : "home",
      tv,
      scrollMode ? "scroll" : "page",
      gs,
      fav ? "" : orgsKey,
      fav ? "" : overrideKey,
      toDate || "",
      langsKey,
    ].join("-");
  const cacheKey = keyFor(tab);
  const hideCollabs =
    tab !== HOME_TABS.CLIPS &&
    app.settings.hideCollabStreams &&
    (isFavPage || activeOrgs.length > 0);
  const targets = useMemo(
    () =>
      orgTargetsOverride?.length
        ? orgTargetsOverride
        : activeOrgs.length
          ? activeOrgs
          : [ALL_VTUBERS_ORG],
    [overrideKey, activeOrgsKey],
  );
  const filterOrg = isFavPage
    ? "none"
    : targets.length > 1
      ? ALL_VTUBERS_ORG
      : targets[0] || app.currentOrg.name;
  const filterConfig = useMemo(
    () => ({
      forOrg: filterOrg,
      forOrgs: isFavPage ? undefined : targets,
      hideCollabs,
      hidePlaceholder: app.settings.hidePlaceholder,
      hideMissing: app.settings.hideMissing,
      hideUpcoming: app.settings.hideUpcoming,
      hideLive: app.settings.hideLive,
    }),
    [
      filterOrg,
      isFavPage,
      targets,
      hideCollabs,
      app.settings.hidePlaceholder,
      app.settings.hideMissing,
      app.settings.hideUpcoming,
      app.settings.hideLive,
    ],
  );
  const portalTarget = useDomElement(datePortalName || `date-selector${isFavPage}`);

  const hasLiveContentOverride = liveContent !== null;
  const liveSource: any[] = hasLiveContentOverride
    ? liveContent || []
    : isFavPage
      ? app.favoritesLive
      : app.homeLive;

  // Concurrent-viewer counts (`_ccv`) are injected into the live list server-side, straight
  // from YouTube/Twitch, so the list arrives already sort-ready — just order by it.
  const live = useMemo(
    () =>
      sortBy === "viewers"
        ? [...liveSource].sort((a, b) => getLiveViewerCount(b) - getLiveViewerCount(a))
        : liveSource,
    [liveSource, sortBy],
  );
  const { livesVisible, upcoming } = useMemo(
    () => ({
      livesVisible: app.settings.hideLive ? [] : live.filter((v: any) => v.status === "live"),
      upcoming: app.settings.hideUpcoming
        ? []
        : live
            .filter((v: any) => v.status === "upcoming")
            .sort((a: any, b: any) =>
              a.available_at !== b.available_at || a.type === b.type
                ? 0
                : a.type === "placeholder"
                  ? 1
                  : -1,
            ),
    }),
    [live, app.settings.hideLive, app.settings.hideUpcoming],
  );
  const isLoading = hasLiveContentOverride
    ? false
    : isFavPage
      ? app.favoritesLoading
      : app.homeLoading;
  const hasError = hasLiveContentOverride ? false : isFavPage ? app.favoritesError : app.homeError;
  const showLoading = isLoading;
  const hasVisibleLiveUpcoming = livesVisible.length > 0 || upcoming.length > 0;

  // Only mount a capped window of live/upcoming cards, revealing more on scroll (append-only, so nothing
  // ever unmounts -> no thumbnail reload). Keeps switching tabs and resizing cheap even with 100+ streams.
  const luFirstFull = viewMode === "grid" || app.settings.hideUpcoming ? livesVisible : live;
  const luFirst = luFirstFull.slice(0, liveLimit);
  const luUpcoming =
    viewMode === "grid" ? upcoming.slice(0, Math.max(0, liveLimit - livesVisible.length)) : [];
  const luTotal = viewMode === "grid" ? livesVisible.length + upcoming.length : luFirstFull.length;

  function init(force: boolean) {
    if (isFavPage) {
      if (force) app.fetchFavorites();
      if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn)
        app.fetchFavoritesLive({ force: force || live.length === 0, minutes: 2 });
    } else if (!liveContent?.length) {
      app.fetchHomeLive({ force: live.length === 0, minutes: 2 });
    }
  }

  const buildQuery = (tv: number) => buildHomeTabQuery({ tab: tv, clipLangs, toDate });

  useEffect(() => {
    if (!isActive) {
      prevScroll.current = scrollMode;
      return;
    }
    const prev = prevScroll.current;
    prevScroll.current = scrollMode;
    if (prev === scrollMode || !scrollMode || !sp.get("page")) return;
    const params = new URLSearchParams(sp.toString());
    params.delete("page");
    const q = params.toString();
    router.replace(
      `${pathname}${q ? `?${q}` : ""}${typeof window !== "undefined" ? window.location.hash : ""}`,
    );
  }, [scrollMode, isActive, sp, pathname, router]);

  // Register this list as the poll focus: the store's central poll refreshes the complete
  // on-screen live list every 60s. Overridden lists (multiview) run their own refresh.
  useEffect(() => {
    if (!isActive || tab !== HOME_TABS.LIVE_UPCOMING || hasLiveContentOverride) return;
    app.setLivePollFocus(isFavPage ? "favorites" : "home");
    return () => app.setLivePollFocus(null);
  }, [isActive, tab, hasLiveContentOverride, isFavPage]);

  useEffect(() => {
    if (!app.hydrated) return;
    init(true);
    prevOrgsKey.current = orgsKey;
    prevTab.current = tab;
  }, [app.hydrated]);

  useEffect(() => {
    if (!app.hydrated) return;
    if (prevOrgsKey.current === null) {
      prevOrgsKey.current = orgsKey;
      return;
    }
    if (prevOrgsKey.current === orgsKey) return;
    prevOrgsKey.current = orgsKey;
    if (!isActive || isFavPage) return;
    // A changed org selection represents a new list. Leaving the viewport near the old
    // list's bottom can make the new sentinel immediately pull in several pages.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    clearHomeMultiOrgVideoCache();
    if (tab === HOME_TABS.LIVE_UPCOMING) init(false);
  }, [orgsKey, isActive, isFavPage, tab]);

  useEffect(() => {
    if (prevTab.current === null) {
      prevTab.current = tab;
      return;
    }
    const old = prevTab.current;
    prevTab.current = tab;
    if (!isActive || tab === old) return;
    if (tab === HOME_TABS.LIVE_UPCOMING) {
      init(false);
      return;
    }
    // Freshen the newly shown tab's warmed cache if it has gone stale — replaces the old
    // rolling 60s background re-fetch of every off-screen tab.
    const entry = getHomeMultiOrgVideoCache(keyFor(tab));
    if (entry?.isReady() && entry.isStale(60_000)) void entry.refresh();
  }, [tab, isActive]);

  // Reset the live/upcoming window when the list identity changes (tab/org/fav switch), then grow on scroll.
  // The initial window must extend past the observer's lookahead margin below the first viewport;
  // otherwise the sentinel is immediately "near" and the list grows in several quick steps right
  // after the switch, making the page height (and scrollbar) visibly jump.
  useEffect(() => {
    setLiveLimit(Math.max(perRow * 10, 60));
  }, [cacheKey]);
  useEffect(() => {
    if (tab !== HOME_TABS.LIVE_UPCOMING || liveLimit >= luTotal) return;
    const el = liveSentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setLiveLimit((l) => l + perRow * 8);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab, perRow, cacheKey, liveLimit, luTotal]);

  // Warm the other tabs' caches once so switching to them is instant. Each cache is then
  // freshened on activation (tab-change effect above) instead of on a rolling 60s timer,
  // and the live lists are owned by the store's central poll.
  useEffect(() => {
    if (!isActive || !app.hydrated) return;
    const jwt = app.userdata.jwt;
    const loggedInFav = !!jwt && app.isLoggedIn && app.favoriteChannelIDs.size > 0;
    const contexts = loggedInFav && !isFavPage ? [false, true] : [isFavPage];
    contexts.forEach((fav) => {
      [HOME_TABS.ARCHIVE, HOME_TABS.CLIPS].forEach((tv) => {
        if (fav === isFavPage && tv === tab) return;
        const key = keyFor(tv, fav);
        const q = buildQuery(tv);
        if (fav) ensureFavoritesVideoFetch(key, q, jwt!, tv);
        else ensureHomeMultiOrgVideoFetch(key, q, targets, tv);
      });
    });
  }, [
    isActive,
    isFavPage,
    app.hydrated,
    app.isLoggedIn,
    app.userdata.jwt,
    app.favoriteChannelIDs.size,
    tab,
    targets.join("\0"),
    scrollMode,
    gs,
    orgsKey,
    overrideKey,
    langsKey,
    toDate,
  ]);

  const toggleClipLang = (value: string, checked: boolean) => {
    const next = new Set(clipLangs);
    checked ? next.add(value) : next.delete(value);
    app.patchSettings({ clipLangs: [...next].sort() });
  };

  const displayMode = displayModeFor(viewMode, gs);

  function setDisplayMode(next: DisplayMode) {
    if (next.startsWith("grid-")) {
      const size = Number(next.slice(5)) || 0;
      if (viewMode !== "grid") app.patchSettings({ homeViewMode: "grid" });
      app.setCurrentGridSize(size);
      return;
    }
    if (viewMode !== next) app.patchSettings({ homeViewMode: next });
    app.setCurrentGridSize(0);
  }

  function getLoadFn() {
    const query: Record<string, any> = buildQuery(tab);
    query.paginated = !scrollMode;
    const readCache = (key: string) => {
      const cached = getHomeMultiOrgVideoCache(key)!;
      return async (offset: number, limit: number) => {
        await cached.page1;
        while (offset + limit > cached.getCurrentItems().length && !cached.isExhausted())
          await cached.fetchMore();
        const snap = cached.getCurrentItems();
        const slice = snap.slice(offset, offset + limit);
        if (!cached.isExhausted() && snap.length - (offset + limit) < limit * 4) cached.fetchMore();
        return scrollMode
          ? slice
          : { items: slice, total: cached.isExhausted() ? snap.length : snap.length + limit };
      };
    };
    if (isFavPage) {
      const jwt = app.userdata.jwt;
      if (!jwt) return async () => [];
      ensureFavoritesVideoFetch(cacheKey, query, jwt, tab);
      [HOME_TABS.ARCHIVE, HOME_TABS.CLIPS].forEach((otherTab) => {
        if (otherTab === tab) return;
        const key = keyFor(otherTab, true);
        if (!hasHomeMultiOrgVideoCache(key))
          ensureFavoritesVideoFetch(key, buildQuery(otherTab), jwt, otherTab);
      });
      return readCache(cacheKey);
    }
    ensureHomeMultiOrgVideoFetch(cacheKey, query, targets, tab);
    [HOME_TABS.ARCHIVE, HOME_TABS.CLIPS].forEach((otherTab) => {
      if (otherTab === tab) return;
      const key = keyFor(otherTab);
      if (!hasHomeMultiOrgVideoCache(key))
        ensureHomeMultiOrgVideoFetch(key, buildQuery(otherTab), targets, otherTab);
    });
    return readCache(cacheKey);
  }

  const loaderLoadFn = useMemo(() => getLoadFn(), [cacheKey, app.userdata.jwt]);

  const renderSkeletons = (opts: { denseList?: boolean; horizontal?: boolean } = {}) => (
    <SkeletonCardList
      cols={cols}
      dense={gs > 0}
      denseList={opts.denseList ?? viewMode === "denseList"}
      horizontal={opts.horizontal ?? viewMode === "list"}
      includeChannel
      includeAvatar={tab === HOME_TABS.LIVE_UPCOMING ? includeAvatar : false}
      hideThumbnail={app.settings.hideThumbnail}
      autoFit={attrs.autoFit}
      autoFitMin={attrs.autoFitMin}
    />
  );

  const renderList = (videos: any[], opts: { denseList?: boolean; horizontal?: boolean } = {}) => (
    <VideoCardList
      {...attrs}
      videos={videos}
      includeChannel
      includeAvatar={includeAvatar}
      cols={cols}
      dense={gs > 0}
      filterConfig={filterConfig}
      denseList={opts.denseList ?? viewMode === "denseList"}
      horizontal={opts.horizontal ?? viewMode === "list"}
      inMultiViewSelector={inMultiViewSelector}
      fadeUnderNavExt={false}
    />
  );

  const emptyMessage = <div className="m-auto p-5 text-center">{t("views.home.noStreams")}</div>;

  const controls = (
    <VideoListTopControls
      tab={tab}
      isActive={isActive}
      sortBy={sortBy}
      displayMode={displayMode}
      toDate={toDate}
      clipLangs={clipLangs}
      onSortByChange={setSortBy}
      onDisplayModeChange={setDisplayMode}
      onToDateChange={setToDate}
      onToggleClipLang={toggleClipLang}
    />
  );
  const hideFavs = isFavPage && !(app.isLoggedIn && app.favoriteChannelIDs.size > 0);

  return (
    <div className={hideFavs ? "hidden" : undefined}>
      {portalTarget ? createPortal(controls, portalTarget) : null}
      {tab === HOME_TABS.LIVE_UPCOMING ? (
        hasError ? (
          emptyMessage
        ) : (
          <>
            {showLoading && !hasVisibleLiveUpcoming
              ? renderSkeletons(
                  viewMode === "grid" ? { denseList: false, horizontal: false } : undefined,
                )
              : null}
            {hasVisibleLiveUpcoming ? (
              <>
                {renderList(luFirst)}
                {viewMode === "grid" ? (
                  <>
                    {luFirst.length > 0 && luUpcoming.length > 0 ? (
                      <Separator className="my-3" />
                    ) : null}
                    {renderList(luUpcoming, { denseList: false, horizontal: false })}
                  </>
                ) : null}
                {liveLimit < luTotal ? <div ref={liveSentinel} className="h-px w-full" /> : null}
              </>
            ) : null}
            {!showLoading && !live.some((v: any) => v.status === "live") && !upcoming.length
              ? emptyMessage
              : null}
          </>
        )
      ) : (
        <GenericListLoader
          cacheKey={cacheKey}
          getCachedPage={scrollMode ? undefined : getHomeCachedLoaderPage}
          infiniteLoad={scrollMode}
          paginate={!scrollMode}
          perPage={PAGE}
          loadFn={loaderLoadFn}
        >
          {({ data, isLoading: loading, isFetching }) => (
            <>
              {isFetching && data.length > 0 && !scrollMode ? (
                <div className="pointer-events-none relative">
                  <div className="absolute inset-0 z-10 flex min-h-32 items-center justify-center rounded-2xl bg-background/70 backdrop-blur-sm">
                    <Spinner className="size-6 text-primary" />
                  </div>
                </div>
              ) : null}
              <div className={scrollMode || data.length > 0 || !loading ? undefined : "hidden"}>
                {renderList(data)}
              </div>
              {loading && !data.length ? renderSkeletons() : null}
              {!loading && !data.length ? emptyMessage : null}
            </>
          )}
        </GenericListLoader>
      )}
    </div>
  );
}
