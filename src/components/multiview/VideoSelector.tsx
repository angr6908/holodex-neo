"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Link, TwitchIcon } from "@/lib/icons";
import { api } from "@/lib/api";
import { DEFAULT_ORG } from "@/lib/consts";
import { dayjs, formatDurationShort } from "@/lib/time";
import { filterVideo } from "@/lib/filter-videos";
import { formatOrgDisplayName, getVideoIDFromUrl, videoTemporalComparator } from "@/lib/functions";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { VideoCardList } from "@/components/video/VideoCardList";
import { ConnectedVideoList } from "@/components/video/ConnectedVideoList";
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
import * as icons from "@/lib/icons";

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
    const content = getVideoIDFromUrl(url) as any;
    if (content?.id) {
      setHasError(false);
      store?.addUrlHistory({ twitch: content.type === "twitch", url });
      onSuccess?.(content);
      collapse();
    } else setHasError(true);
  }
  return (
    <div className={`flex min-w-8 items-center gap-1 has-[form]:min-w-0 has-[form]:max-w-[280px] ${className}`}>
      {!expanded ? (
        <Button type="button" size="icon" variant="secondary" className="h-8 w-8 shrink-0 rounded-xl" title={t("views.multiview.video.addUrl")} onClick={() => setExpanded(true)}><Link className="size-5" /></Button>
      ) : (
        <form className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-150" onSubmit={handleSubmit}>
          <Button type="button" size="icon" variant="secondary" className="h-8 w-8 shrink-0 rounded-xl" title={t("component.common.collapse")} onClick={collapse}><ChevronLeft className="size-5" /></Button>
          <ButtonGroup className="h-8 min-w-0 flex-1">
            <Input ref={inputRef as any} value={url} type="text" placeholder={t("views.multiview.video.urlPlaceholder")} className={cn("h-8 rounded-xl text-sm", hasError && "border-amber-400/50 focus:border-amber-400/60")} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") collapse(); }} />
            {url ? <Button type="submit" size="icon" variant="ghost" className={`h-8 w-8 shrink-0 rounded-xl border ${hasError ? "border-amber-400/30 text-amber-400 hover:bg-amber-400/12" : "border-[color:var(--color-light)] text-[color:var(--color-primary)] hover:bg-[color:color-mix(in_srgb,var(--color-primary)_12%,transparent)]"}`} title={t("component.common.confirm")}><Check className="size-5" /></Button> : null}
          </ButtonGroup>
        </form>
      )}
    </div>
  );
}

function CustomUrlField({ twitch = false, slim = false, onSuccess }: { twitch?: boolean; slim?: boolean; onSuccess?: (content: any) => void }) {
  const t = useTranslations();
  const store = useOptionalMultiviewStore();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const localKey = twitch ? "holodex-v2-multiview-tw-url-history" : "holodex-v2-multiview-yt-url-history";
  const [localHistory, setLocalHistory] = useState<string[]>([]);
  const hint = twitch ? "https://www.twitch.tv/..." : "https://www.youtube.com/watch?v=...";
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
    if (content?.id) {
      setError(false);
      onSuccess?.(content);
      if (!history.includes(url)) addHistory(url);
      setUrl("");
    } else setError(true);
  }
  return (
    <form className="flex w-full items-center gap-2 px-3" onSubmit={handleSubmit}>
      <Combobox items={history} value={history.includes(url) ? url : null} inputValue={url}
        onInputValueChange={(value) => { setUrl(value); if (error) setError(false); }}
        onValueChange={(value) => { setUrl(value || ""); if (error) setError(false); }}
      >
        <ComboboxInput placeholder={slim ? hint : label} className={error ? "border-amber-400/60 focus-within:border-amber-400/70 focus-within:ring-amber-400/20" : ""} showClear={!!url} />
        <ComboboxContent>
          <ComboboxEmpty>{t("views.multiview.video.noHistory")}</ComboboxEmpty>
          <ComboboxList>
            {(item: string, index: number) => <ComboboxItem key={item} value={item} index={index}>{item}</ComboboxItem>}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Button type="submit" size="icon" variant={(url && !error) ? "default" : "outline"}><icons.Check className="size-5" /></Button>
    </form>
  );
}

function makeMultiOrgLabel(names: string[], selectedCountLabel: (count: number) => string) {
  if (!names || names.length === 0) return DEFAULT_ORG;
  if (names.length === 1) return formatOrgDisplayName(names[0]);
  if (names.length === 2) return `${formatOrgDisplayName(names[0])} + ${formatOrgDisplayName(names[1])}`;
  return `${formatOrgDisplayName(names[0])} + ${selectedCountLabel(names.length - 1)}`;
}

function makeMultiOrgTab(names: string[], selectedCountLabel: (count: number) => string) {
  return { name: "MultiOrg", text: makeMultiOrgLabel(names, selectedCountLabel) };
}

export function VideoSelector({ horizontal = false, isActive = true, compact = false, hidePlaceholder, hideMissing, activeVideos: activeVideosOverride, onVideoClicked }: { horizontal?: boolean; isActive?: boolean; compact?: boolean; hidePlaceholder?: boolean; hideMissing?: boolean; activeVideos?: any[]; onVideoClicked?: (video: any) => void }) {
  const t = useTranslations();
  const app = useAppState();
  const selectedCountLabel = useCallback(
    (count: number) => t("component.search.additionalOrgCount", { count }),
    [t],
  );
  const favTab = { name: "Favorites", text: t("component.mainNav.favorites") };
  const playlistTab = { name: "Playlist", text: t("component.mainNav.playlist") };
  const multiview = useOptionalMultiviewStore();
  const [live, setLive] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(() => {
    const selectedHomeOrgs = app.selectedHomeOrgs || [];
    if (selectedHomeOrgs.length > 1) return makeMultiOrgTab(selectedHomeOrgs, selectedCountLabel);
    const selectedName = selectedHomeOrgs[0];
    if (selectedName) return (app.orgs || []).find((org: any) => org.name === selectedName) || app.currentOrg || { name: selectedName, short: selectedName.slice(0, 4) };
    return (app.orgs || []).find((org: any) => org.name === DEFAULT_ORG) || { name: DEFAULT_ORG, short: "Holo" };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [tab, setTab] = useState(0);
  const [inlineUrl, setInlineUrl] = useState("");
  const [inlineUrlError, setInlineUrlError] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [scrollbar, setScrollbar] = useState({
    visible: false,
    left: 0,
    width: 0,
  });
  const loadRequestId = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const videosBar = useRef<HTMLDivElement | null>(null);

  const activeVideos = activeVideosOverride || multiview?.activeVideos || [];
  const selectedHomeOrgs = app.selectedHomeOrgs || [];
  const selectedHomeOrgsKey = selectedHomeOrgs.join("|");
  const hololiveName = DEFAULT_ORG;
  const isLoggedIn = app.isLoggedIn;
  const isMultiOrg = selectedOrg?.name === "MultiOrg";
  const isRealOrg = selectedOrg?.name && !["Favorites", "Playlist", "YouTubeURL", "TwitchURL", "MultiOrg"].includes(selectedOrg.name);
  const isUrl = ["YouTubeURL", "TwitchURL"].includes(selectedOrg?.name);

  function leaveMultiviewForHome(options?: { openLogin?: boolean }) {
    if (options?.openLogin) openUserMenu();
    window.location.assign("/");
  }

  const selectedHomeOrgsForPicker = useMemo(() => {
    if (selectedOrg?.name === "MultiOrg") return selectedHomeOrgs;
    if (isRealOrg) return [selectedOrg.name];
    return selectedHomeOrgs;
  }, [selectedOrg, selectedHomeOrgsKey, isRealOrg]);

  const selectedOrgNames = useMemo(() => {
    if (selectedOrg?.name === "MultiOrg") return selectedHomeOrgs.length ? selectedHomeOrgs : [app.currentOrg?.name || DEFAULT_ORG];
    if (isRealOrg) return [selectedOrg.name];
    return [];
  }, [selectedOrg, selectedHomeOrgsKey, app.currentOrg?.name, isRealOrg]);

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
      forOrg: selectedOrgNames.length === 1 ? selectedOrgNames[0] : "none",
      forOrgs: selectedOrgNames.length > 1 ? selectedOrgNames : undefined,
      hideIgnoredTopics: true,
      hidePlaceholder: hidePlaceholder ?? true,
      hideMissing: hideMissing ?? true,
      hideUpcoming,
      hideGroups: true,
    };
    const isTwitchPlaceholder = (v: any) => v.type === "placeholder" && v.link?.includes("twitch.tv");
    const isPlayable = (v: any) => v.type === "stream" || isTwitchPlaceholder(v);
    return live.filter((item) => filterVideo(item, app, filterConfig) && isPlayable(item));
  }, [live, shouldHideCollabs, selectedOrgNames, hidePlaceholder, hideMissing, hideUpcoming, app]);

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
    if (!horizontal) return undefined;
    updateHorizontalScrollbar();
    window.addEventListener("resize", updateHorizontalScrollbar, {
      passive: true,
    });
    return () => window.removeEventListener("resize", updateHorizontalScrollbar);
  }, [horizontal, compact, topFilteredLive.length, isLoading]);
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
    } else if (selectedOrg?.name === "MultiOrg") {
      const selectedName = selectedHomeOrgs[0];
      const org = selectedName ? (app.orgs || []).find((o: any) => o.name === selectedName) || { name: selectedName, short: selectedName.slice(0, 4) } : (app.orgs || []).find((o: any) => o.name === DEFAULT_ORG) || { name: DEFAULT_ORG, short: "Holo" };
      setSelectedOrg(org);
    }
  }, [selectedHomeOrgsKey, app.orgs.length, selectedCountLabel]);
  function loadSelection() {
    if (!isActive) return;
    const requestId = ++loadRequestId.current;
    setHasError(false);
    if (isUrl) { setIsLoading(false); return; }
    if (selectedOrg?.name === "Favorites") {
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
    if (selectedOrg?.name === "Playlist") {
      setLive(savedVideosList);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const targets = isMultiOrg ? selectedOrgNames : [selectedOrg?.name || DEFAULT_ORG];
    Promise.allSettled(targets.map((name: string) => api.live({ org: name, type: "placeholder,stream", include: "mentions,channels" }))).then((results) => {
      if (requestId !== loadRequestId.current) return;
      const merged: any[] = [];
      const seen = new Set<string>();
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        (result.value || []).forEach((video: any) => {
          const key = video.id || video.link;
          if (seen.has(key)) return;
          seen.add(key);
          merged.push(video);
        });
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
    const currentName = selectedOrg?.name;
    setSelectedOrg(nextTab);
    if (currentName !== nextTab.name || live.length === 0 || hasError) setTimeout(() => loadSelection(), 0);
  }

  function handlePicker(panel: any) {
    const currentName = selectedOrg?.name;
    setSelectedOrg(panel);
    if (panel?.name && (currentName !== panel.name || live.length === 0 || hasError)) setTimeout(() => loadSelection(), 0);
    if (container.current) container.current.scrollTop = 0;
  }

  function handleOrgApply(names: string[]) {
    const unique = [...new Set(names)].filter(Boolean);
    const fallback = (app.orgs || []).find((org: any) => org.name === DEFAULT_ORG) || { name: DEFAULT_ORG, short: "Holo" };
    if (unique.length > 1) {
      app.setSelectedHomeOrgs(unique);
      app.setCurrentOrg((app.orgs || []).find((org: any) => org.name === unique[0]) || fallback);
      handlePicker(makeMultiOrgTab(unique, selectedCountLabel));
    } else {
      const name = unique[0] || fallback.name;
      const org = (app.orgs || []).find((o: any) => o.name === name) || fallback;
      app.setSelectedHomeOrgs([org.name]);
      app.setCurrentOrg(org);
      handlePicker(org);
    }
  }

  function handleInlineUrl(event: React.FormEvent) {
    event.preventDefault();
    const content = getVideoIDFromUrl(inlineUrl) as any;
    if (content?.id) {
      setInlineUrlError(false);
      multiview?.addUrlHistory({ twitch: content.type === "twitch", url: inlineUrl });
      onVideoClicked?.(content);
      setInlineUrl("");
    } else {
      setInlineUrlError(true);
    }
  }

  function handleVideoClick(video: any) { onVideoClicked?.(video); }
  function dragVideo(ev: React.DragEvent, video: any) {
    ev.dataTransfer.setData("text", `https://holodex.net/watch/${video.id}`);
    ev.dataTransfer.setData("application/json", JSON.stringify(video));
  }
  function scrollHandler(e: React.WheelEvent) {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 1) return;
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.cancelable) e.preventDefault();
    if (videosBar.current) {
      videosBar.current.scrollBy({ left: delta, behavior: "auto" });
      requestAnimationFrame(updateHorizontalScrollbar);
    }
  }
  function updateHorizontalScrollbar() {
    const el = videosBar.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 1) {
      setScrollbar((prev) =>
        prev.visible ? { visible: false, left: 0, width: 0 } : prev,
      );
      return;
    }
    const trackWidth = el.clientWidth;
    const width = Math.max(24, (el.clientWidth / el.scrollWidth) * trackWidth);
    const left = (el.scrollLeft / maxScroll) * Math.max(0, trackWidth - width);
    setScrollbar({ visible: true, left, width });
  }
  function formatDurationLive(video: any) {
    const scheduled = dayjs(video.start_actual || video.start_scheduled);
    return formatDurationShort(Math.abs(scheduled.diff(dayjs(tick)) / 1000));
  }

  if (!horizontal) {
    return (
      <Card className="flex h-[80vh] flex-col p-3">
        <div className="mb-3 flex items-center gap-1.5 border-b border-white/10 pb-3">
          <HomeOrgMultiSelect className="min-w-0 flex-1" manualApply selectedNamesOverride={selectedHomeOrgsForPicker} fallbackSelection={[hololiveName]} buttonClass="h-9 w-full justify-between rounded-xl px-3 text-sm font-normal" onApply={handleOrgApply} />
	          <Button type="button" size="icon-sm" className={cn("h-8 w-8 shrink-0 cursor-pointer rounded-xl border transition hover:-translate-y-px active:translate-y-0 active:scale-[0.96]", selectedOrg?.name === "Favorites" ? "border-rose-400/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/20 hover:text-rose-300" : "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-rose-300")} title={t("component.mainNav.favorites")} onClick={() => handlePicker(favTab)}>
            <icons.Heart className="h-4 w-4" />
          </Button>
	          <Button type="button" size="icon-sm" className={cn("h-8 w-8 shrink-0 cursor-pointer rounded-xl border transition hover:-translate-y-px active:translate-y-0 active:scale-[0.96]", selectedOrg?.name === "Playlist" ? "border-sky-400/40 bg-sky-500/20 text-sky-300 hover:bg-sky-500/20 hover:text-sky-300" : "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-sky-300")} title={t("component.mainNav.playlist")} onClick={() => handlePicker(playlistTab)}>
            <icons.ListPlus className="h-4 w-4" />
          </Button>
          <form className="relative flex h-8 min-w-[8rem] flex-1 items-center" onSubmit={handleInlineUrl}>
            <Input value={inlineUrl} type="url" placeholder={t("views.multiview.video.urlPlaceholderShort")} aria-invalid={inlineUrlError} className={cn("h-8 w-full rounded-xl border-white/10 bg-slate-900 px-3 py-1 text-sm text-slate-100 shadow-none placeholder:text-slate-500 outline-none transition focus:border-sky-500/50 focus:bg-slate-800 focus-visible:border-sky-500/50 focus-visible:ring-0", inlineUrlError && "border-amber-400/50 focus:border-amber-400/50 focus-visible:border-amber-400/50", inlineUrl && "rounded-r-none")} onChange={(event) => setInlineUrl(event.target.value)} />
            {inlineUrl ? <Button type="submit" size="icon-sm" className={cn("h-8 w-8 shrink-0 cursor-pointer rounded-l-none rounded-r-xl border border-l-0 transition", inlineUrlError ? "border-amber-400/30 bg-slate-900 text-amber-400 hover:bg-slate-900 hover:text-amber-400" : "border-sky-400/40 bg-sky-500 text-white hover:bg-sky-500 hover:text-white hover:brightness-110")} title={t("views.multiview.video.addUrlShort")}><icons.Check className="h-4 w-4" /></Button> : null}
          </form>
          {!isUrl ? <Button type="button" size="icon" variant="secondary" className={`${isLoading ? "animate-spin " : ""}h-8 w-8 shrink-0 cursor-pointer`} title={t("component.apiError.refresh")} onClick={() => loadSelection()}><icons.RefreshCw className="size-5" /></Button> : null}
        </div>
        <div ref={container} className="min-h-0 flex-1 overflow-y-auto px-1 sm:px-2">
          {isUrl ? (
            <>
              <div className="px-2 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-sky-200/70">{t("views.multiview.video.addCustomVideo")}</div>
              <CustomUrlField twitch={selectedOrg?.name === "TwitchURL"} onSuccess={handleVideoClick} />
            </>
          ) : selectedOrg?.name === "Favorites" && !isLoggedIn ? (
            <div className="px-3 py-6 text-center">
              <div className="text-sm text-slate-300" dangerouslySetInnerHTML={{ __html: t.raw("views.favorites.promptForAction") }} />
              <Button className="mt-4 text-slate-50" onClick={() => leaveMultiviewForHome({ openLogin: !isLoggedIn })}>{isLoggedIn ? t("views.favorites.manageFavorites") : t("component.mainNav.login")}</Button>
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
              {selectedOrg?.name === "Playlist" ? <VideoCardList videos={savedVideosList} includeChannel horizontal dense disableDefaultClick inMultiViewSelector onVideoClicked={handleVideoClick} /> : <ConnectedVideoList tab={tab} isFavPage={selectedOrg?.name === "Favorites"} hidePlaceholder={false} liveContent={baseFilteredLive} orgTargetsOverride={connectedListOrgTargets} disableDefaultClick dense datePortalName="date-selector-multiview" inMultiViewSelector onVideoClicked={handleVideoClick} />}
              <div className="block h-[120px]" />
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      {!compact ? (
        <>
          <HomeOrgMultiSelect className="shrink-0 self-center" manualApply iconOnly inline selectedNamesOverride={selectedHomeOrgsForPicker} fallbackSelection={[hololiveName]} buttonClass="h-8 w-8 gap-0 overflow-hidden rounded-xl px-0" onApply={handleOrgApply} />
	          <Button type="button" size="icon-sm" className={cn("h-8 w-8 shrink-0 rounded-xl border transition hover:-translate-y-px active:translate-y-0 active:scale-[0.96]", selectedOrg?.name === "Favorites" ? "border-rose-400/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/20 hover:text-rose-300" : "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-rose-300")} title={t("component.mainNav.favorites")} onClick={() => selectQuickTab(favTab)}>
            <icons.Heart className="h-4 w-4" />
          </Button>
          <DropdownMenu open={showPlaylistMenu} onOpenChange={setShowPlaylistMenu}>
            <DropdownMenuTrigger
	              render={<Button type="button" size="icon-sm" className={cn("h-8 w-8 shrink-0 rounded-xl border transition hover:-translate-y-px active:translate-y-0 active:scale-[0.96]", selectedOrg?.name === "Playlist" ? "border-sky-400/40 bg-sky-500/20 text-sky-300 hover:bg-sky-500/20 hover:text-sky-300" : "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-sky-300")} title={t("component.mainNav.playlist")} />}
            >
              <icons.ListPlus className="h-4 w-4" />
            </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="z-[120] min-w-[13rem] rounded-xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
                <DropdownMenuItem className={cn("cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm transition focus:bg-white/8 focus:text-[color:var(--color-foreground)] hover:bg-white/8", selectedOrg?.name === "Playlist" ? "text-sky-300 focus:text-sky-300" : "text-[color:var(--color-foreground)]")} onSelect={() => selectQuickTab(playlistTab)}>
                <icons.ListPlus className="h-4 w-4 shrink-0 text-sky-400" />
                <span>{t("component.mainNav.playlist")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <MvUrlInput className="shrink-0 self-center" onSuccess={handleVideoClick} />
          {!isUrl ? <Button type="button" size="icon-sm" className={cn("h-8 w-8 shrink-0 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] transition hover:-translate-y-px hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--color-foreground)] active:translate-y-0 active:scale-[0.96]", isLoading && "animate-spin")} title={t("component.apiError.refresh")} onClick={() => loadSelection()}><icons.RefreshCw className="h-4 w-4" /></Button> : null}
        </>
      ) : null}
      {selectedOrg?.name === "Favorites" && !isLoggedIn ? (
        <div className="flex items-center gap-2 self-center text-sm text-slate-300"><span dangerouslySetInnerHTML={{ __html: t.raw("views.app.loginCallToAction") }} /><Button variant="ghost" size="sm" onClick={() => leaveMultiviewForHome({ openLogin: true })}>{t("component.mainNav.login")}</Button></div>
      ) : (
        <div className={cn("h-[52px] min-w-0 flex-1 overflow-hidden", compact && "h-10")} onWheel={scrollHandler}>
          {isLoading && topFilteredLive.length === 0 ? (
            <div className="flex items-center gap-2 px-1">{[1, 2, 3, 4, 5, 6].map((n) => <Skeleton key={n} className="shrink-0 rounded-full" style={{ width: compact ? 34 : 46, height: compact ? 34 : 46 }} />)}</div>
          ) : (
            <div className={cn("relative h-[52px] overflow-hidden", compact && "h-10 min-w-0")}>
              <div
                ref={videosBar}
                className={cn("h-[49px] w-full overflow-x-auto overflow-y-hidden overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", compact && "h-10")}
                onScroll={updateHorizontalScrollbar}
              >
                <div className={cn("flex min-h-full min-w-full items-center pl-0.5 pr-1.5", compact ? "gap-1.5" : "gap-2")}>
                  {topFilteredLive.map((video, index) => (
                    <div key={`${video.id || video.link || "video"}-${index}`} className="group relative flex shrink-0 items-center" title={video.title} draggable onDragStart={(event) => dragVideo(event, video)}>
                      <Button type="button" variant="ghost" className="relative h-auto w-auto rounded-full p-0 transition-transform hover:bg-transparent group-hover:scale-[1.02]" onClick={() => handleVideoClick(video)}>
                        {video?.link && !compact ? <Badge className="absolute left-0 top-0 z-10 min-w-[20px] justify-center rounded-full border-[color:var(--color-border)] bg-[color:var(--surface-elevated)] px-1 py-0 text-[9px] text-[color:var(--color-foreground)] tracking-normal shadow-[0_8px_18px_rgba(148,163,184,0.24)]"><TwitchIcon className="size-3.5" /></Badge> : null}
                        {!compact ? <Badge variant="secondary" className="absolute bottom-[-2px] right-[-2px] z-10 rounded-full border-[color:var(--color-border)] bg-[color:var(--surface-elevated)] px-1.5 py-0 text-[9px] text-[color:var(--color-foreground)] normal-case tracking-normal shadow-[0_8px_18px_rgba(148,163,184,0.24)]">{formatDurationLive(video)}</Badge> : null}
                        {video.channel?.id ? <ChannelImg channel={video.channel} size={compact ? 28 : 36} noLink className="bg-slate-900/85 ring-1 ring-white/10" /> : <div className="flex items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10" style={{ width: compact ? 28 : 36, height: compact ? 28 : 36 }}><icons.CircleUser className="size-4" /></div>}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              {scrollbar.visible ? (
                <div className="absolute inset-x-0 bottom-0 h-[3px] rounded-none bg-white/10" aria-hidden="true">
                  <div
                    className="h-full rounded-none bg-white/35 will-change-[transform,width]"
                    style={{
                      width: `${scrollbar.width}px`,
                      transform: `translateX(${scrollbar.left}px)`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
