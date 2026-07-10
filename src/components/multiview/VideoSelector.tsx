"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, CircleUser, Heart, Link, ListPlus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG, DEFAULT_ORG, TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";
import { dayjs, formatDurationShort } from "@/lib/time";
import { makeVideoFilter } from "@/lib/filter-videos";
import { formatOrgDisplayName, getVideoIDFromUrl, videoTemporalComparator } from "@/lib/functions";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { VideoCardList } from "@/components/video/VideoCardList";
import { ConnectedVideoList } from "@/components/nav/MainNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTranslations } from "next-intl";
import { useAppState } from "@/lib/store";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import { readJSON, writeJSON, openUserMenu } from "@/lib/browser";
import { cn } from "@/lib/utils";

function submitVideoUrl(url: string, store: any, onSuccess?: (content: any) => void) {
  const content = getVideoIDFromUrl(url) as any;
  if (!content?.id) return false;
  store?.addUrlHistory({ twitch: content.type === "twitch", url });
  onSuccess?.(content);
  return true;
}

function MvUrlInput({ className = "", onSuccess }: { className?: string; onSuccess?: (content: any) => void }) {
  const t = useTranslations();
  const store = useOptionalMultiviewStore();
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (hasError) setHasError(false); }, [url]);
  useEffect(() => { if (expanded) setTimeout(() => inputRef.current?.focus(), 0); }, [expanded]);
  const collapse = () => { setExpanded(false); setUrl(""); setHasError(false); };
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!submitVideoUrl(url, store, onSuccess)) { setHasError(true); return; }
    collapse();
  }
  return (
    <div className={`flex min-w-8 items-center gap-1 has-[form]:min-w-0 has-[form]:max-w-[280px] ${className}`}>
      {!expanded ? (
        <Button type="button" variant="ghost" size="icon" title={t("views.multiview.video.addUrl")} onClick={() => setExpanded(true)}>
          <Link />
        </Button>
      ) : (
        <form className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-150" onSubmit={handleSubmit}>
          <Button type="button" variant="ghost" size="icon" title={t("component.common.collapse")} onClick={collapse}>
            <ChevronLeft />
          </Button>
          <ButtonGroup className="h-8 min-w-0 flex-1">
            <Input ref={inputRef as any} value={url} type="text" placeholder={t("views.multiview.video.urlPlaceholder")} className="text-sm" aria-invalid={hasError} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") collapse(); }} />
            {url ? (
              <Button type="submit" variant="ghost" size="icon" title={t("component.common.confirm")}>
                <Check />
              </Button>
            ) : null}
          </ButtonGroup>
        </form>
      )}
    </div>
  );
}

function CustomUrlField({ twitch = false, onSuccess }: { twitch?: boolean; onSuccess?: (content: any) => void }) {
  const t = useTranslations();
  const store = useOptionalMultiviewStore();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const localKey = twitch ? "holodex-v2-multiview-tw-url-history" : "holodex-v2-multiview-yt-url-history";
  const [localHistory, setLocalHistory] = useState<string[]>([]);
  const label = twitch ? t("views.multiview.video.twitchChannelLink") : t("views.multiview.video.youtubeVideoLink");
  const history = useMemo(() => [...(store ? (twitch ? store.twUrlHistory : store.ytUrlHistory) : localHistory)].reverse(), [store, twitch, localHistory]);
  useEffect(() => { if (!store) setLocalHistory(readJSON(localKey, [] as string[])); }, [store, localKey]);
  useEffect(() => { setUrl(""); setError(false); }, [twitch]);
  function addHistory(value: string) {
    if (store) { store.addUrlHistory({ twitch, url: value }); return; }
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
    if (!content?.id) { setError(true); return; }
    setError(false);
    onSuccess?.(content);
    if (!history.includes(url)) addHistory(url);
    setUrl("");
  }
  return (
    <form className="flex w-full items-center gap-2 px-3" onSubmit={handleSubmit}>
      <Combobox items={history} value={history.includes(url) ? url : null} inputValue={url}
        onInputValueChange={(value) => { setUrl(value); if (error) setError(false); }}
        onValueChange={(value) => { setUrl(value || ""); if (error) setError(false); }}
      >
        <ComboboxInput placeholder={label} aria-invalid={error} showClear={!!url} />
        <ComboboxContent>
          <ComboboxEmpty>{t("views.multiview.video.noHistory")}</ComboboxEmpty>
          <ComboboxList>
            {(item: string, index: number) => <ComboboxItem key={item} value={item} index={index}>{item}</ComboboxItem>}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Button type="submit" variant="ghost" size="icon">
        <Check />
      </Button>
    </form>
  );
}

function makeMultiOrgLabel(names: string[], selectedCountLabel: (count: number) => string) {
  if (!names?.length) return DEFAULT_ORG;
  if (names.length === 1) return formatOrgDisplayName(names[0]);
  const tail = names.length === 2 ? formatOrgDisplayName(names[1]) : selectedCountLabel(names.length - 1);
  return `${formatOrgDisplayName(names[0])} + ${tail}`;
}

function makeMultiOrgTab(names: string[], selectedCountLabel: (count: number) => string) {
  return { name: "MultiOrg", text: makeMultiOrgLabel(names, selectedCountLabel), orgNames: [...names] };
}

export function VideoSelector({ horizontal = false, embedded = false, isActive = true, compact = false, hideOrgSelector = false, hideFavorites = false, hidePlaylist = false, hideUrlInput = false, hideMissing, activeVideos: activeVideosOverride, onVideoClicked }: { horizontal?: boolean; embedded?: boolean; isActive?: boolean; compact?: boolean; hideOrgSelector?: boolean; hideFavorites?: boolean; hidePlaylist?: boolean; hideUrlInput?: boolean; hideMissing?: boolean; activeVideos?: any[]; onVideoClicked?: (video: any) => void }) {
  const t = useTranslations();
  const app = useAppState();
  const selectedCountLabel = useCallback(
    (count: number) => t("component.search.additionalOrgCount", { count }),
    [t],
  );
  const favTab = { name: "Favorites", text: t("component.mainNav.favorites") };
  const playlistTab = { name: "Playlist", text: t("component.mainNav.playlist") };
  const allVtubersTab = useMemo(() => ({ name: ALL_VTUBERS_ORG, short: "Vtuber", text: t("component.search.allVtubers") }), [t]);
  const multiview = useOptionalMultiviewStore();
  const [live, setLive] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(() => {
    const selectedHomeOrgs = app.selectedHomeOrgs || [];
    if (selectedHomeOrgs.length > 1) return makeMultiOrgTab(selectedHomeOrgs, selectedCountLabel);
    const selectedName = selectedHomeOrgs[0];
    if (selectedName) return (app.orgs || []).find((org: any) => org.name === selectedName) || app.currentOrg || { name: selectedName, short: selectedName.slice(0, 4) };
    return allVtubersTab;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [tab, setTab] = useState(0);
  const [inlineUrl, setInlineUrl] = useState("");
  const [inlineUrlError, setInlineUrlError] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const loadRequestId = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const videosBar = useRef<HTMLDivElement | null>(null);

  const activeVideos = activeVideosOverride || multiview?.activeVideos || [];
  const selectedHomeOrgs = app.selectedHomeOrgs || [];
  const selectedHomeOrgsKey = selectedHomeOrgs.join("|");
  const isLoggedIn = app.isLoggedIn;
  const isMultiOrg = selectedOrg?.name === "MultiOrg";
  const isAllVtubers = selectedOrg?.name === ALL_VTUBERS_ORG;
  const isRealOrg = isRealOrgSelection(selectedOrg);
  const isUrl = isUrlSelection(selectedOrg);

  function leaveMultiviewForHome(options?: { openLogin?: boolean }) {
    if (options?.openLogin) openUserMenu();
    window.location.assign("/");
  }

  const selectedHomeOrgsForPicker = useMemo(() => {
    if (isAllVtubers) return [];
    if (selectedOrg?.name === "MultiOrg") return selectedOrg.orgNames?.length ? selectedOrg.orgNames : selectedHomeOrgs;
    if (isRealOrg) return [selectedOrg.name];
    return selectedHomeOrgs;
  }, [selectedOrg, selectedHomeOrgsKey, isAllVtubers, isRealOrg]);

  const selectedOrgNames = useMemo(() => orgNamesForSelection(selectedOrg), [selectedOrg, selectedHomeOrgsKey, app.currentOrg?.name]);

  const shouldHideCollabs = (selectedOrg?.name === "Favorites" || isRealOrg || isMultiOrg) && app.settings.hideCollabStreams;
  const connectedListOrgTargets = isMultiOrg ? selectedOrgNames : isRealOrg ? [selectedOrg.name] : null;
  const savedVideosList = app.playlist;
  const hideUpcoming = app.settings.hideUpcoming;
  const liveUpcomingLabel = useMemo(() => {
    const value = t("views.home.liveOrUpcomingHeading");
    if (!hideUpcoming) return value;
    const match = String(value || "Live / Upcoming").match(/(.+)([\/／・].+)/);
    return match?.[1] || value;
  }, [hideUpcoming, t]);

  const baseFilteredLive = useMemo(() => {
    const filterConfig = {
      ignoreBlock: false,
      hideCollabs: shouldHideCollabs,
      forOrg: selectedOrgNames.length === 1 ? selectedOrgNames[0] : ALL_VTUBERS_ORG,
      forOrgs: selectedOrgNames.length > 1 ? selectedOrgNames : undefined,
      hideIgnoredTopics: true,
      hidePlaceholder: false,
      hideMissing: hideMissing ?? true,
      hideUpcoming,
      hideGroups: true,
    };
    const isTwitchPlaceholder = (v: any) => v.type === "placeholder" && v.link?.includes("twitch.tv");
    const isPlayable = (v: any) => v.type === "stream" || isTwitchPlaceholder(v);
    const matchesFilter = makeVideoFilter(app, filterConfig);
    return live.filter((item) => matchesFilter(item) && isPlayable(item));
  }, [live, shouldHideCollabs, selectedOrgNames, hideMissing, hideUpcoming, app]);

  const topFilteredLive = useMemo(() => {
    let count = 0;
    return baseFilteredLive.filter((item) => {
      count += 1;
      return item.status === "live"
        || dayjs().isAfter(dayjs(item.start_scheduled).subtract(2, "h"))
        || (count < 8 && dayjs().isAfter(dayjs(item.start_scheduled).subtract(6, "h")));
    }).filter((item) => !activeVideos.find((v: any) => v.id === item.id || (v.link && item.link && v.link === item.link)));
  }, [baseFilteredLive, activeVideos, tick]);

  useEffect(() => { if (inlineUrlError) setInlineUrlError(false); }, [inlineUrl]);
  useEffect(() => { const id = setInterval(() => setTick(Date.now()), 60000); return () => clearInterval(id); }, []);
  useEffect(() => {
    refreshTimer.current && clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(() => loadSelection(), 2 * 60 * 1000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [isActive, selectedOrg?.name, selectedHomeOrgsKey, app.userdata.jwt]);
  useEffect(() => { if (isActive && selectedOrg?.name && selectedOrg.name !== "MultiOrg") loadSelection(); }, [isActive, selectedOrg?.name]);
  useEffect(() => {
    if (isActive && selectedOrg?.name === "MultiOrg") loadSelection();
  }, [isActive, selectedOrg?.name, selectedHomeOrgsKey]);
  useEffect(() => { if (app.visibilityState === "visible") loadSelection(); }, [app.visibilityState]);
  useEffect(() => {
    if (selectedHomeOrgs.length > 1) {
      if (selectedOrg?.name !== "MultiOrg" || selectedOrg.text !== makeMultiOrgLabel(selectedHomeOrgs, selectedCountLabel)) setSelectedOrg(makeMultiOrgTab(selectedHomeOrgs, selectedCountLabel));
    } else if (selectedHomeOrgs.length === 0) {
      if (selectedOrg?.name !== ALL_VTUBERS_ORG) setSelectedOrg(allVtubersTab);
    } else if (selectedOrg?.name === "MultiOrg") {
      const selectedName = selectedHomeOrgs[0];
      const org = selectedName ? (app.orgs || []).find((o: any) => o.name === selectedName) || { name: selectedName, short: selectedName.slice(0, 4) } : (app.orgs || []).find((o: any) => o.name === DEFAULT_ORG) || { name: DEFAULT_ORG, short: "Holo" };
      setSelectedOrg(org);
    }
  }, [selectedHomeOrgsKey, app.orgs.length, selectedCountLabel, allVtubersTab, selectedOrg?.name, selectedOrg?.text]);
  function isUrlSelection(panel: any) {
    return ["YouTubeURL", "TwitchURL"].includes(panel?.name);
  }

  function isRealOrgSelection(panel: any) {
    return !!panel?.name && !["Favorites", "Playlist", "YouTubeURL", "TwitchURL", "MultiOrg", ALL_VTUBERS_ORG].includes(panel.name);
  }

  function orgNamesForSelection(panel: any) {
    if (panel?.name === ALL_VTUBERS_ORG) return [];
    if (panel?.name === "MultiOrg") return panel.orgNames?.length ? panel.orgNames : selectedHomeOrgs.length ? selectedHomeOrgs : [app.currentOrg?.name || DEFAULT_ORG];
    if (isRealOrgSelection(panel)) return [panel.name];
    return [];
  }

  function loadSelection(panel = selectedOrg) {
    if (!isActive) return;
    const requestId = ++loadRequestId.current;
    setHasError(false);
    if (isUrlSelection(panel)) { setIsLoading(false); return; }
    if (panel?.name === "Favorites") {
      if (!app.userdata.jwt) { setLive([]); setIsLoading(false); return; }
      setIsLoading(true);
      api.favoritesLive({ includePlaceholder: true }, app.userdata.jwt).then((data: any[]) => {
        if (requestId !== loadRequestId.current) return;
        setLive((data || []).sort(videoTemporalComparator));
      }).catch((error) => {
        if (requestId !== loadRequestId.current) return;
        console.error(error);
        setHasError(true);
      }).finally(() => { if (requestId === loadRequestId.current) setIsLoading(false); });
      return;
    }
    if (panel?.name === "Playlist") {
      setLive(savedVideosList);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const names = orgNamesForSelection(panel);
    const targets = panel?.name === "MultiOrg" ? names : panel?.name === ALL_VTUBERS_ORG ? [ALL_VTUBERS_ORG] : [panel?.name || DEFAULT_ORG];
    api.allLive(targets, { type: "placeholder,stream", include: "mentions,channels" }).then((videos: any[]) => {
      if (requestId !== loadRequestId.current) return;
      const merged: any[] = [];
      const seen = new Set<string>();
      (videos || []).forEach((video: any) => {
        const key = video.id || video.link;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(video);
      });
      merged.sort(videoTemporalComparator);
      setLive(merged);
    }).catch((error) => {
      if (requestId !== loadRequestId.current) return;
      console.error(error);
      setHasError(true);
    }).finally(() => { if (requestId === loadRequestId.current) setIsLoading(false); });
  }

  function selectQuickTab(nextTab: { name: string; text: string }) {
    handlePicker(nextTab);
  }

  function getHomeOrgSelection() {
    if (selectedHomeOrgs.length > 1) return makeMultiOrgTab(selectedHomeOrgs, selectedCountLabel);
    const selectedName = selectedHomeOrgs[0];
    if (selectedName) return (app.orgs || []).find((org: any) => org.name === selectedName) || (app.currentOrg?.name === selectedName ? app.currentOrg : null) || { name: selectedName, short: selectedName.slice(0, 4) };
    return allVtubersTab;
  }

  function handlePicker(panel: any) {
    const currentName = selectedOrg?.name;
    setSelectedOrg(panel);
    if (panel?.name && currentName === panel.name && (live.length === 0 || hasError)) loadSelection(panel);
    if (container.current) container.current.scrollTop = 0;
  }

  function toggleFavorites() {
    handlePicker(selectedOrg?.name === "Favorites" ? getHomeOrgSelection() : favTab);
  }

  function handleOrgApply(names: string[]) {
    const unique = [...new Set(names)].filter(Boolean);
    const fallback = (app.orgs || []).find((org: any) => org.name === DEFAULT_ORG) || { name: DEFAULT_ORG, short: "Holo" };
    if (unique.length === 0) {
      const panel = allVtubersTab;
      app.setSelectedHomeOrgs([]);
      app.setCurrentOrg((app.orgs || []).find((org: any) => org.name === ALL_VTUBERS_ORG) || allVtubersTab);
      handlePicker(panel);
      loadSelection(panel);
    } else if (unique.length > 1) {
      const panel = makeMultiOrgTab(unique, selectedCountLabel);
      app.setSelectedHomeOrgs(unique);
      app.setCurrentOrg((app.orgs || []).find((org: any) => org.name === unique[0]) || fallback);
      handlePicker(panel);
      loadSelection(panel);
    } else {
      const name = unique[0] || fallback.name;
      const org = (app.orgs || []).find((o: any) => o.name === name) || fallback;
      app.setSelectedHomeOrgs([org.name]);
      app.setCurrentOrg(org);
      handlePicker(org);
      loadSelection(org);
    }
  }

  function handleInlineUrl(event: React.FormEvent) {
    event.preventDefault();
    if (!submitVideoUrl(inlineUrl, multiview, onVideoClicked)) { setInlineUrlError(true); return; }
    setInlineUrlError(false);
    setInlineUrl("");
  }

  function handleVideoClick(video: any) { onVideoClicked?.(video); }
  function dragVideo(ev: React.DragEvent, video: any) {
    const twitchId = video.type === "placeholder" && video.link?.match(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
    ev.dataTransfer.setData("text", twitchId ? `https://www.twitch.tv/${twitchId}` : `https://holodex.net/watch/${video.id}`);
    ev.dataTransfer.setData("application/json", JSON.stringify(video));
  }
  function scrollHandler(e: React.WheelEvent) {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 1) return;
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.cancelable) e.preventDefault();
    if (videosBar.current) {
      videosBar.current.scrollBy({ left: delta, behavior: "auto" });
    }
  }
  function formatDurationLive(video: any) {
    const scheduled = dayjs(video.start_actual || video.start_scheduled);
    return formatDurationShort(Math.abs(scheduled.diff(dayjs(tick)) / 1000));
  }

  if (!horizontal) {
    const selectorContent = (
      <>
        <div className="mb-3 flex items-center gap-1.5 border-b pb-3">
          <HomeOrgMultiSelect buttonVariant="ghost" manualApply selectedNamesOverride={selectedHomeOrgsForPicker} onApply={handleOrgApply} />
          <Button type="button" variant="ghost" size="icon" title={t("component.mainNav.favorites")} onClick={toggleFavorites}>
            <Heart />
          </Button>
          <Button type="button" variant="ghost" size="icon" title={t("component.mainNav.playlist")} onClick={() => handlePicker(playlistTab)}>
            <ListPlus />
          </Button>
          <form className="relative flex h-8 min-w-[8rem] flex-1 items-center" onSubmit={handleInlineUrl}>
            <Input value={inlineUrl} type="url" placeholder={t("views.multiview.video.urlPlaceholderShort")} aria-invalid={inlineUrlError} className="w-full text-sm" onChange={(event) => setInlineUrl(event.target.value)} />
            {inlineUrl ? (
              <Button type="submit" variant="ghost" size="icon" title={t("views.multiview.video.addUrlShort")}>
                <Check />
              </Button>
            ) : null}
          </form>
          {!isUrl ? (
            <Button type="button" variant="ghost" size="icon" title={t("component.apiError.refresh")} onClick={() => loadSelection()}>
              <RefreshCw className={cn(isLoading && "animate-spin")} />
            </Button>
          ) : null}
        </div>
        <div ref={container} className="min-h-0 flex-1 overflow-y-auto px-1 sm:px-2">
          {isUrl ? (
            <>
              <div className="px-2 py-1 text-sm font-normal text-muted-foreground">{t("views.multiview.video.addCustomVideo")}</div>
              <CustomUrlField twitch={selectedOrg?.name === "TwitchURL"} onSuccess={handleVideoClick} />
            </>
          ) : selectedOrg?.name === "Favorites" && !isLoggedIn ? (
            <div className="px-3 py-6 text-center">
              <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t.raw("views.favorites.promptForAction") }} />
              <div className="mt-4">
                <Button variant="ghost" onClick={() => leaveMultiviewForHome({ openLogin: !isLoggedIn })}>
                  {isLoggedIn ? t("views.favorites.manageFavorites") : t("component.mainNav.login")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {selectedOrg?.name !== "Playlist" ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
                  <ToggleGroup value={[String(tab)]} onValueChange={(value) => { if (value[0]) setTab(Number(value[0])); }}>
                    <ToggleGroupItem value="0" size="sm">{liveUpcomingLabel}</ToggleGroupItem>
                    <ToggleGroupItem value="1" size="sm">{t("views.home.recentVideoToggles.official")}</ToggleGroupItem>
                  </ToggleGroup>
                  <div id="date-selector-multiview" className="ml-auto" />
                </div>
              ) : null}
              {selectedOrg?.name === "Playlist" ? (
                <VideoCardList videos={savedVideosList} includeChannel horizontal dense disableDefaultClick inMultiViewSelector onVideoClicked={handleVideoClick} />
              ) : isLoading && baseFilteredLive.length === 0 ? (
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(12rem, 100%), 1fr))" }}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <Skeleton key={n} className="h-28 rounded-lg" />)}
                </div>
              ) : (
                <ConnectedVideoList tab={tab} isFavPage={selectedOrg?.name === "Favorites"} hidePlaceholder={false} liveContent={baseFilteredLive} orgTargetsOverride={connectedListOrgTargets} disableDefaultClick dense datePortalName="date-selector-multiview" inMultiViewSelector autoFit={embedded} autoFitMin="12rem" onVideoClicked={handleVideoClick} />
              )}
            </>
          )}
        </div>
      </>
    );
    return embedded ? (
      <div className="flex max-h-[min(80dvh,calc(100dvh-8rem))] min-h-0 flex-col p-3">
        {selectorContent}
      </div>
    ) : (
      <Card className="flex max-h-[min(80dvh,calc(100dvh-2rem))] min-h-0 flex-col p-3">
        {selectorContent}
      </Card>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      {!compact ? (
        <>
          {!hideOrgSelector ? <HomeOrgMultiSelect buttonVariant="ghost" manualApply iconOnly selectedNamesOverride={selectedHomeOrgsForPicker} onApply={handleOrgApply} /> : null}
          {!hideFavorites ? <Button type="button" variant="ghost" size="icon" title={t("component.mainNav.favorites")} onClick={toggleFavorites}>
            <Heart />
          </Button> : null}
          {!hidePlaylist ? <DropdownMenu open={showPlaylistMenu} onOpenChange={setShowPlaylistMenu}>
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" size="icon" title={t("component.mainNav.playlist")} />}
            >
              <ListPlus />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="min-w-[13rem]">
              <DropdownMenuItem className="cursor-pointer gap-2.5" onSelect={() => selectQuickTab(playlistTab)}>
                <ListPlus className="h-4 w-4 shrink-0" />
                <span>{t("component.mainNav.playlist")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> : null}
          {!hideUrlInput ? <MvUrlInput className="shrink-0 self-center" onSuccess={handleVideoClick} /> : null}
          {!isUrl ? (
            <Button type="button" variant="ghost" size="icon" title={t("component.apiError.refresh")} onClick={() => loadSelection()}>
              <RefreshCw className={cn(isLoading && "animate-spin")} />
            </Button>
          ) : null}
        </>
      ) : null}
      {selectedOrg?.name === "Favorites" && !isLoggedIn ? (
        <div className="flex items-center gap-2 self-center text-sm text-muted-foreground">
          <span dangerouslySetInnerHTML={{ __html: t.raw("views.app.loginCallToAction") }} />
          <Button variant="ghost" onClick={() => leaveMultiviewForHome({ openLogin: true })}>
            {t("component.mainNav.login")}
          </Button>
        </div>
      ) : (
        <div className="min-w-0 flex-1 overflow-visible" onWheel={scrollHandler}>
          {isLoading && topFilteredLive.length === 0 ? (
            <div className="flex items-center gap-2 px-1">{[1, 2, 3, 4, 5, 6].map((n) => <Skeleton key={n} className={cn("shrink-0 rounded-full", compact ? "size-[34px]" : "size-[46px]")} />)}</div>
          ) : (
            <div className="relative min-w-0 overflow-visible">
              <div
                ref={videosBar}
                className={cn("no-scrollbar w-full overflow-x-auto overflow-y-visible overscroll-contain py-1", compact && "py-0.5")}
              >
                <div className={cn("flex min-h-full min-w-full items-center pl-0.5 pr-1.5", compact ? "gap-1.5" : "gap-2")}>
                  {topFilteredLive.map((video, index) => (
                    <div key={`${video.id || video.link || "video"}-${index}`} className="group relative flex shrink-0 items-center" title={video.title} draggable onDragStart={(event) => dragVideo(event, video)}>
                      <div className="relative">

                        {!compact ? <Badge variant="secondary" className="absolute bottom-[-3px] right-[-3px] z-10 h-4 px-1 text-[0.6rem] leading-none">{formatDurationLive(video)}</Badge> : null}
                        <button type="button" className="block rounded-full" onClick={() => handleVideoClick(video)}>
                          {video.channel?.id ? <ChannelImg channel={video.channel} size={compact ? 28 : 36} noLink className="bg-muted" /> : <div className={cn("flex items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground", compact ? "size-7" : "size-9")}><CircleUser className="size-4" /></div>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
