"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mdiTwitch } from "@mdi/js";
import { api } from "@/lib/api";
import { dayjs, formatDurationShort } from "@/lib/time";
import { filterVideo } from "@/lib/filter-videos";
import { formatOrgDisplayName, getVideoIDFromUrl, videoTemporalComparator } from "@/lib/functions";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { VideoCardList } from "@/components/video/VideoCardList";
import { ConnectedVideoList } from "@/components/video/ConnectedVideoList";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";
import { useAppState } from "@/lib/store";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import { cn } from "@/lib/cn";
import { CustomUrlField } from "@/components/multiview/CustomUrlField";
import { MvUrlInput } from "@/components/multiview/MvUrlInput";
import * as icons from "@/lib/icons";
import { openUserMenu } from "@/lib/navigation-events";

function makeMultiOrgLabel(names: string[]) {
  if (!names || names.length === 0) return "Hololive";
  if (names.length === 1) return formatOrgDisplayName(names[0]);
  if (names.length === 2) return `${formatOrgDisplayName(names[0])} + ${formatOrgDisplayName(names[1])}`;
  return `${formatOrgDisplayName(names[0])} +${names.length - 1}`;
}

function makeMultiOrgTab(names: string[]) {
  return { name: "MultiOrg", text: makeMultiOrgLabel(names) };
}

const favTab = { name: "Favorites", text: "Favorites" };
const playlistTab = { name: "Playlist", text: "Playlist" };
const PLAYLIST_SVG_PATH = "M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z";
const HEART_SVG_PATH = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

export function VideoSelector({ horizontal = false, isActive = true, compact = false, hidePlaceholder, hideMissing, activeVideos: activeVideosOverride, onVideoClicked }: { horizontal?: boolean; isActive?: boolean; compact?: boolean; hidePlaceholder?: boolean; hideMissing?: boolean; activeVideos?: any[]; onVideoClicked?: (video: any) => void }) {
  const { t } = useI18n();
  const app = useAppState();
  const multiview = useOptionalMultiviewStore();
  const [live, setLive] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(() => {
    const selectedHomeOrgs = app.selectedHomeOrgs || [];
    if (selectedHomeOrgs.length > 1) return makeMultiOrgTab(selectedHomeOrgs);
    const selectedName = selectedHomeOrgs[0];
    if (selectedName) return (app.orgs || []).find((org: any) => org.name === selectedName) || app.currentOrg || { name: selectedName, short: selectedName.slice(0, 4) };
    return (app.orgs || []).find((org: any) => org.name === "Hololive") || { name: "Hololive", short: "Holo" };
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
  const playlistMenuRoot = useRef<HTMLDivElement | null>(null);

  const activeVideos = activeVideosOverride || multiview?.activeVideos || [];
  const selectedHomeOrgs = app.selectedHomeOrgs || [];
  const selectedHomeOrgsKey = selectedHomeOrgs.join("|");
  const hololiveName = "Hololive";
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
    if (selectedOrg?.name === "MultiOrg") return selectedHomeOrgs.length ? selectedHomeOrgs : [app.currentOrg?.name || "Hololive"];
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
      if (selectedOrg?.name !== "MultiOrg" || selectedOrg.text !== makeMultiOrgLabel(selectedHomeOrgs)) setSelectedOrg(makeMultiOrgTab(selectedHomeOrgs));
    } else if (selectedOrg?.name === "MultiOrg") {
      const selectedName = selectedHomeOrgs[0];
      const org = selectedName ? (app.orgs || []).find((o: any) => o.name === selectedName) || { name: selectedName, short: selectedName.slice(0, 4) } : (app.orgs || []).find((o: any) => o.name === "Hololive") || { name: "Hololive", short: "Holo" };
      setSelectedOrg(org);
    }
  }, [selectedHomeOrgsKey, app.orgs.length]);
  useEffect(() => {
    function onDocClickPlaylist(e: MouseEvent) {
      if (showPlaylistMenu && playlistMenuRoot.current && !playlistMenuRoot.current.contains(e.target as Node)) setShowPlaylistMenu(false);
    }
    document.addEventListener("click", onDocClickPlaylist);
    return () => document.removeEventListener("click", onDocClickPlaylist);
  }, [showPlaylistMenu]);

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
    const targets = isMultiOrg ? selectedOrgNames : [selectedOrg?.name || "Hololive"];
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
    const fallback = (app.orgs || []).find((org: any) => org.name === "Hololive") || { name: "Hololive", short: "Holo" };
    if (unique.length > 1) {
      app.setSelectedHomeOrgs(unique);
      app.setCurrentOrg((app.orgs || []).find((org: any) => org.name === unique[0]) || fallback);
      handlePicker(makeMultiOrgTab(unique));
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
          <button type="button" className={cn("mv-quick-btn inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition", selectedOrg?.name === "Favorites" ? "border-rose-400/40 bg-rose-500/20 text-rose-300" : "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-rose-300")} title="Favorites" onClick={() => handlePicker(favTab)}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d={HEART_SVG_PATH} /></svg>
          </button>
          <button type="button" className={cn("mv-quick-btn inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition", selectedOrg?.name === "Playlist" ? "border-sky-400/40 bg-sky-500/20 text-sky-300" : "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-sky-300")} title="Playlist" onClick={() => handlePicker(playlistTab)}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d={PLAYLIST_SVG_PATH} /></svg>
          </button>
          <form className="relative flex h-8 min-w-[8rem] flex-1 items-center" onSubmit={handleInlineUrl}>
            <input value={inlineUrl} type="url" placeholder="YouTube / Twitch URL…" className={cn("h-8 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-sky-500/50 focus:bg-slate-800", inlineUrlError && "border-amber-400/50", inlineUrl && "rounded-r-none")} onChange={(event) => setInlineUrl(event.target.value)} />
            {inlineUrl ? <button type="submit" className={cn("inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-r-xl border border-l-0 transition", inlineUrlError ? "border-amber-400/30 bg-slate-900 text-amber-400" : "border-sky-400/40 bg-sky-500 text-white hover:brightness-110")} title="Add URL"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></button> : null}
          </form>
          {!isUrl ? <Button type="button" size="icon" variant="secondary" className={`${isLoading ? "refresh-spin " : ""}h-8 w-8 shrink-0 cursor-pointer`} title="Refresh" onClick={() => loadSelection()}><Icon icon={icons.mdiRefresh} /></Button> : null}
        </div>
        <div ref={container} className="video-list min-h-0 flex-1 px-1 sm:px-2">
          {isUrl ? (
            <>
              <div className="px-2 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-sky-200/70">{t("views.multiview.video.addCustomVideo")}</div>
              <CustomUrlField twitch={selectedOrg?.name === "TwitchURL"} onSuccess={handleVideoClick} />
            </>
          ) : selectedOrg?.name === "Favorites" && !isLoggedIn ? (
            <div className="px-3 py-6 text-center">
              <div className="text-sm text-slate-300" dangerouslySetInnerHTML={{ __html: t("views.favorites.promptForAction") }} />
              <Button className="mt-4 favorites-login-button" onClick={() => leaveMultiviewForHome({ openLogin: !isLoggedIn })}>{isLoggedIn ? t("views.favorites.manageFavorites") : t("component.mainNav.login")}</Button>
            </div>
          ) : (
            <>
              {selectedOrg?.name !== "Playlist" ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
                  <Button type="button" size="sm" variant={tab === 0 ? "default" : "ghost"} onClick={() => setTab(0)}>{liveUpcomingLabel}</Button>
                  <Button type="button" size="sm" variant={tab === 1 ? "default" : "ghost"} onClick={() => setTab(1)}>{t("views.home.recentVideoToggles.official")}</Button>
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
          <button type="button" className={cn("mv-quick-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition", selectedOrg?.name === "Favorites" ? "border-rose-400/40 bg-rose-500/20 text-rose-300" : "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-rose-300")} title="Favorites" onClick={() => selectQuickTab(favTab)}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d={HEART_SVG_PATH} /></svg>
          </button>
          <div ref={playlistMenuRoot} className="relative shrink-0 self-center">
            <button type="button" className={cn("mv-quick-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition", selectedOrg?.name === "Playlist" ? "border-sky-400/40 bg-sky-500/20 text-sky-300" : "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-sky-300")} title="Playlist" onClick={(event) => { event.stopPropagation(); setShowPlaylistMenu(!showPlaylistMenu); }}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d={PLAYLIST_SVG_PATH} /></svg>
            </button>
            {showPlaylistMenu ? (
              <Card className="absolute left-0 top-full z-[120] mt-2 min-w-[13rem] border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
                <button type="button" className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/8", selectedOrg?.name === "Playlist" ? "text-sky-300" : "text-[color:var(--color-foreground)]")} onClick={() => { setShowPlaylistMenu(false); selectQuickTab(playlistTab); }}>
                  <svg className="h-4 w-4 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="currentColor"><path d={PLAYLIST_SVG_PATH} /></svg>
                  <span>{t("component.mainNav.playlist")}</span>
                </button>
              </Card>
            ) : null}
          </div>
          <MvUrlInput className="shrink-0 self-center" onSuccess={handleVideoClick} />
          {!isUrl ? <button type="button" className={cn("mv-quick-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--color-foreground)]", isLoading && "refresh-spin")} title="Refresh" onClick={() => loadSelection()}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg></button> : null}
        </>
      ) : null}
      {selectedOrg?.name === "Favorites" && !isLoggedIn ? (
        <div className="flex items-center gap-2 self-center text-sm text-slate-300"><span dangerouslySetInnerHTML={{ __html: t("views.app.loginCallToAction") }} /><Button variant="ghost" size="sm" onClick={() => leaveMultiviewForHome({ openLogin: true })}>{t("component.mainNav.login")}</Button></div>
      ) : (
        <div className={cn("videos-strip min-w-0 flex-1", compact && "compact")} onWheel={scrollHandler}>
          {isLoading && topFilteredLive.length === 0 ? (
            <div className="flex items-center gap-2 px-1">{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="animate-pulse shrink-0 rounded-full bg-white/8" style={{ width: compact ? 34 : 46, height: compact ? 34 : 46 }} />)}</div>
          ) : (
            <div className={cn("mv-video-scroll", compact && "mv-video-scroll-compact")}>
              <div
                ref={videosBar}
                className="scroll-area-viewport mv-video-scroll-vp"
                onScroll={updateHorizontalScrollbar}
              >
                <div className={cn("videos-bar flex min-h-full min-w-full items-center", compact ? "gap-1.5" : "gap-2")}>
                  {topFilteredLive.map((video, index) => (
                    <div key={`${video.id || video.link || "video"}-${index}`} className="group relative flex shrink-0 items-center" title={video.title} draggable onDragStart={(event) => dragVideo(event, video)}>
                      <button type="button" className="relative inline-flex items-center justify-center rounded-full transition-transform group-hover:scale-[1.02]" onClick={() => handleVideoClick(video)}>
                        {video?.link && !compact ? <Badge className="mv-avatar-badge absolute left-0 top-0 z-10 min-w-[20px] justify-center rounded-full px-1 py-0 text-[9px] tracking-normal shadow-md"><Icon icon={mdiTwitch} size="xs" /></Badge> : null}
                        {!compact ? <Badge variant="secondary" className="mv-avatar-badge absolute bottom-[-2px] right-[-2px] z-10 rounded-full px-1.5 py-0 text-[9px] normal-case tracking-normal shadow-md">{formatDurationLive(video)}</Badge> : null}
                        {video.channel?.id ? <ChannelImg channel={video.channel} size={compact ? 28 : 36} noLink className="bg-slate-900/85 ring-1 ring-white/10" /> : <div className="flex items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10" style={{ width: compact ? 28 : 36, height: compact ? 28 : 36 }}><Icon icon={icons.mdiAccountCircleOutline} size="sm" /></div>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {scrollbar.visible ? (
                <div className="mv-scrollbar-track" aria-hidden="true">
                  <div
                    className="mv-scrollbar-thumb"
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
