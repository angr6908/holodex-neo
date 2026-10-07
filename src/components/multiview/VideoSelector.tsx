"use client";

import { Check, ChevronLeft, CircleUser, Heart, Link, ListPlus, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import { ConnectedVideoList } from "@/components/video/ConnectedVideoList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VideoCardList } from "@/components/video/VideoCardList";
import { api } from "@/lib/api";
import { openUserMenu, readJSON, writeJSON } from "@/lib/browser";
import { ALL_VTUBERS_ORG, DEFAULT_ORG, TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";
import { makeVideoFilter } from "@/lib/filter-videos";
import { formatOrgDisplayName, getVideoIDFromUrl, videoTemporalComparator } from "@/lib/functions";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import { useAppState } from "@/lib/store";
import { dayjs, formatDurationShort } from "@/lib/time";
import { cn } from "@/lib/utils";

function submitVideoUrl(url: string, store: any, onSuccess?: (content: any) => void) {
  const content = getVideoIDFromUrl(url) as any;
  if (!content?.id) return false;
  store?.addUrlHistory({ twitch: content.type === "twitch", url });
  onSuccess?.(content);
  return true;
}

function MvUrlInput({
  className = "",
  onSuccess,
}: {
  className?: string;
  onSuccess?: (content: any) => void;
}) {
  const t = useTranslations();
  const store = useOptionalMultiviewStore();
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [expanded]);
  const collapse = () => {
    setExpanded(false);
    setUrl("");
    setHasError(false);
  };
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!submitVideoUrl(url, store, onSuccess)) {
      setHasError(true);
      return;
    }
    collapse();
  }
  return (
    <div
      className={`flex min-w-8 items-center gap-1 has-[form]:min-w-0 has-[form]:max-w-[280px] ${className}`}
    >
      {!expanded ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={t("views.multiview.video.addUrl")}
          onClick={() => setExpanded(true)}
        >
          <Link />
        </Button>
      ) : (
        <form
          className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-150"
          onSubmit={handleSubmit}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t("component.common.collapse")}
            onClick={collapse}
          >
            <ChevronLeft />
          </Button>
          <ButtonGroup className="h-8 min-w-0 flex-1">
            <Input
              ref={inputRef as any}
              value={url}
              type="text"
              placeholder={t("views.multiview.video.urlPlaceholder")}
              className="text-sm"
              aria-invalid={hasError}
              onChange={(event) => {
                setUrl(event.target.value);
                setHasError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") collapse();
              }}
            />
            {url ? (
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                title={t("component.common.confirm")}
              >
                <Check />
              </Button>
            ) : null}
          </ButtonGroup>
        </form>
      )}
    </div>
  );
}

function CustomUrlField({
  twitch = false,
  onSuccess,
}: {
  twitch?: boolean;
  onSuccess?: (content: any) => void;
}) {
  const t = useTranslations();
  const store = useOptionalMultiviewStore();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const localKey = twitch
    ? "holodex-v2-multiview-tw-url-history"
    : "holodex-v2-multiview-yt-url-history";
  const [localHistory, setLocalHistory] = useState<string[]>([]);
  const label = twitch
    ? t("views.multiview.video.twitchChannelLink")
    : t("views.multiview.video.youtubeVideoLink");
  const history = useMemo(
    () =>
      [...(store ? (twitch ? store.twUrlHistory : store.ytUrlHistory) : localHistory)].reverse(),
    [store, twitch, localHistory],
  );
  useEffect(() => {
    if (!store) setLocalHistory(readJSON(localKey, [] as string[]));
  }, [store, localKey]);
  function addHistory(value: string) {
    if (store) {
      store.addUrlHistory({ twitch, url: value });
      return;
    }
    setLocalHistory((prev) => {
      const next = prev.filter((item) => item !== value);
      next.push(value);
      while (next.length > 8) next.shift();
      writeJSON(localKey, next);
      return next;
    });
  }
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const content = getVideoIDFromUrl(url) as any;
    if (!content?.id) {
      setError(true);
      return;
    }
    setError(false);
    onSuccess?.(content);
    if (!history.includes(url)) addHistory(url);
    setUrl("");
  }
  return (
    <form className="flex w-full items-center gap-2 px-3" onSubmit={handleSubmit}>
      <Combobox
        items={history}
        value={history.includes(url) ? url : null}
        inputValue={url}
        onInputValueChange={(value) => {
          setUrl(value);
          if (error) setError(false);
        }}
        onValueChange={(value) => {
          setUrl(value || "");
          if (error) setError(false);
        }}
      >
        <ComboboxInput placeholder={label} aria-invalid={error} showClear={!!url} />
        <ComboboxContent>
          <ComboboxEmpty>{t("views.multiview.video.noHistory")}</ComboboxEmpty>
          <ComboboxList>
            {(item: string, index: number) => (
              <ComboboxItem key={item} value={item} index={index}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={t("views.multiview.video.addUrlShort")}
      >
        <Check />
      </Button>
    </form>
  );
}

function makeMultiOrgLabel(names: string[], selectedCountLabel: (count: number) => string) {
  if (!names?.length) return DEFAULT_ORG;
  if (names.length === 1) return formatOrgDisplayName(names[0]);
  const tail =
    names.length === 2 ? formatOrgDisplayName(names[1]) : selectedCountLabel(names.length - 1);
  return `${formatOrgDisplayName(names[0])} + ${tail}`;
}

const NO_ORGS: string[] = [];

function isUrlSelection(panel: any) {
  return ["YouTubeURL", "TwitchURL"].includes(panel?.name);
}

function isRealOrgSelection(panel: any) {
  return (
    !!panel?.name &&
    !["Favorites", "Playlist", "YouTubeURL", "TwitchURL", "MultiOrg", ALL_VTUBERS_ORG].includes(
      panel.name,
    )
  );
}

function orgNamesForSelection(panel: any, selectedHomeOrgs: string[], currentOrgName?: string) {
  if (panel?.name === ALL_VTUBERS_ORG) return [];
  if (panel?.name === "MultiOrg")
    return panel.orgNames?.length
      ? panel.orgNames
      : selectedHomeOrgs.length
        ? selectedHomeOrgs
        : [currentOrgName || DEFAULT_ORG];
  if (isRealOrgSelection(panel)) return [panel.name];
  return [];
}

function makeMultiOrgTab(names: string[], selectedCountLabel: (count: number) => string) {
  return {
    name: "MultiOrg",
    text: makeMultiOrgLabel(names, selectedCountLabel),
    orgNames: [...names],
  };
}

// The tab that reflects the home org selection, or `current` when it already does.
function syncWithHomeOrgs(
  current: any,
  homeOrgs: string[],
  orgs: any[],
  selectedCountLabel: (count: number) => string,
  allVtubersTab: any,
) {
  if (homeOrgs.length > 1) {
    return current?.name !== "MultiOrg" ||
      current.text !== makeMultiOrgLabel(homeOrgs, selectedCountLabel)
      ? makeMultiOrgTab(homeOrgs, selectedCountLabel)
      : current;
  }
  if (homeOrgs.length === 0) return current?.name !== ALL_VTUBERS_ORG ? allVtubersTab : current;
  if (current?.name !== "MultiOrg") return current;
  const selectedName = homeOrgs[0];
  return selectedName
    ? orgs.find((o: any) => o.name === selectedName) || {
        name: selectedName,
        short: selectedName.slice(0, 4),
      }
    : orgs.find((o: any) => o.name === DEFAULT_ORG) || { name: DEFAULT_ORG, short: "Holo" };
}

type OrgTab = { name: string; text?: string; short?: string; orgNames?: string[] };

// The tab reflecting the home org selection: several orgs as a MultiOrg tab, one org as itself,
// none as All Vtubers. `fallbackOrg` stands in for a single org missing from the org list.
function homeOrgTab(
  selectedHomeOrgs: string[],
  orgs: any[],
  fallbackOrg: (name: string) => any,
  selectedCountLabel: (count: number) => string,
  allVtubersTab: OrgTab,
) {
  if (selectedHomeOrgs.length > 1) return makeMultiOrgTab(selectedHomeOrgs, selectedCountLabel);
  const selectedName = selectedHomeOrgs[0];
  if (selectedName)
    return (
      orgs.find((org: any) => org.name === selectedName) ||
      fallbackOrg(selectedName) || { name: selectedName, short: selectedName.slice(0, 4) }
    );
  return allVtubersTab;
}

// Applying the org picker: no orgs is All Vtubers, several a MultiOrg tab, one that org (or the
// default org when it is unknown).
function orgPickerSelection(
  names: string[],
  orgs: any[],
  selectedCountLabel: (count: number) => string,
  allVtubersTab: OrgTab,
) {
  const unique = [...new Set(names)].filter(Boolean);
  const fallback = orgs.find((org: any) => org.name === DEFAULT_ORG) || {
    name: DEFAULT_ORG,
    short: "Holo",
  };
  if (unique.length === 0)
    return {
      panel: allVtubersTab,
      homeOrgs: [],
      currentOrg: orgs.find((org: any) => org.name === ALL_VTUBERS_ORG) || allVtubersTab,
    };
  if (unique.length > 1)
    return {
      panel: makeMultiOrgTab(unique, selectedCountLabel),
      homeOrgs: unique,
      currentOrg: orgs.find((org: any) => org.name === unique[0]) || fallback,
    };
  const name = unique[0] || fallback.name;
  const org = orgs.find((o: any) => o.name === name) || fallback;
  return { panel: org, homeOrgs: [org.name], currentOrg: org };
}

// Org names the picker shows as selected for the current tab.
function pickerOrgNames(selectedOrg: any, selectedHomeOrgs: string[]) {
  if (selectedOrg?.name === ALL_VTUBERS_ORG) return [];
  if (selectedOrg?.name === "MultiOrg")
    return selectedOrg.orgNames?.length ? selectedOrg.orgNames : selectedHomeOrgs;
  if (isRealOrgSelection(selectedOrg)) return [selectedOrg.name];
  return selectedHomeOrgs;
}

// Live streams and placeholders the selector can add (streams and Twitch placeholders),
// filtered like the home page for the selected orgs.
function filterSelectableLive(
  live: any[],
  app: any,
  {
    selectedOrg,
    selectedOrgNames,
    hideMissing,
  }: { selectedOrg: any; selectedOrgNames: string[]; hideMissing: boolean | undefined },
) {
  const filterConfig = {
    ignoreBlock: false,
    hideCollabs:
      (selectedOrg?.name === "Favorites" ||
        isRealOrgSelection(selectedOrg) ||
        selectedOrg?.name === "MultiOrg") &&
      app.settings.hideCollabStreams,
    forOrg: selectedOrgNames.length === 1 ? selectedOrgNames[0] : ALL_VTUBERS_ORG,
    forOrgs: selectedOrgNames.length > 1 ? selectedOrgNames : undefined,
    hideIgnoredTopics: true,
    hidePlaceholder: false,
    hideMissing: hideMissing ?? true,
    hideUpcoming: app.settings.hideUpcoming,
    hideGroups: true,
  };
  const isTwitchPlaceholder = (v: any) => v.type === "placeholder" && v.link?.includes("twitch.tv");
  const isPlayable = (v: any) => v.type === "stream" || isTwitchPlaceholder(v);
  const matchesFilter = makeVideoFilter(app, filterConfig);
  return live.filter((item) => matchesFilter(item) && isPlayable(item));
}

// The live bar shows what is live or starting within 2h (6h for the first few), minus the
// videos already in the layout.
function liveBarVideos(filteredLive: any[], activeVideos: any[]) {
  let count = 0;
  return filteredLive
    .filter((item) => {
      count += 1;
      return (
        item.status === "live" ||
        dayjs().isAfter(dayjs(item.start_scheduled).subtract(2, "h")) ||
        (count < 8 && dayjs().isAfter(dayjs(item.start_scheduled).subtract(6, "h")))
      );
    })
    .filter(
      (item) =>
        !activeVideos.find(
          (v: any) => v.id === item.id || (v.link && item.link && v.link === item.link),
        ),
    );
}

function dedupeByIdOrLink(videos: any[]) {
  const merged: any[] = [];
  const seen = new Set<string>();
  videos.forEach((video: any) => {
    const key = video.id || video.link;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(video);
  });
  return merged;
}

function useMinuteTick() {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

// The selected tab (org, MultiOrg, Favorites, Playlist or a URL form). It follows changes to
// the home org selection (made here or elsewhere); this is adjusted during render, keyed on the
// selection itself, so picking Favorites/Playlist/URL tabs isn't undone.
function useSelectedOrg(selectedCountLabel: (count: number) => string, allVtubersTab: OrgTab) {
  const app = useAppState();
  const [selectedOrg, setSelectedOrg] = useState<any>(() =>
    homeOrgTab(
      app.selectedHomeOrgs || [],
      app.orgs || [],
      () => app.currentOrg,
      selectedCountLabel,
      allVtubersTab,
    ),
  );
  const selectedHomeOrgs: string[] = app.selectedHomeOrgs || NO_ORGS;
  const homeOrgsSyncKey = `${selectedHomeOrgs.join("|")}|${app.orgs.length}|${selectedCountLabel(2)}`;
  const [syncedHomeOrgsKey, setSyncedHomeOrgsKey] = useState(homeOrgsSyncKey);
  if (syncedHomeOrgsKey !== homeOrgsSyncKey) {
    setSyncedHomeOrgsKey(homeOrgsSyncKey);
    const next = syncWithHomeOrgs(
      selectedOrg,
      selectedHomeOrgs,
      app.orgs || [],
      selectedCountLabel,
      allVtubersTab,
    );
    if (next !== selectedOrg) setSelectedOrg(next);
  }
  return [selectedOrg, setSelectedOrg] as const;
}

// Loads the live list for the selected tab, reloading on selection/login changes, when the page
// becomes visible and every 2 minutes. Only the latest request's result is kept.
function useSelectionLive({
  isActive,
  selectedOrg,
  selectedHomeOrgs,
}: {
  isActive: boolean;
  selectedOrg: any;
  selectedHomeOrgs: string[];
}) {
  const app = useAppState();
  const [live, setLive] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Only read by handlers (to retry a failed load), so it doesn't need to re-render.
  const hasError = useRef(false);
  const loadRequestId = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedHomeOrgsKey = selectedHomeOrgs.join("|");
  const currentOrgName: string | undefined = app.currentOrg?.name;

  function track(requestId: number, request: Promise<any[]>, toList: (data: any[]) => any[]) {
    request
      .then((data: any[]) => {
        if (requestId !== loadRequestId.current) return;
        setLive(toList(data || []));
      })
      .catch((error) => {
        if (requestId !== loadRequestId.current) return;
        console.error(error);
        hasError.current = true;
      })
      .finally(() => {
        if (requestId === loadRequestId.current) setIsLoading(false);
      });
  }

  function loadSelection(panel = selectedOrg) {
    if (!isActive) return;
    const requestId = ++loadRequestId.current;
    hasError.current = false;
    if (isUrlSelection(panel)) {
      setIsLoading(false);
      return;
    }
    if (panel?.name === "Favorites") {
      if (!app.userdata.jwt) {
        setLive([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      track(requestId, api.favoritesLive({ includePlaceholder: true }, app.userdata.jwt), (data) =>
        data.sort(videoTemporalComparator),
      );
      return;
    }
    if (panel?.name === "Playlist") {
      setLive(app.playlist);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const names = orgNamesForSelection(panel, selectedHomeOrgs, currentOrgName);
    const targets =
      panel?.name === "MultiOrg"
        ? names
        : panel?.name === ALL_VTUBERS_ORG
          ? [ALL_VTUBERS_ORG]
          : [panel?.name || DEFAULT_ORG];
    track(
      requestId,
      api.allLive(targets, { type: "placeholder,stream", include: "mentions,channels" }),
      (videos) => dedupeByIdOrLink(videos).sort(videoTemporalComparator),
    );
  }

  const reloadSelection = useEffectEvent(() => loadSelection());
  // The poll restarts whenever the selection or login changes, so a reload never lands right
  // after a fresh load.
  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(() => reloadSelection(), 2 * 60 * 1000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [isActive, selectedOrg?.name, selectedHomeOrgsKey, app.userdata.jwt]);
  useEffect(() => {
    if (isActive && selectedOrg?.name && selectedOrg.name !== "MultiOrg") reloadSelection();
  }, [isActive, selectedOrg?.name]);
  useEffect(() => {
    if (isActive && selectedOrg?.name === "MultiOrg") reloadSelection();
  }, [isActive, selectedOrg?.name, selectedHomeOrgsKey]);
  useEffect(() => {
    if (app.visibilityState === "visible") reloadSelection();
  }, [app.visibilityState]);

  return {
    live,
    isLoading,
    loadSelection,
    // Re-picking the current tab retries when it has nothing to show.
    needsReload: () => live.length === 0 || hasError.current,
  };
}

function RefreshButton({ spinning, onClick }: { spinning: boolean; onClick: () => void }) {
  const t = useTranslations();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={t("component.apiError.refresh")}
      onClick={onClick}
    >
      <RefreshCw className={cn(spinning && "animate-spin")} />
    </Button>
  );
}

function FavoritesButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={t("component.mainNav.favorites")}
      onClick={onClick}
    >
      <Heart />
    </Button>
  );
}

function InlineUrlForm({ onSubmitUrl }: { onSubmitUrl: (url: string) => boolean }) {
  const t = useTranslations();
  const [inlineUrl, setInlineUrl] = useState("");
  const [inlineUrlError, setInlineUrlError] = useState(false);
  function handleInlineUrl(event: React.FormEvent) {
    event.preventDefault();
    if (!onSubmitUrl(inlineUrl)) {
      setInlineUrlError(true);
      return;
    }
    setInlineUrlError(false);
    setInlineUrl("");
  }
  return (
    <form className="relative flex h-8 min-w-[8rem] flex-1 items-center" onSubmit={handleInlineUrl}>
      <Input
        value={inlineUrl}
        type="url"
        placeholder={t("views.multiview.video.urlPlaceholderShort")}
        aria-invalid={inlineUrlError}
        className="w-full text-sm"
        onChange={(event) => {
          setInlineUrl(event.target.value);
          setInlineUrlError(false);
        }}
      />
      {inlineUrl ? (
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          title={t("views.multiview.video.addUrlShort")}
        >
          <Check />
        </Button>
      ) : null}
    </form>
  );
}

function FavoritesLoginPrompt({ onLogin }: { onLogin: () => void }) {
  const t = useTranslations();
  return (
    <div className="px-3 py-6 text-center">
      <div
        className="text-sm text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: t.raw("views.favorites.promptForAction") }}
      />
      <div className="mt-4">
        <Button variant="ghost" onClick={onLogin}>
          {t("component.mainNav.login")}
        </Button>
      </div>
    </div>
  );
}

function LiveArchiveToggle({
  tab,
  onTabChange,
}: {
  tab: number;
  onTabChange: (tab: number) => void;
}) {
  const t = useTranslations();
  const app = useAppState();
  const hideUpcoming = app.settings.hideUpcoming;
  // Without upcoming streams, "Live / Upcoming" reads just "Live".
  const liveUpcomingLabel = useMemo(() => {
    const value = t("views.home.liveOrUpcomingHeading");
    if (!hideUpcoming) return value;
    const match = String(value || "Live / Upcoming").match(/(.+)([/／・].+)/);
    return match?.[1] || value;
  }, [hideUpcoming, t]);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
      <ToggleGroup
        value={[String(tab)]}
        onValueChange={(value) => {
          if (value[0]) onTabChange(Number(value[0]));
        }}
      >
        <ToggleGroupItem value="0" size="sm">
          {liveUpcomingLabel}
        </ToggleGroupItem>
        <ToggleGroupItem value="1" size="sm">
          {t("views.home.recentVideoToggles.official")}
        </ToggleGroupItem>
      </ToggleGroup>
      <div id="date-selector-multiview" className="ml-auto" />
    </div>
  );
}

// Lists for an org/Favorites/Playlist tab: the playlist itself, or live/archive tabs over the
// org's (or favorites') videos.
function SelectorVideoLists({
  selectedOrg,
  selectedOrgNames,
  isLoading,
  filteredLive,
  embedded,
  tab,
  onTabChange,
  onVideoClicked,
}: {
  selectedOrg: any;
  selectedOrgNames: string[];
  isLoading: boolean;
  filteredLive: any[];
  embedded: boolean;
  tab: number;
  onTabChange: (tab: number) => void;
  onVideoClicked: (video: any) => void;
}) {
  const app = useAppState();
  if (selectedOrg?.name === "Playlist")
    return (
      <VideoCardList
        videos={app.playlist}
        includeChannel
        horizontal
        disableDefaultClick
        inMultiViewSelector
        onVideoClicked={onVideoClicked}
      />
    );
  const isMultiOrg = selectedOrg?.name === "MultiOrg";
  const isRealOrg = isRealOrgSelection(selectedOrg);
  return (
    <>
      <LiveArchiveToggle tab={tab} onTabChange={onTabChange} />
      {isLoading && filteredLive.length === 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <ConnectedVideoList
          tab={tab}
          isFavPage={selectedOrg?.name === "Favorites"}
          hidePlaceholder={false}
          liveContent={filteredLive}
          orgTargetsOverride={isMultiOrg ? selectedOrgNames : isRealOrg ? [selectedOrg.name] : null}
          disableDefaultClick
          datePortalName="date-selector-multiview"
          inMultiViewSelector
          autoFit={embedded}
          autoFitMin="12rem"
          onVideoClicked={onVideoClicked}
        />
      )}
    </>
  );
}

function leaveMultiviewForHome(options?: { openLogin?: boolean }) {
  if (options?.openLogin) openUserMenu();
  window.location.assign("/");
}

// A video's channel avatar (or a placeholder icon) with its live/countdown time; dragging it
// out drops the video's watch (or Twitch) link.
function LiveBarItem({
  video,
  compact,
  tick,
  onClick,
}: {
  video: any;
  compact: boolean;
  tick: number;
  onClick: (video: any) => void;
}) {
  function dragVideo(ev: React.DragEvent) {
    const twitchId =
      video.type === "placeholder" && video.link?.match(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
    ev.dataTransfer.setData(
      "text",
      twitchId ? `https://www.twitch.tv/${twitchId}` : `https://holodex.net/watch/${video.id}`,
    );
    ev.dataTransfer.setData("application/json", JSON.stringify(video));
  }
  const scheduled = dayjs(video.start_actual || video.start_scheduled);
  return (
    <div
      className="group relative flex shrink-0 items-center"
      title={video.title}
      draggable
      onDragStart={dragVideo}
    >
      <div className="relative">
        {!compact ? (
          <Badge
            variant="secondary"
            className="absolute bottom-[-3px] right-[-3px] z-10 h-4 px-1 text-[0.6rem] leading-none"
          >
            {formatDurationShort(Math.abs(scheduled.diff(dayjs(tick)) / 1000))}
          </Badge>
        ) : null}
        <button type="button" className="block rounded-full" onClick={() => onClick(video)}>
          {video.channel?.id ? (
            <ChannelImg
              channel={video.channel}
              size={compact ? 28 : 36}
              noLink
              className="bg-muted"
            />
          ) : (
            <div
              className={cn(
                "flex items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground",
                compact ? "size-7" : "size-9",
              )}
            >
              <CircleUser className="size-4" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

// Horizontally scrolling bar of live/soon videos; the mouse wheel scrolls it sideways.
function LiveBar({
  videos,
  isLoading,
  compact,
  tick,
  onVideoClicked,
}: {
  videos: any[];
  isLoading: boolean;
  compact: boolean;
  tick: number;
  onVideoClicked: (video: any) => void;
}) {
  const videosBar = useRef<HTMLDivElement | null>(null);
  function scrollHandler(e: React.WheelEvent) {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 1) return;
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.cancelable) e.preventDefault();
    if (videosBar.current) {
      videosBar.current.scrollBy({ left: delta, behavior: "auto" });
    }
  }
  return (
    <div className="min-w-0 flex-1 overflow-visible" onWheel={scrollHandler}>
      {isLoading && videos.length === 0 ? (
        <div className="flex items-center gap-2 px-1">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton
              key={n}
              className={cn("shrink-0 rounded-full", compact ? "size-[34px]" : "size-[46px]")}
            />
          ))}
        </div>
      ) : (
        <div className="relative min-w-0 overflow-visible">
          <div
            ref={videosBar}
            className={cn(
              "no-scrollbar w-full overflow-x-auto overflow-y-visible overscroll-contain py-1",
              compact && "py-0.5",
            )}
          >
            <div
              className={cn(
                "flex min-h-full min-w-full items-center pl-0.5 pr-1.5",
                compact ? "gap-1.5" : "gap-2",
              )}
            >
              {videos.map((video) => (
                <LiveBarItem
                  key={video.id || video.link}
                  video={video}
                  compact={compact}
                  tick={tick}
                  onClick={onVideoClicked}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaylistQuickMenu({ onPlaylist }: { onPlaylist: () => void }) {
  const t = useTranslations();
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  return (
    <DropdownMenu open={showPlaylistMenu} onOpenChange={setShowPlaylistMenu}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t("component.mainNav.playlist")}
          />
        }
      >
        <ListPlus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="min-w-[13rem]">
        <DropdownMenuItem className="cursor-pointer gap-2.5" onSelect={onPlaylist}>
          <ListPlus className="h-4 w-4 shrink-0" />
          <span>{t("component.mainNav.playlist")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FavoritesLoginCallout() {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-2 self-center text-sm text-muted-foreground">
      <span dangerouslySetInnerHTML={{ __html: t.raw("views.app.loginCallToAction") }} />
      <Button variant="ghost" onClick={() => leaveMultiviewForHome({ openLogin: true })}>
        {t("component.mainNav.login")}
      </Button>
    </div>
  );
}

type SelectorView = {
  selectedOrg: any;
  selectedOrgNames: string[];
  isLoading: boolean;
  pickerNames: string[];
  onOrgApply: (names: string[]) => void;
  onToggleFavorites: () => void;
  onPlaylist: () => void;
  onRefresh: () => void;
  onVideoClicked: (video: any) => void;
};

// The full selector (dialogs and the add-placeholder page): toolbar, then the URL form, a login
// prompt or the video lists for the selected tab.
function SelectorPanel({
  view,
  embedded,
  filteredLive,
  container,
  tab,
  onTabChange,
  onSubmitUrl,
}: {
  view: SelectorView;
  embedded: boolean;
  filteredLive: any[];
  container: React.RefObject<HTMLDivElement | null>;
  tab: number;
  onTabChange: (tab: number) => void;
  onSubmitUrl: (url: string) => boolean;
}) {
  const t = useTranslations();
  const app = useAppState();
  const { selectedOrg } = view;
  const isUrl = isUrlSelection(selectedOrg);
  const content = (
    <>
      <div className="mb-3 flex items-center gap-1.5 border-b pb-3">
        <HomeOrgMultiSelect
          buttonVariant="ghost"
          manualApply
          selectedNamesOverride={view.pickerNames}
          onApply={view.onOrgApply}
        />
        <FavoritesButton onClick={view.onToggleFavorites} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={t("component.mainNav.playlist")}
          onClick={view.onPlaylist}
        >
          <ListPlus />
        </Button>
        <InlineUrlForm onSubmitUrl={onSubmitUrl} />
        {!isUrl ? <RefreshButton spinning={view.isLoading} onClick={view.onRefresh} /> : null}
      </div>
      <div ref={container} className="min-h-0 flex-1 overflow-y-auto px-1 sm:px-2">
        {isUrl ? (
          <>
            <div className="px-2 py-1 text-sm font-normal text-muted-foreground">
              {t("views.multiview.video.addCustomVideo")}
            </div>
            <CustomUrlField
              // Remount when switching YouTube/Twitch so the typed URL and error reset.
              key={selectedOrg?.name}
              twitch={selectedOrg?.name === "TwitchURL"}
              onSuccess={view.onVideoClicked}
            />
          </>
        ) : selectedOrg?.name === "Favorites" && !app.isLoggedIn ? (
          <FavoritesLoginPrompt onLogin={() => leaveMultiviewForHome({ openLogin: true })} />
        ) : (
          <SelectorVideoLists
            selectedOrg={selectedOrg}
            selectedOrgNames={view.selectedOrgNames}
            isLoading={view.isLoading}
            filteredLive={filteredLive}
            embedded={embedded}
            tab={tab}
            onTabChange={onTabChange}
            onVideoClicked={view.onVideoClicked}
          />
        )}
      </div>
    </>
  );
  return embedded ? (
    <div className="flex max-h-[min(80dvh,calc(100dvh-8rem))] min-h-0 flex-col p-3">{content}</div>
  ) : (
    <Card className="flex max-h-[min(80dvh,calc(100dvh-2rem))] min-h-0 flex-col p-3">
      {content}
    </Card>
  );
}

// The multiview toolbar strip: optional org/favorites/playlist/URL controls, then the live bar.
function SelectorStrip({
  view,
  compact,
  hidden,
  barVideos,
  tick,
}: {
  view: SelectorView;
  compact: boolean;
  hidden: { orgSelector: boolean; favorites: boolean; playlist: boolean; urlInput: boolean };
  barVideos: any[];
  tick: number;
}) {
  const app = useAppState();
  const { selectedOrg } = view;
  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      {!compact ? (
        <>
          {!hidden.orgSelector ? (
            <HomeOrgMultiSelect
              buttonVariant="ghost"
              manualApply
              iconOnly
              selectedNamesOverride={view.pickerNames}
              onApply={view.onOrgApply}
            />
          ) : null}
          {!hidden.favorites ? <FavoritesButton onClick={view.onToggleFavorites} /> : null}
          {!hidden.playlist ? <PlaylistQuickMenu onPlaylist={view.onPlaylist} /> : null}
          {!hidden.urlInput ? (
            <MvUrlInput className="shrink-0 self-center" onSuccess={view.onVideoClicked} />
          ) : null}
          {!isUrlSelection(selectedOrg) ? (
            <RefreshButton spinning={view.isLoading} onClick={view.onRefresh} />
          ) : null}
        </>
      ) : null}
      {selectedOrg?.name === "Favorites" && !app.isLoggedIn ? (
        <FavoritesLoginCallout />
      ) : (
        <LiveBar
          videos={barVideos}
          isLoading={view.isLoading}
          compact={compact}
          tick={tick}
          onVideoClicked={view.onVideoClicked}
        />
      )}
    </div>
  );
}

export function VideoSelector({
  horizontal = false,
  embedded = false,
  isActive = true,
  compact = false,
  hideOrgSelector = false,
  hideFavorites = false,
  hidePlaylist = false,
  hideUrlInput = false,
  hideMissing,
  activeVideos: activeVideosOverride,
  onVideoClicked,
}: {
  horizontal?: boolean;
  embedded?: boolean;
  isActive?: boolean;
  compact?: boolean;
  hideOrgSelector?: boolean;
  hideFavorites?: boolean;
  hidePlaylist?: boolean;
  hideUrlInput?: boolean;
  hideMissing?: boolean;
  activeVideos?: any[];
  onVideoClicked?: (video: any) => void;
}) {
  const t = useTranslations();
  const app = useAppState();
  const selectedCountLabel = useCallback(
    (count: number) => t("component.search.additionalOrgCount", { count }),
    [t],
  );
  const favTab = { name: "Favorites", text: t("component.mainNav.favorites") };
  const playlistTab = { name: "Playlist", text: t("component.mainNav.playlist") };
  const allVtubersTab = useMemo(
    () => ({ name: ALL_VTUBERS_ORG, short: "Vtuber", text: t("component.search.allVtubers") }),
    [t],
  );
  const multiview = useOptionalMultiviewStore();
  const [selectedOrg, setSelectedOrg] = useSelectedOrg(selectedCountLabel, allVtubersTab);
  // Live/upcoming (0) or archive (1); kept here so it survives switching to the URL tabs.
  const [tab, setTab] = useState(0);
  const container = useRef<HTMLDivElement | null>(null);

  const activeVideos = activeVideosOverride || multiview?.activeVideos || [];
  const selectedHomeOrgs: string[] = app.selectedHomeOrgs || NO_ORGS;
  const currentOrgName: string | undefined = app.currentOrg?.name;

  const pickerNames = useMemo(
    () => pickerOrgNames(selectedOrg, selectedHomeOrgs),
    [selectedOrg, selectedHomeOrgs],
  );
  const selectedOrgNames = useMemo(
    () => orgNamesForSelection(selectedOrg, selectedHomeOrgs, currentOrgName),
    [selectedOrg, selectedHomeOrgs, currentOrgName],
  );

  const tick = useMinuteTick();
  const { live, isLoading, loadSelection, needsReload } = useSelectionLive({
    isActive,
    selectedOrg,
    selectedHomeOrgs,
  });
  const baseFilteredLive = useMemo(
    () => filterSelectableLive(live, app, { selectedOrg, selectedOrgNames, hideMissing }),
    [live, app, selectedOrg, selectedOrgNames, hideMissing],
  );
  const topFilteredLive = useMemo(
    // `tick` re-evaluates the time window every minute.
    () => liveBarVideos(baseFilteredLive, activeVideos),
    [baseFilteredLive, activeVideos, tick],
  );

  function handlePicker(panel: any) {
    const currentName = selectedOrg?.name;
    setSelectedOrg(panel);
    if (panel?.name && currentName === panel.name && needsReload()) loadSelection(panel);
    if (container.current) container.current.scrollTop = 0;
  }

  function handleOrgApply(names: string[]) {
    const { panel, homeOrgs, currentOrg } = orgPickerSelection(
      names,
      app.orgs || [],
      selectedCountLabel,
      allVtubersTab,
    );
    app.setSelectedHomeOrgs(homeOrgs);
    app.setCurrentOrg(currentOrg);
    handlePicker(panel);
    loadSelection(panel);
  }

  const handleVideoClick = (video: any) => onVideoClicked?.(video);
  const view: SelectorView = {
    selectedOrg,
    selectedOrgNames,
    isLoading,
    pickerNames,
    onOrgApply: handleOrgApply,
    onToggleFavorites: () =>
      handlePicker(
        selectedOrg?.name === "Favorites"
          ? homeOrgTab(
              selectedHomeOrgs,
              app.orgs || [],
              (name) => (app.currentOrg?.name === name ? app.currentOrg : null),
              selectedCountLabel,
              allVtubersTab,
            )
          : favTab,
      ),
    onPlaylist: () => handlePicker(playlistTab),
    onRefresh: () => loadSelection(),
    onVideoClicked: handleVideoClick,
  };

  if (!horizontal)
    return (
      <SelectorPanel
        view={view}
        embedded={embedded}
        filteredLive={baseFilteredLive}
        container={container}
        tab={tab}
        onTabChange={setTab}
        onSubmitUrl={(url) => submitVideoUrl(url, multiview, onVideoClicked)}
      />
    );
  return (
    <SelectorStrip
      view={view}
      compact={compact}
      hidden={{
        orgSelector: hideOrgSelector,
        favorites: hideFavorites,
        playlist: hidePlaylist,
        urlInput: hideUrlInput,
      }}
      barVideos={topFilteredLive}
      tick={tick}
    />
  );
}
