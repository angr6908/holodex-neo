"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { mdiBroadcast, mdiCalendar, mdiCheck, mdiClockAlertOutline, mdiMusic, mdiPlus, mdiTwitch, mdiTwitter, mdiYoutube } from "@mdi/js";
import { Icon } from "@/components/ui/Icon";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { PlaceholderOverlay } from "@/components/video/PlaceholderOverlay";
import { PlaceholderCard } from "@/components/video/PlaceholderCard";
import { VideoCardMenu } from "@/components/common/VideoCardMenu";
import { useAppState } from "@/lib/store";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import { useI18n } from "@/lib/i18n";
import { absoluteTime, channelDisplayName, formattedDuration, formattedVideoTime, videoImage, videoTitle, viewerText } from "@/lib/video-format";
import { cn } from "@/lib/cn";
import { hasWatched as hasWatchedVideo } from "@/lib/history";
import * as icons from "@/lib/icons";

export function VideoCard({ video, source, fluid = false, includeChannel = false, includeAvatar = false, hideThumbnail = false, horizontal = false, colSize = 1, active = false, disableDefaultClick = false, activePlaylistItem = false, parentPlaylistId = null, denseList = false, inMultiViewSelector = false, onVideoClicked, children, action }: any) {
  const data = source || video;
  const router = useRouter();
  const pathname = usePathname();
  const app = useAppState();
  const multiviewStore = useOptionalMultiviewStore();
  const { t, lang } = useI18n();
  const [now, setNow] = useState(Date.now());
  const [showMenu, setShowMenu] = useState(false);
  const [placeholderOpen, setPlaceholderOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [hasWatched, setHasWatched] = useState(false);
  const [dragSelectionLocked, setDragSelectionLocked] = useState(false);
  const [isSingleLineTitle, setIsSingleLineTitle] = useState(false);
  const titleButton = useRef<HTMLAnchorElement | null>(null);
  const titleResizeObserver = useRef<ResizeObserver | null>(null);
  const dragPreviewEl = useRef<HTMLElement | null>(null);
  useEffect(() => { if (data?.status !== "live") return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [data?.status]);
  useEffect(() => {
    let cancelled = false;
    setHasWatched(false);
    if (data?.id) hasWatchedVideo(data.id).then((watched) => { if (!cancelled && watched) setHasWatched(true); }).catch(console.error);
    return () => { cancelled = true; };
  }, [data?.id]);
  useEffect(() => {
    window.addEventListener("mouseup", releaseDragLock);
    return () => {
      window.removeEventListener("mouseup", releaseDragLock);
      cleanupDragPreview();
    };
  }, []);
  const isPlaceholder = data?.type === "placeholder";
  const title = videoTitle(data, app.settings.useEnglishName);
  const imageSrc = videoImage(data, { horizontal, colSize, forceJpg: true });
  const channelName = channelDisplayName(data?.channel, app.settings.useEnglishName);
  const shouldHideThumbnail = app.settings.hideThumbnails || hideThumbnail;
  const watchLink = `/watch/${data?.id || ""}${parentPlaylistId ? `?playlist=${parentPlaylistId}` : ""}`;
  const titleHref = isPlaceholder && data?.placeholderType === "external-stream" && data?.link ? data.link : app.settings.redirectMode ? `https://youtu.be/${data?.id}` : watchLink;
  const showGridAvatar = includeAvatar && ["live", "upcoming"].includes(data?.status) && !denseList && !horizontal && data?.channel;
  const gridAvatarSize = colSize >= 2 ? 42 : colSize >= 1 ? 48 : 56;
  const hasSaved = !!app.playlist.find((v) => v.id === data?.id);
  const tlLang = app.settings.liveTlLang;
  const hasTLs = (data?.status === "past" && data?.live_tl_count?.[tlLang]) || data?.recent_live_tls?.includes?.(tlLang);
  const isClip = data?.type === "clip";
  const isCertain = !isPlaceholder || data?.certainty === "certain";
  const placeholderIconMap: Record<string, string> = { event: mdiCalendar, "scheduled-yt-stream": mdiYoutube, "external-stream": mdiBroadcast };
  const twitchPlaceholder = data?.link?.includes("twitch.tv");
  const twitterPlaceholder = data?.link?.includes("/i/spaces/");
  const inMultiViewActiveVideos = !!(
    inMultiViewSelector &&
    multiviewStore?.activeVideos?.some((video: any) => video.id === data?.id)
  );
  const channelTitle = data?.channel ? `${data.channel.name || ""}${data.channel.english_name ? `\nEN: ${data.channel.english_name}` : ""}${data.channel.org ? `\n> ${data.channel.org}` : ""}${data.channel.group ? `\n> ${data.channel.group}` : ""}` : channelName;

  const updateTitleLineState = useCallback(() => {
    const el = titleButton.current;
    if (!el || horizontal || denseList) {
      setIsSingleLineTitle(false);
      return;
    }
    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight || "0");
    if (!lineHeight) {
      setIsSingleLineTitle(false);
      return;
    }
    const titleHeight = el.getBoundingClientRect().height;
    setIsSingleLineTitle(titleHeight <= lineHeight * 1.45);
  }, [denseList, horizontal]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !titleButton.current || horizontal || denseList) {
      updateTitleLineState();
      return;
    }
    titleResizeObserver.current?.disconnect();
    const observer = new ResizeObserver(updateTitleLineState);
    titleResizeObserver.current = observer;
    observer.observe(titleButton.current);
    requestAnimationFrame(updateTitleLineState);
    return () => {
      observer.disconnect();
      if (titleResizeObserver.current === observer) titleResizeObserver.current = null;
    };
  }, [title, horizontal, denseList, app.currentGridSize, updateTitleLineState]);

  function openPlaceholder() { setPlaceholderOpen(true); }
  function onImgMounted(el: HTMLImageElement | null) {
    if (!el || el.dataset.fadeInit) return;
    el.dataset.fadeInit = "1";
    if (el.complete && el.naturalHeight > 0) {
      el.classList.add("loaded");
    } else {
      el.classList.add("img-pending");
      el.dataset.fadeReady = "1";
    }
  }
  function onImgLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    if (!img.dataset.fadeReady) {
      img.classList.add("loaded");
      return;
    }
    img.classList.add("loaded");
  }
  function shouldIgnoreTextClick(event: any) {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return false;
    const currentTarget = event?.currentTarget;
    if (!(currentTarget instanceof Element) || selection.rangeCount === 0) return true;
    const commonAncestor = selection.getRangeAt(0).commonAncestorContainer;
    const selectionRoot = commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentElement : commonAncestor;
    return !selectionRoot || currentTarget.contains(selectionRoot);
  }
  function goToVideo() {
    onVideoClicked?.(data);
    if (disableDefaultClick) return;
    if (isPlaceholder && data?.placeholderType === "external-stream" && data?.link) { window.open(data.link, "_blank", "noopener"); return; }
    if (isPlaceholder) { openPlaceholder(); return; }
    setHasWatched(true);
    if (pathname.startsWith("/watch") && app.isMobile) router.replace(watchLink);
    else router.push(watchLink);
  }
  function onThumbnailClicked() {
    if (disableDefaultClick) {
      onVideoClicked?.(data);
      return;
    }
    if (isPlaceholder && data?.placeholderType === "external-stream" && data?.link) {
      onVideoClicked?.(data);
      window.open(data.link, "_blank", "noopener");
      return;
    }
    if (isPlaceholder) {
      goToVideo();
      return;
    }
    if (app.settings.redirectMode) {
      onVideoClicked?.(data);
      window.open(`https://youtu.be/${data.id}`, "_blank", "noopener");
      return;
    }
    goToVideo();
  }
  function goToChannel() {
    onVideoClicked?.(data);
    if (disableDefaultClick) return;
    router.push(`/channel/${data.channel.id}`);
  }
  function openContextMenu(e: React.MouseEvent) { e.preventDefault(); setMenuPos({ x: e.clientX, y: e.clientY }); setShowMenu(true); }
  function shouldSuppressDrag(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return !!target.closest(".video-card-text, .video-card-item-actions");
  }
  function releaseDragLock() { setDragSelectionLocked(false); }
  function cleanupDragPreview() {
    dragPreviewEl.current?.remove();
    dragPreviewEl.current = null;
  }
  function drag(ev: React.DragEvent) {
    if (dragSelectionLocked || shouldSuppressDrag(ev.target)) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer.setData("text", `https://holodex.net/watch/${data.id}`);
    ev.dataTransfer.setData("application/json", JSON.stringify(data));
    ev.dataTransfer.effectAllowed = "copyMove";
    setDragging(true);
    const cardShell = (ev.currentTarget as Element)?.querySelector?.(".video-card-shell");
    if (!(cardShell instanceof HTMLElement) || !ev.dataTransfer.setDragImage) return;
    cleanupDragPreview();
    const preview = cardShell.cloneNode(true) as HTMLElement;
    const rect = cardShell.getBoundingClientRect();
    preview.classList.add("video-card-drag-preview");
    preview.style.width = `${rect.width}px`;
    preview.style.height = `${rect.height}px`;
    document.body.appendChild(preview);
    dragPreviewEl.current = preview;
    ev.dataTransfer.setDragImage(preview, Math.min(rect.width / 2, 120), Math.min(rect.height / 2, 90));
  }
  function handleDragEnd() {
    setDragging(false);
    releaseDragLock();
    cleanupDragPreview();
  }
  function move(direction: "up" | "down") {
    const curIdx = app.playlist.findIndex((elem: any) => elem.id === data.id);
    if (curIdx < 0) return;
    const toIdx = direction === "up" ? curIdx - 1 : curIdx + 1;
    if (toIdx < 0 || toIdx >= app.playlist.length) return;
    app.reorderPlaylist({ from: curIdx, to: toIdx });
  }
  if (!data) return null;
  const durationText = formattedDuration(data, t, now);
  const timeText = formattedVideoTime(data, lang, t, now);
  const absoluteTimeText = absoluteTime(data, lang);
  const viewersText = viewerText(data, lang);
  return (
    <article className={cn("video-card no-decoration flex", fluid && "video-card-fluid", active && "video-card-active", dragging && "video-card-dragging", horizontal && "video-card-horizontal", denseList && "video-card-list", inMultiViewActiveVideos && "video-card-multiview-active", !horizontal && !denseList && "flex-col")} draggable={!dragSelectionLocked} style={{ position: "relative" }} onMouseDownCapture={(event) => setDragSelectionLocked(shouldSuppressDrag(event.target))} onDragStart={drag} onDragEnd={handleDragEnd} onClick={(e) => { if ((e.target as HTMLElement).closest("a,button")) return; if (shouldIgnoreTextClick(e)) return; goToVideo(); }}>
      <div className="video-card-shell w-full overflow-hidden border border-[color:var(--color-border)] p-0">
        {!denseList ? <div style={{ position: "relative", width: "100%", ...(horizontal && !shouldHideThumbnail ? { background: `url(${imageSrc}) center/cover` } : {}) }} className="video-thumbnail text-white rounded flex-shrink-0 flex cursor-pointer overflow-hidden" role="link" tabIndex={0} onClick={(e) => { e.stopPropagation(); onThumbnailClicked(); }} onContextMenu={openContextMenu} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onThumbnailClicked(); } }}>
          {isPlaceholder && data.status === "upcoming" && data.placeholderType ? <PlaceholderOverlay width={200} height={150} showOnlyOnHover={false} /> : null}
          <div className="video-card-overlay flex justify-between flex-col" style={{ height: "100%", position: "absolute", width: "100%", zIndex: 1 }}>
            <div className="flex justify-between items-start"><div>{data.topic_id && !isClip ? <div className="video-topic">{data.topic_id}</div> : null}</div>{!isPlaceholder ? <button type="button" className="video-card-action" onClick={(e) => { e.preventDefault(); e.stopPropagation(); hasSaved ? app.removeFromPlaylist(data.id) : app.addToPlaylist(data); }}><Icon icon={hasSaved ? mdiCheck : mdiPlus} className="h-4 w-4 video-card-action-icon-unsaved" /></button> : null}</div>
            {!isPlaceholder ? <div className="flex flex-col items-end">{data.songcount ? <div className="video-duration flex items-center" title={t("component.videoCard.totalSongs")}>{data.songcount > 1 ? data.songcount : ""}<Icon icon={mdiMusic} className="h-3.5 w-3.5 text-white" /></div> : null}{hasTLs ? <div className="video-duration flex items-center" title={data.status === "past" ? t("component.videoCard.totalTLs") : t("component.videoCard.tlPresence")}>{data.status === "past" ? data.live_tl_count?.[app.settings.tlLangs?.[0] || "en"] : ""}<Icon icon={icons.tlChat} className="h-3.5 w-3.5 text-white" /></div> : null}{(data.duration > 0 || data.start_actual) ? <div className={cn("video-duration", data.status === "live" && "video-duration-live")}>{durationText}</div> : null}</div> : <div className="flex flex-col items-end"><div className={cn("video-duration", data.status === "live" && "video-duration-live")}>{durationText ? <span className="duration-placeholder">{durationText}</span> : null}{data.placeholderType === "scheduled-yt-stream" ? <span className="hover-placeholder">{t("component.videoCard.typeScheduledYT")}</span> : data.placeholderType === "external-stream" ? <span className="hover-placeholder">{t("component.videoCard.typeExternalStream")}</span> : data.placeholderType === "event" ? <span className="hover-placeholder">{t("component.videoCard.typeEventPlaceholder")}</span> : null}<Icon className="h-4 w-4 rounded-sm" icon={twitchPlaceholder ? mdiTwitch : twitterPlaceholder ? mdiTwitter : placeholderIconMap[data.placeholderType]} /></div></div>}
          </div>
          {!horizontal && !shouldHideThumbnail ? <img ref={onImgMounted} src={imageSrc} width="100%" loading="lazy" decoding="async" className={cn("aspect-video w-full object-cover img-fade-in", data.placeholderType === "scheduled-yt-stream" && "hover-opacity")} alt="" onLoad={onImgLoad} /> : !horizontal && shouldHideThumbnail ? <div className="aspect-[60/9] w-full bg-white/6" /> : null}
        </div> : null}
        <div className={cn("video-card-text no-decoration", isSingleLineTitle && !horizontal && !denseList && "video-card-text-single-line")}>
          {(denseList && data.channel) || showGridAvatar ? <div className={cn("video-card-avatar-slot flex self-center mx-2 flex-col", showGridAvatar && !denseList && "video-card-avatar-slot--grid")}><button type="button" className="plain-button inline-flex items-center" title={channelName} onClick={(e) => { e.stopPropagation(); goToChannel(); }}><ChannelImg channel={data.channel} rounded size={showGridAvatar && !denseList ? gridAvatarSize : undefined} noLink /></button></div> : null}
          <div className={cn("flex video-card-lines flex-col", isSingleLineTitle && !horizontal && !denseList && "video-card-lines-single-line")}>
            <div className={cn("video-card-title-wrap", !horizontal && !denseList && !isSingleLineTitle && "video-card-title-wrap-default")}><Link ref={titleButton} href={titleHref} className={cn("plain-button video-card-title text-left", hasWatched && "video-watched")} title={title} style={{ userSelect: "text", fontSize: `${1 - app.currentGridSize / 16}rem` }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (shouldIgnoreTextClick(e)) return; goToVideo(); }}>{!isCertain ? <Icon icon={mdiClockAlertOutline} className="mr-1 inline-block h-[18px] w-[18px] align-text-bottom text-amber-400" title={t("component.videoCard.uncertainPlaceholder")} /> : null}{title}</Link></div>
            <div className="video-card-meta">{includeChannel ? <div className="video-card-channel-slot"><div className="channel-name video-card-subtitle"><button type="button" className={cn("plain-button no-decoration text-left", (data.type === "stream" || data.channel?.type === "vtuber") && "name-vtuber")} style={{ userSelect: "text" }} title={channelTitle} onClick={(e) => { e.stopPropagation(); if (shouldIgnoreTextClick(e)) return; goToChannel(); }}>{channelName}</button></div></div> : null}<div className="video-card-subtitle video-card-time"><span className={cn("video-card-time-primary", `text-${data.status}`)} title={absoluteTimeText}>{timeText}</span>{data.clips?.length && !isPlaceholder ? <span className="video-card-time-secondary text-[color:var(--color-primary)]"> • {t("component.videoCard.clips", typeof data.clips === "object" ? data.clips.length : +data.clips)}</span> : data.status === "live" && viewersText ? <span className="video-card-time-secondary live-viewers"> {viewersText}</span> : null}</div></div>
          </div>
        </div>
        {showMenu ? <div className="fixed inset-0 z-[500] outline-none" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} onContextMenu={(e) => { e.preventDefault(); setShowMenu(false); }} onKeyDown={(e) => { if (e.key === "Escape") setShowMenu(false); }}><div className="video-card-menu-shell absolute w-[260px] rounded-2xl p-2" style={{ left: Math.max(8, Math.min(menuPos.x, window.innerWidth - 268)), top: Math.max(8, Math.min(menuPos.y, window.innerHeight - 408)) }} onClick={(e) => e.stopPropagation()}><VideoCardMenu video={data} close={() => setShowMenu(false)} /></div></div> : null}
      </div>
      {(children || action || activePlaylistItem) ? <div className="video-card-item-actions">{activePlaylistItem ? <><button type="button" onClick={(event) => { event.stopPropagation(); event.preventDefault(); move("up"); }}><Icon icon={icons.mdiChevronUp} className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); event.preventDefault(); app.removeFromPlaylist(data.id); }}><Icon icon={icons.mdiDelete} className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); event.preventDefault(); move("down"); }}><Icon icon={icons.mdiChevronDown} className="h-4 w-4" /></button></> : action || children}</div> : null}
      {isPlaceholder ? <PlaceholderCard open={placeholderOpen} video={data} onOpenChange={setPlaceholderOpen} /> : null}
    </article>
  );
}
