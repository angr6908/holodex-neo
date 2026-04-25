"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { json2csv } from "json-2-csv";
import {
  mdiCheck,
  mdiClose,
  mdiContentSave,
  mdiDelete,
  mdiFileDelimited,
  mdiMagnify,
  mdiPencil,
  mdiPlaylistPlus,
  mdiRefresh,
  mdiViewDashboard,
} from "@mdi/js";
import { PlaylistSvgIcon } from "@/components/nav/NavSvgIcons";
import { Logo } from "@/components/common/Logo";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { NavSettingsMenu } from "@/components/nav/NavSettingsMenu";
import { NavUserMenu } from "@/components/nav/NavUserMenu";
import { useI18n } from "@/lib/i18n";
import { useAppState } from "@/lib/store";
import { api } from "@/lib/api";
import { MAX_PLAYLIST_LENGTH, musicdexURL } from "@/lib/consts";
import { getVideoThumbnails } from "@/lib/functions";
import { localizedDayjs } from "@/lib/time";
import { cn } from "@/lib/cn";
import { POPOVER_MOTION_CLASS, useAnimatedPresence } from "@/lib/useAnimatedPresence";
import * as icons from "@/lib/icons";
import { openUserMenu } from "@/lib/navigation-events";

export function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const app = useAppState();
  const navRoot = useRef<HTMLDivElement>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<any[]>([]);
  const [searchFilters, setSearchFilters] = useState<any[]>([]);
  const playlistRoot = useRef<HTMLDivElement | null>(null);
  const desktopSearchInput = useRef<HTMLInputElement | null>(null);

  const showTopBar =
    !pathname.startsWith("/multiview") &&
    !pathname.startsWith("/tlclient") &&
    !pathname.startsWith("/scripteditor");
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
    setAutocompleteOpen(false);
    setAutocompleteResults([]);
  }, [pathname, searchParams]);
  useEffect(() => {
    if (!app.orgs.length) app.fetchOrgs();
    app.loginCheck();
  }, []);

  useEffect(() => {
    if (!playlistOpen) return;
    function onDocumentMouseDown(event: MouseEvent) {
      if (playlistRoot.current?.contains(event.target as Node)) return;
      setPlaylistOpen(false);
    }
    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setPlaylistOpen(false);
    }
    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [playlistOpen]);

  useEffect(() => {
    const val = searchText.trim();
    if (val.length < 2) {
      setAutocompleteResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res: any = await api.searchAutocomplete(val);
        const items = (res.data || [])
          .map((x: any) => ({ ...x, text: x.text || x.value }))
          .filter((x: any) => ["channel", "org", "topic"].includes(x.type))
          .slice(0, 8);
        setAutocompleteResults(items);
        if (items.length) setAutocompleteOpen(true);
      } catch {
        setAutocompleteResults([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [searchText]);

  async function submitSearch(
    redirectIfEmpty = false,
    queryOverride?: string,
    filtersOverride = searchFilters,
  ) {
    const query = (queryOverride ?? searchText).trim();
    const hasFilters = filtersOverride.length > 0;
    if (!query && !hasFilters) {
      if (!redirectIfEmpty) return;
      if (pathname !== "/search" || searchParams.toString())
        router.push("/search");
      setMobileSearchOpen(false);
      return;
    }
    const payload = filtersOverride.map((f) => ({
      type: f.type,
      value: f.value,
      text: f.text || f.value,
    }));
    if (query)
      payload.push({
        type: "title & desc",
        value: `${query}title & desc`,
        text: query,
      });
    const q = await json2csv(payload);
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", q);
    if (pathname === "/search" && searchParams.get("q") === q) {
      setMobileSearchOpen(false);
      return;
    }
    router.push(`/search?${params.toString()}`);
    setSearchText("");
    setSearchFilters([]);
    setMobileSearchOpen(false);
  }

  function selectAutocomplete(item: any) {
    setAutocompleteOpen(false);
    setAutocompleteResults([]);
    if (["channel", "topic", "org"].includes(item.type)) {
      setSearchFilters((filters) =>
        filters.some((f) => f.type === item.type && f.value === item.value)
          ? filters
          : [
              ...filters,
              { type: item.type, value: item.value, text: item.text },
            ],
      );
      setSearchText("");
      setTimeout(() => desktopSearchInput.current?.focus(), 0);
    } else {
      const nextText = item.text || item.value;
      setSearchText(nextText);
      void submitSearch(false, nextText);
    }
  }

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
  const reserveHomeMobileTabs =
    pathname === "/";
  const searchBox = (
    <form
      className="menu-search-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submitSearch();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <div className="menu-search-tags-wrap">
          {searchFilters.map((f, fi) => (
            <span
              key={`${f.type}-${f.value}`}
              className={`menu-search-filter-tag menu-search-filter-tag--${f.type}`}
            >
              <SearchTypeIcon
                type={f.type}
                className="menu-search-filter-tag-icon fill-current"
              />
              <span className="menu-search-filter-tag-text">
                {f.text || f.value}
              </span>
              <button
                type="button"
                className="menu-search-filter-tag-remove"
                onClick={() =>
                  setSearchFilters((filters) =>
                    filters.filter((_, i) => i !== fi),
                  )
                }
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={desktopSearchInput}
            className="menu-search-tags-input"
            value={searchText}
            placeholder={
              searchFilters.length ? "" : "Search streams, clips, channels"
            }
            autoComplete="off"
            onChange={(e) => setSearchText(e.target.value)}
            onFocus={() => setAutocompleteOpen(true)}
            onBlur={() => setTimeout(() => setAutocompleteOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !searchText && searchFilters.length)
                setSearchFilters((f) => f.slice(0, -1));
            }}
          />
        </div>
        <button
          type="button"
          className="menu-search-inline-btn"
          onClick={() => void submitSearch(true)}
        >
          <Icon icon={mdiMagnify} className="menu-theme-icon h-4 w-4" />
          <span className="sr-only">Search</span>
        </button>
        {autocompleteOpen && autocompleteResults.length ? (
          <div className="menu-autocomplete-dropdown">
            {autocompleteResults.map((item) => (
              <button
                key={`${item.type}-${item.value}`}
                type="button"
                className="menu-autocomplete-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectAutocomplete(item);
                }}
              >
                <SearchTypeIcon
                  type={item.type}
                  className="menu-autocomplete-icon fill-current"
                />
                <span className="menu-autocomplete-text">
                  {item.text || item.value}
                </span>
                <span className="menu-autocomplete-type">
                  {item.type === "org" ? "group" : item.type}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </form>
  );

  return (
    <div ref={navRoot} className="fixed inset-x-0 top-0 z-[90]">
      <header className="relative z-[130] border-b border-[color:var(--color-border)] bg-[color:var(--surface-nav)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-3 py-3 sm:px-5">
          <a
            href="/"
            className="flex shrink-0 items-center gap-3 pr-2 text-left no-underline select-none min-[960px]:pr-5"
            onClick={goHomeFromLogo}
          >
            <div className="menu-logo-tile flex h-10 w-10 items-center justify-center rounded-2xl border">
              <Logo width="22" height="22" />
            </div>
            <div className="hidden min-w-0 text-[1.02rem] font-semibold tracking-[0.01em] text-[color:var(--color-foreground)] sm:block">
              Holodex
            </div>
          </a>
          <div className="hidden min-[960px]:ml-1 min-[960px]:flex min-[960px]:items-center min-[960px]:gap-3" />
          <div className="hidden min-w-0 flex-1 items-center gap-3 min-[960px]:flex">
            <HomeOrgMultiSelect
              inline
              buttonClass="h-10 w-auto min-w-0 max-w-[min(36vw,24rem)] shrink justify-between rounded-xl px-3 text-[0.8rem] font-normal"
            />
            {searchBox}
            <div className="flex items-center gap-2">
              <Button
                as="a"
                variant="ghost"
                size="icon"
                className="menu-action-btn"
                href={musicdexURL}
                target="_blank"
                rel="noopener noreferrer"
                title="Musicdex"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <defs>
                    <linearGradient
                      id="musicdex-nav-gradient"
                      x1="3"
                      y1="2"
                      x2="21"
                      y2="20"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#5DA2F2" />
                      <stop offset="0.55" stopColor="#F06292" />
                      <stop offset="1" stopColor="#FF3A81" />
                    </linearGradient>
                  </defs>
                  <path
                    fill="url(#musicdex-nav-gradient)"
                    d="M12 3V13.55A4 4 0 1 0 14 17V7H19V3H12Z"
                  />
                </svg>
                <span className="sr-only">Musicdex</span>
              </Button>
              <Button
                as={Link}
                href="/multiview"
                variant="ghost"
                size="icon"
                className="menu-action-btn"
                title={t("component.mainNav.multiview")}
              >
                <Icon
                  icon={mdiViewDashboard}
                  className="menu-theme-icon h-5 w-5"
                />
              </Button>
              <div ref={playlistRoot} className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="group relative menu-action-btn"
                  title={t("component.mainNav.playlist")}
                  onClick={() => setPlaylistOpen((v) => !v)}
                >
                  <PlaylistSvgIcon className="menu-theme-icon h-5 w-5" aria-hidden="true" />
                  {playlistCount ? (
                    <Badge className="playlist-count-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center px-1.5 text-[10px] leading-none tracking-normal">
                      {playlistCount}
                    </Badge>
                  ) : null}
                </Button>
                <PlaylistPanel
                  open={playlistOpen}
                  onOpenChange={setPlaylistOpen}
                />
              </div>
              <NavSettingsMenu />
              <NavUserMenu />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1 min-[960px]:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="menu-action-btn"
              onClick={() => setMobileSearchOpen((v) => !v)}
            >
              <span className="sr-only">Toggle search</span>
              <svg viewBox="0 0 24 24" className="menu-theme-icon h-4 w-4 fill-current">
                <path d="M10 2a8 8 0 1 0 5.293 14.01l4.349 4.348 1.414-1.414-4.348-4.349A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
              </svg>
            </Button>
            <Button
              as={Link}
              href="/multiview"
              variant="ghost"
              size="icon"
              className="menu-action-btn"
              title={t("component.mainNav.multiview")}
            >
              <Icon
                icon={mdiViewDashboard}
                className="menu-theme-icon h-4 w-4"
              />
            </Button>
            <Button
              as="a"
              href={musicdexURL}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              size="icon"
              className="menu-action-btn"
              title="Musicdex"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <defs>
                  <linearGradient
                    id="musicdex-mobile-gradient"
                    x1="3"
                    y1="2"
                    x2="21"
                    y2="20"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#5DA2F2" />
                    <stop offset="0.55" stopColor="#F06292" />
                    <stop offset="1" stopColor="#FF3A81" />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#musicdex-mobile-gradient)"
                  d="M12 3V13.55A4 4 0 1 0 14 17V7H19V3H12Z"
                />
              </svg>
              <span className="sr-only">Musicdex</span>
            </Button>
          </div>
        </div>
        {mobileSearchOpen ? (
          <div className="border-t border-[color:var(--color-border)] px-3 pb-3 min-[960px]:hidden">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submitSearch();
              }}
            >
              <div className="relative flex-1">
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search streams, clips, channels"
                  className="h-10 flex-1 border-[color:var(--color-light)] bg-[color:var(--color-card)] pr-10"
                />
                <button
                  type="button"
                  className="menu-search-inline-btn"
                  onClick={() => void submitSearch(true)}
                >
                  <Icon icon={mdiMagnify} className="menu-theme-icon h-4 w-4" />
                  <span className="sr-only">Search</span>
                </button>
              </div>
            </form>
            <div className="mt-2">
              <HomeOrgMultiSelect buttonClass="h-10 w-full justify-between rounded-xl px-3 text-[0.8rem] font-normal" />
            </div>
          </div>
        ) : null}
      </header>
      {!pathname.startsWith("/watch") && !pathname.startsWith("/edit/video") && !pathname.startsWith("/search") ? (
        <div
          className={cn(
            "main-nav-ext pointer-events-none relative z-[90] px-3 py-2 sm:px-5",
            reserveHomeMobileTabs && "main-nav-ext--home-tabs",
          )}
        >
          <div className="pointer-events-auto mx-auto max-w-[1600px]">
            <div id="mainNavExt" className="contents" />
          </div>
        </div>
      ) : null}
      {!pathname.startsWith("/watch") && !pathname.startsWith("/edit/video") ? (
        <nav className="fixed inset-x-3 bottom-3 z-40 min-[960px]:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-2">
            <Link
              href="/"
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-[color:var(--color-muted-foreground)] transition",
                pathname === "/" &&
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

function SearchTypeIcon({
  type,
  className,
}: {
  type?: string;
  className?: string;
}) {
  if (type === "channel")
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
      </svg>
    );
  if (type === "topic")
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <path d="M5.41 21L6.12 17H2.12L2.47 15H6.47L7.53 9H3.53L3.88 7H7.88L8.59 3H10.59L9.88 7H15.88L16.59 3H18.59L17.88 7H21.88L21.53 9H17.53L16.47 15H20.47L20.12 17H16.12L15.41 21H13.41L14.12 17H8.12L7.41 21H5.41M9.53 9L8.47 15H14.47L15.53 9H9.53Z" />
      </svg>
    );
  if (type === "org")
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <path d="M18 15H16V17H18M18 11H16V13H18M20 19H12V17H14V15H12V13H14V11H12V9H20M10 7H8V5H10M10 11H8V9H10M10 15H8V13H10M10 19H8V17H10M6 7H4V5H6M6 11H4V9H6M6 15H4V13H6M6 19H4V17H6M12 7V3H2V21H22V7H12Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27H15l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z" />
    </svg>
  );
}

function PlaylistPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const app = useAppState();
  const { t } = useI18n();
  const router = useRouter();
  const [playlistEditName, setPlaylistEditName] = useState(false);
  const [playlistLoginWarning, setPlaylistLoginWarning] = useState(false);
  const [playlistYTDialog, setPlaylistYTDialog] = useState(false);
  const [serverPlaylists, setServerPlaylists] = useState<any[]>([]);
  const [serverPlaylistsLoading, setServerPlaylistsLoading] = useState(false);
  const [nameInput, setNameInput] = useState(
    app.playlistActive?.name || "Unnamed Playlist",
  );
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"above" | "below">(
    "below",
  );
  const panelPresence = useAnimatedPresence(open, 180);
  const playlistCount = app.playlist.length;

  useEffect(() => {
    setNameInput(app.playlistActive?.name || "Unnamed Playlist");
  }, [app.playlistActive?.name]);
  useEffect(() => {
    if (!open) return;
    setPlaylistEditName(false);
    setPlaylistLoginWarning(false);
    void fetchServerPlaylists();
  }, [open]);
  useEffect(() => {
    if (open && app.playlistIsSaved) void fetchServerPlaylists();
  }, [app.playlistIsSaved, open]);

  async function fetchServerPlaylists() {
    if (!app.userdata?.jwt || serverPlaylistsLoading) return;
    setServerPlaylistsLoading(true);
    try {
      const { data } = await api.getPlaylistList(app.userdata.jwt);
      setServerPlaylists(data || []);
    } catch {
      setServerPlaylists([]);
    } finally {
      setServerPlaylistsLoading(false);
    }
  }
  function commitName(value = nameInput) {
    if (value && value.length > 0) app.setPlaylistName(value);
    setPlaylistEditName(false);
  }
  async function saveActivePlaylist() {
    if (!app.userdata?.jwt) {
      setPlaylistLoginWarning(true);
      return;
    }
    setPlaylistLoginWarning(false);
    await app.saveActivePlaylist();
    await fetchServerPlaylists();
  }
  function createNewPlaylist() {
    if (!app.userdata?.jwt) {
      openUserMenu();
      onOpenChange(false);
      return;
    }
    if (
      app.playlistIsSaved ||
      confirm(t("views.playlist.change-loss-warning"))
    ) {
      app.resetPlaylist();
      app.markPlaylistModified();
    }
  }
  async function switchPlaylist(playlist: any) {
    if (playlist.id === app.playlistActive?.id) return;
    if (
      app.playlistIsSaved ||
      confirm(t("views.playlist.change-loss-warning"))
    ) {
      await app.setActivePlaylistByID(playlist.id);
      await fetchServerPlaylists();
    }
  }
  async function deleteActivePlaylist() {
    await app.deleteActivePlaylist();
    await fetchServerPlaylists();
  }
  async function downloadPlaylistCSV() {
    if (!app.playlist.length) return;
    const csvString = await json2csv(app.playlist as any[]);
    const a = document.createElement("a");
    const timestamp = new Date().toISOString().replace("T", "_").slice(0, 19);
    a.href = `data:attachment/csv,${encodeURIComponent(csvString)}`;
    a.target = "_blank";
    a.download = `holodexPlaylist_${app.playlistActive?.name || "playlist"}_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function exportPlaylistToYT() {
    if (!app.playlist.length) return;
    window.open(
      `https://www.youtube.com/watch_videos?video_ids=${app.playlist.map((x: any) => x.id).join(",")}`,
      "_blank",
      "noopener",
    );
    setPlaylistYTDialog(false);
  }
  function formatPlaylistTime(ts: string) {
    try {
      return localizedDayjs(ts, app.settings.lang).format("l");
    } catch {
      return "";
    }
  }
  function handlePointerDown(idx: number, e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;

    const startY = e.clientY;
    const container = (e.currentTarget as HTMLElement).parentElement;
    if (!container) return;
    const getItems = () =>
      Array.from(container.querySelectorAll<HTMLElement>("[data-drag-item]"));
    let isDragging = false;
    const threshold = 6;
    const prevUserSelect = document.body.style.userSelect;
    let fromIdx: number | null = null;
    let overIdx: number | null = null;
    let overPosition: "above" | "below" = "below";

    const onPointerMove = (moveE: PointerEvent) => {
      if (!isDragging) {
        if (Math.abs(moveE.clientY - startY) < threshold) return;
        isDragging = true;
        fromIdx = idx;
        setDragFromIdx(idx);
        document.body.style.userSelect = "none";
      }
      moveE.preventDefault();
      const items = getItems();
      let found = false;
      for (let i = 0; i < items.length; i += 1) {
        const rect = items[i].getBoundingClientRect();
        if (moveE.clientY >= rect.top && moveE.clientY <= rect.bottom) {
          if (i === fromIdx) {
            overIdx = null;
            setDragOverIdx(null);
          } else {
            overIdx = i;
            overPosition =
              moveE.clientY < rect.top + rect.height / 2 ? "above" : "below";
            setDragOverIdx(i);
            setDragOverPosition(overPosition);
          }
          found = true;
          break;
        }
      }
      if (!found && items.length > 0) {
        const firstRect = items[0].getBoundingClientRect();
        const lastRect = items[items.length - 1].getBoundingClientRect();
        if (moveE.clientY < firstRect.top + firstRect.height / 2) {
          overIdx = 0;
          overPosition = "above";
          setDragOverIdx(0);
          setDragOverPosition("above");
        } else if (moveE.clientY > lastRect.top + lastRect.height / 2) {
          overIdx = items.length - 1;
          overPosition = "below";
          setDragOverIdx(items.length - 1);
          setDragOverPosition("below");
        }
      }
    };

    const onPointerUp = () => {
      if (isDragging && fromIdx !== null && overIdx !== null) {
        const from = fromIdx;
        let to: number;
        if (overPosition === "above") {
          to = from > overIdx ? overIdx : overIdx - 1;
        } else {
          to = from > overIdx ? overIdx + 1 : overIdx;
        }
        if (to >= 0 && to < app.playlist.length && to !== from) {
          app.reorderPlaylist({ from, to });
        }
      }
      if (isDragging) {
        document.addEventListener(
          "click",
          (ce) => {
            ce.stopPropagation();
            ce.preventDefault();
          },
          { capture: true, once: true },
        );
        document.body.style.userSelect = prevUserSelect;
      }
      setDragFromIdx(null);
      setDragOverIdx(null);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  return (
    <>
      {panelPresence.present ? (
        <div
          data-state={panelPresence.state}
          data-side="bottom"
          className={cn(
            "popover-content absolute right-0 top-[calc(100%+0.5rem)] z-[160] flex max-h-[min(80vh,640px)] w-[24rem] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav-solid)] p-0 shadow-2xl",
            POPOVER_MOTION_CLASS,
            panelPresence.state === "closed" && "pointer-events-none",
          )}
          onAnimationEnd={panelPresence.onAnimationEnd}
          onPointerDown={(event) => {
            if (
              playlistEditName &&
              !(event.target as HTMLElement).closest("input")
            )
              commitName();
          }}
        >
          <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] px-3 py-2.5">
            <div className="flex min-w-0 shrink flex-col gap-1.5">
              {playlistEditName ? (
                <Input
                  value={nameInput}
                  autoFocus
                  className="h-7 max-w-[10rem] rounded-md border-[color:var(--color-border)] bg-[color:var(--surface-soft)] px-1 py-0 text-sm font-semibold focus:shadow-[none]"
                  onChange={(event) => setNameInput(event.target.value)}
                  onBlur={() => commitName()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Escape")
                      (event.target as HTMLElement).blur();
                  }}
                />
              ) : (
                <button
                  type="button"
                  tabIndex={-1}
                  className="group/name inline-flex h-7 items-center gap-1 rounded-md px-1 text-left outline-none transition-colors hover:bg-[color:var(--surface-soft)]"
                  title={t("component.playlist.menu.rename-playlist")}
                  onClick={() => setPlaylistEditName(true)}
                >
                  <span className="max-w-[10rem] truncate text-sm font-semibold text-[color:var(--color-foreground)]">
                    {app.playlistActive?.name || "Unnamed Playlist"}
                  </span>
                  <Icon
                    icon={mdiPencil}
                    className="h-3 w-3 shrink-0 text-[color:var(--color-muted-foreground)] opacity-0 transition-opacity group-hover/name:opacity-100"
                  />
                </button>
              )}
              <div className="flex items-center gap-1.5 px-1 text-xs leading-none text-[color:var(--color-muted-foreground)]">
                {!app.playlistIsSaved ? (
                  <Badge className="inline-flex items-center rounded-full border-amber-400/30 bg-amber-400/15 px-1.5 py-0.5 text-[10px] leading-none text-amber-200">
                    unsaved
                  </Badge>
                ) : null}
                <span className="leading-none">
                  {playlistCount}/{MAX_PLAYLIST_LENGTH}
                </span>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {!app.playlistIsSaved ? (
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-500"
                  title="Save"
                  onClick={saveActivePlaylist}
                >
                  <Icon icon={mdiContentSave} className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)]"
                title={t("component.playlist.menu.new-playlist")}
                onClick={createNewPlaylist}
              >
                <Icon icon={mdiPlaylistPlus} className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={app.playlistIsSaved || !app.playlistActive?.id}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
                title={t("component.playlist.menu.reset-unsaved")}
                onClick={() =>
                  app.playlistActive?.id &&
                  app.setActivePlaylistByID(app.playlistActive.id)
                }
              >
                <Icon icon={mdiRefresh} className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!playlistCount}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
                title={t("views.library.exportYtPlaylist")}
                onClick={() => {
                  setPlaylistYTDialog(true);
                  onOpenChange(false);
                }}
              >
                <Icon icon={icons.mdiYoutube} className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!playlistCount}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
                title={t("views.library.exportCsv")}
                onClick={() => void downloadPlaylistCSV()}
              >
                <Icon icon={mdiFileDelimited} className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                title={
                  app.playlistActive?.id
                    ? t("component.playlist.menu.delete-playlist")
                    : t("component.playlist.menu.clear-playlist")
                }
                onClick={() => void deleteActivePlaylist()}
              >
                <Icon icon={mdiDelete} className="h-4 w-4" />
              </button>
            </div>
          </div>
          {playlistLoginWarning ? (
            <div className="mx-3 mt-2 flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <span className="flex-1">
                {t("component.playlist.save-error-not-logged-in")}
              </span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  openUserMenu();
                  setPlaylistLoginWarning(false);
                  onOpenChange(false);
                }}
              >
                {t("component.mainNav.login")}
              </Button>
            </div>
          ) : null}
          {playlistCount ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-0.5 p-1.5">
                {app.playlist.map((video: any, idx: number) => (
                  <div
                    key={`${video.id || "video"}-${idx}`}
                    data-drag-item
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md p-1.5 transition-colors select-none hover:bg-[color:var(--surface-soft)]",
                      dragFromIdx === idx && "opacity-30",
                      dragFromIdx !== null ? "cursor-grabbing" : "cursor-grab",
                    )}
                    onPointerDown={(event) => handlePointerDown(idx, event)}
                    onDragStart={(event) => event.preventDefault()}
                  >
                    {dragOverIdx === idx &&
                    dragFromIdx !== null &&
                    dragFromIdx !== idx ? (
                      <div
                        className={cn(
                          "pointer-events-none absolute left-2 right-2 h-0.5 rounded-full bg-[color:var(--color-primary)]",
                          dragOverPosition === "above"
                            ? "-top-px"
                            : "-bottom-px",
                        )}
                      />
                    ) : null}
                    <Link
                      href={`/watch/${video.id}?playlist=${app.playlistActive?.id || "local"}`}
                      className="relative shrink-0 overflow-hidden rounded-md"
                      onClick={() => onOpenChange(false)}
                    >
                      <img
                        src={getVideoThumbnails(video.id, false).default}
                        alt={video.title || video.id}
                        className="h-[3.2rem] w-[5.7rem] object-cover"
                        loading="lazy"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/watch/${video.id}?playlist=${app.playlistActive?.id || "local"}`}
                        className="line-clamp-2 text-xs font-medium leading-snug text-[color:var(--color-foreground)] hover:underline"
                        onClick={() => onOpenChange(false)}
                      >
                        {video.title || video.id}
                      </Link>
                      {video.channel?.name ? (
                        <span className="mt-0.5 block truncate text-[11px] text-[color:var(--color-muted-foreground)]">
                          {video.channel.english_name || video.channel.name}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-md text-[color:var(--color-muted-foreground)] opacity-0 transition hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
                      title={t("component.videoCard.removeFromPlaylist")}
                      onClick={(event) => {
                        event.stopPropagation();
                        app.removeFromPlaylistByIndex(idx);
                      }}
                    >
                      <Icon icon={mdiClose} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-3 py-8 text-center text-xs text-[color:var(--color-muted-foreground)]">
              {t("views.playlist.page-instruction")}
            </div>
          )}
          {serverPlaylists.length > 0 ? (
            <>
              <div className="border-t border-[color:var(--color-border)] px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
                {t("views.playlist.page-heading")}
              </div>
              <div className="max-h-[160px] overflow-y-auto">
                <div className="px-1 pb-1">
                  {serverPlaylists.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-[color:var(--surface-soft)]",
                        pl.id === app.playlistActive?.id
                          ? "text-[color:var(--color-primary)] font-medium"
                          : "text-[color:var(--color-foreground)]",
                      )}
                      onClick={() => void switchPlaylist(pl)}
                    >
                      {pl.id === app.playlistActive?.id ? (
                        <Icon
                          icon={mdiCheck}
                          size="sm"
                          className="h-4 w-4 shrink-0"
                        />
                      ) : (
                        <span className="h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px]">
                            {pl.name}
                          </span>
                          {pl.id === app.playlistActive?.id &&
                          !app.playlistIsSaved ? (
                            <Badge className="shrink-0 rounded-full border-amber-400/30 bg-amber-400/15 px-1.5 py-px text-[9px] text-amber-200">
                              {t("views.playlist.playlist-is-modified")}
                            </Badge>
                          ) : null}
                        </div>
                        <span className="block text-[10px] text-[color:var(--color-muted-foreground)]">
                          {(pl.video_ids || pl.videos || []).length} videos
                          {pl.updated_at
                            ? ` · ${formatPlaylistTime(pl.updated_at)}`
                            : ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      <Dialog
        open={playlistYTDialog}
        className="max-w-[90%] md:max-w-[60vw]"
        onOpenChange={setPlaylistYTDialog}
      >
        <Card className="p-5">
          <div className="text-lg font-semibold text-[color:var(--color-foreground)]">
            {t("views.library.exportYTHeading")}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="text-sm text-[color:var(--color-muted-foreground)]">
              <p
                dangerouslySetInnerHTML={{
                  __html: t("views.library.exportYTExplanation"),
                }}
              />
              <br />
              <p
                dangerouslySetInnerHTML={{
                  __html: t("views.library.exportYTInstructions"),
                }}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:brightness-110"
                  onClick={exportPlaylistToYT}
                >
                  {t("views.library.createYtPlaylistButton", [playlistCount])}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPlaylistYTDialog(false)}
                >
                  {t("views.library.deleteConfirmationCancel")}
                </Button>
              </div>
            </div>
            <img
              src="/img/playlist-instruction.jpg"
              alt="Playlist export instructions"
              className="max-w-full rounded-xl"
            />
          </div>
        </Card>
      </Dialog>
    </>
  );
}
