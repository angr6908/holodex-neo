"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, Calendar, Check, AlarmClock, Music, Plus, TwitchIcon, TwitterIcon, YoutubeIcon, type AnyIcon } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { VideoCardMenu } from "@/components/common/VideoCardMenu";
import { useAppState } from "@/lib/store";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import { useLocale, useTranslations } from "next-intl";
import { absoluteTime, channelDisplayName, formattedDuration, formattedVideoTime, videoImage, videoTitle, viewerCountText } from "@/lib/video-format";
import { cn } from "@/lib/utils";
import { hasWatched as hasWatchedVideo } from "@/lib/browser";
import * as icons from "@/lib/icons";

function externalHref(link = "") {
  if (!link) return "";
  if (/^https?:\/\//i.test(link)) return link;
  return `https://${link.replace(/^\/+/, "")}`;
}

function PlaceholderOverlay({ showOnlyOnHover = false }: { showOnlyOnHover?: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-[2]${showOnlyOnHover ? " opacity-0 transition-opacity duration-300 group-hover:opacity-100" : ""}`}>
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        <svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full">
          <g className="opacity-90 group-hover:animate-pulse" stroke="var(--v-background-darken3)" strokeDasharray="0,20" strokeLinecap="round" strokeWidth="12">
            <line y1={225 * 2 / 10} y2={225 * 8.4 / 10} x1="0" x2="0" />
            <line y1={225 * 2 / 10} y2={225 * 8.4 / 10} x1="400" x2="400" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export function VideoCard({ video, source, fluid = false, includeChannel = false, includeAvatar = false, hideThumbnail = false, horizontal = false, colSize = 1, active = false, disableDefaultClick = false, activePlaylistItem = false, parentPlaylistId = null, denseList = false, inMultiViewSelector = false, onVideoClicked, children, action }: any) {
  const data = source || video;
  const router = useRouter();
  const pathname = usePathname();
  const app = useAppState();
  const multiviewStore = useOptionalMultiviewStore();
  const t = useTranslations();
  const lang = useLocale();
  const [now, setNow] = useState(Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuResetKey, setMenuResetKey] = useState(0);
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
  const shouldHideThumbnail = app.settings.hideThumbnail || hideThumbnail;
  const watchLink = `/watch/${data?.id || ""}${parentPlaylistId ? `?playlist=${parentPlaylistId}` : ""}`;
  const placeholderSourceUrl = isPlaceholder ? externalHref(data?.link || "") : "";
  const titleHref = placeholderSourceUrl || (app.settings.redirectMode ? `https://youtu.be/${data?.id}` : watchLink);
  const showGridAvatar = includeAvatar && ["live", "upcoming"].includes(data?.status) && !denseList && !horizontal && data?.channel;
  const gridAvatarSize = colSize >= 2 ? 42 : colSize >= 1 ? 48 : 56;
  const hasSaved = !!app.playlist.find((v) => v.id === data?.id);
  const tlLang = app.settings.liveTlLang;
  const hasTLs = (data?.status === "past" && data?.live_tl_count?.[tlLang]) || data?.recent_live_tls?.includes?.(tlLang);
  const isClip = data?.type === "clip";
  const isCertain = !isPlaceholder || data?.certainty === "certain";
  const placeholderIconMap: Record<string, AnyIcon> = { event: Calendar, "scheduled-yt-stream": YoutubeIcon, "external-stream": Radio };
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
    if (isPlaceholder) {
      if (placeholderSourceUrl) window.open(placeholderSourceUrl, "_blank", "noopener");
      return;
    }
    setHasWatched(true);
    if (pathname.startsWith("/watch") && app.isMobile) router.replace(watchLink);
    else router.push(watchLink);
  }
  function onThumbnailClicked() {
    if (disableDefaultClick) {
      onVideoClicked?.(data);
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
    preview.style.width = `${rect.width}px`;
    preview.style.height = `${rect.height}px`;
    Object.assign(preview.style, {
      position: "fixed",
      top: "-1000px",
      left: "-1000px",
      pointerEvents: "none",
      zIndex: "9999",
      overflow: "hidden",
      boxShadow: "none",
      transform: "rotate(1.2deg)",
    });
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
  function closeContextMenu() {
    setMenuOpen(false);
    setMenuResetKey((key) => key + 1);
  }
  if (!data) return null;
  const durationText = formattedDuration(data, t, now);
  const timeText = formattedVideoTime(data, lang, t, now);
  const absoluteTimeText = absoluteTime(data, lang);
  const viewerCount = viewerCountText(data, lang);
  const viewerLabel = viewerCount ? t("component.videoCard.watching", { arg0: viewerCount }) : "";
  const hideGridLiveMeta = !horizontal && !denseList && data.status === "live";
  const showChannelViewers = includeChannel && data.status === "live" && !!viewerCount;
  const showViewerBadge = hideGridLiveMeta && !!viewerCount && !showChannelViewers;
  const showTimeMeta = !hideGridLiveMeta;
  const isFlat = horizontal || denseList;
  const articleClass = cn(
    "group relative flex cursor-pointer bg-transparent shadow-none",
    fluid && "w-full",
    active && "before:pointer-events-none before:absolute before:-inset-px before:rounded before:bg-primary/15 before:content-['']",
    dragging && "scale-[0.985] opacity-[0.92]",
    horizontal && "flex-row",
    denseList && "min-h-12 flex-row",
    !isFlat && "flex-col",
  );
  const shellClass = cn(
    "video-card-shell w-full gap-0 overflow-hidden p-0",
    isFlat
      ? "flex flex-row rounded-none border border-transparent bg-transparent shadow-none group-hover:bg-card/55"
      : "flex flex-col rounded-2xl border border-border bg-card shadow-sm transition-colors group-hover:border-primary/30",
    denseList && "min-h-12 border-0",
  );
  const thumbnailClass = cn(
    "relative flex w-full shrink-0 cursor-pointer overflow-hidden rounded-none bg-slate-950/30 text-white",
    horizontal && "my-1.5 ml-1.5 h-[72px] w-[128px] self-center rounded-lg",
    inMultiViewActiveVideos && "grayscale opacity-30",
  );
  const overlayClass = "pointer-events-none absolute inset-0 z-[1] flex h-full w-full flex-col justify-between overflow-hidden rounded-[inherit]";
  const badgeClass = "m-[5px] min-h-[22px] gap-0 rounded border border-primary/25 bg-primary/30 px-[5px] py-0.5 text-center text-[0.8125rem] font-normal leading-none tracking-[0.025em] text-white shadow-sm [&>svg]:size-3.5";
  const liveBadgeClass = "border-white/20 bg-red-900/90 text-white";
  const textClass = cn(
    "video-card-text flex flex-1 flex-row gap-2.5 bg-transparent",
    denseList ? "items-center gap-2 overflow-hidden border-0 py-0 pr-2 pl-1" : horizontal ? "border-0 px-2 py-1.5" : "min-h-[88px] border-t border-border/70 px-2.5 py-2",
    hideGridLiveMeta && "min-h-0 flex-none",
  );
  const linesClass = cn(
    "flex min-w-0 flex-1",
    denseList ? "flex-row flex-nowrap items-center gap-2.5" : "flex-col",
    horizontal && "justify-around",
  );
  const titleWrapClass = cn(
    "min-h-0",
    denseList ? "m-0 min-w-0 flex-1 overflow-hidden" : "flex-none",
    isSingleLineTitle && !isFlat && "h-10",
  );
  const titleClass = cn(
    "select-text text-left no-underline transition-colors",
    denseList ? "block w-full truncate text-sm leading-[1.3]" : "line-clamp-2 max-h-10 cursor-pointer break-words leading-5 hyphens-auto",
    hasWatched && "text-primary/70 opacity-60",
    inMultiViewActiveVideos && "grayscale opacity-30",
  );
  const metaClass = cn(
    "min-h-0 flex-1",
    denseList ? "m-0 flex flex-none flex-row items-center gap-3" : "mt-0.5 flex flex-col [&>div]:mb-0.5",
    hideGridLiveMeta && "[&>div]:mb-0",
    isSingleLineTitle && !isFlat && "flex-none",
  );
  const channelSlotClass = cn(
    "flex min-w-0 items-center gap-2",
    denseList ? "max-w-[min(220px,28vw)] flex-[0_1_220px] overflow-hidden" : "min-h-0 flex-1 justify-between",
    isSingleLineTitle && !isFlat && "flex-none pt-0",
  );
  const timeClass = cn("flex min-h-4 flex-none items-center gap-1 overflow-hidden text-sm leading-tight text-muted-foreground", denseList && "min-w-20 whitespace-nowrap");
  const itemActionsClass = cn(
    "video-card-item-actions flex items-center gap-1 bg-inherit [&>button]:inline-flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:p-1.5 [&>button]:text-foreground [&>button]:transition-colors [&>button:hover]:bg-white/10",
    denseList ? "h-auto self-stretch border-l border-border/70 px-2 py-0" : "border-t border-border/70 px-3 py-2",
  );
  return (
    <article className={articleClass} draggable={!dragSelectionLocked} onMouseDownCapture={(event) => setDragSelectionLocked(shouldSuppressDrag(event.target))} onDragStart={drag} onDragEnd={handleDragEnd} onClick={(e) => { if ((e.target as HTMLElement).closest("a,button")) return; if (shouldIgnoreTextClick(e)) return; goToVideo(); }}>
      <ContextMenu key={menuResetKey} onOpenChange={setMenuOpen}>
        <ContextMenuTrigger render={<Card className={shellClass} />}>
          {!denseList ? <div style={horizontal && !shouldHideThumbnail ? { background: `url(${imageSrc}) center/cover` } : undefined} className={thumbnailClass}>
          <Button type="button" variant="ghost" className="absolute inset-0 z-0 h-full w-full rounded-none border-0 bg-transparent p-0 text-transparent hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary" onClick={(e) => { e.stopPropagation(); onThumbnailClicked(); }}>
            <span className="sr-only">{title}</span>
          </Button>
          {isPlaceholder && data.status === "upcoming" && data.placeholderType ? <PlaceholderOverlay showOnlyOnHover={false} /> : null}
          <div className={overlayClass}>
            <div className="flex items-start justify-between"><div>{data.topic_id && !isClip ? <Badge variant="outline" className="m-1.5 min-h-[22px] max-w-full gap-0 truncate rounded border-white/20 bg-slate-950/85 px-[5px] py-0.5 text-center text-[0.8125rem] font-normal capitalize leading-none tracking-[0.025em] text-white shadow-sm">{data.topic_id}</Badge> : null}</div>{!isPlaceholder ? <Button type="button" variant="ghost" size="icon-xs" className="pointer-events-auto m-1 size-6 cursor-pointer rounded-lg border border-white/60 bg-black/40 p-0 text-slate-50 transition-colors hover:border-white/80 hover:bg-black/60 hover:text-slate-50 dark:hover:bg-black/60" onClick={(e) => { e.preventDefault(); e.stopPropagation(); hasSaved ? app.removeFromPlaylist(data.id) : app.addToPlaylist(data); }}>{hasSaved ? <Check className="size-4 text-slate-50" /> : <Plus className="size-4 text-slate-50" />}</Button> : null}</div>
            <div className="flex min-w-0 items-end justify-between gap-2">
              <div className="min-w-0 flex-1">{showViewerBadge ? <Badge variant="outline" className={cn(badgeClass, liveBadgeClass, "gap-1 rounded-full")} title={viewerLabel}><Radio className="size-3.5 text-white" />{viewerCount}</Badge> : null}</div>
              {!isPlaceholder ? <div className="flex flex-col items-end">{data.songcount ? <Badge variant="outline" className={badgeClass} title={t("component.videoCard.totalSongs")}>{data.songcount > 1 ? data.songcount : ""}<Music className="h-3.5 w-3.5 text-white" /></Badge> : null}{hasTLs ? <Badge variant="outline" className={badgeClass} title={data.status === "past" ? t("component.videoCard.totalTLs") : t("component.videoCard.tlPresence")}>{data.status === "past" ? data.live_tl_count?.[app.settings.liveTlLang || "en"] : ""}<icons.TlChatIcon className="h-3.5 w-3.5 text-white" /></Badge> : null}{(data.duration > 0 || data.start_actual) ? <Badge variant="outline" className={cn(badgeClass, data.status === "live" && liveBadgeClass)}>{durationText}</Badge> : null}</div> : <div className="flex flex-col items-end"><Badge variant="outline" className={cn(badgeClass, data.status === "live" && liveBadgeClass, "[&>svg]:size-4")}>{durationText ? <span className="inline-block leading-[13px] group-hover:hidden">{durationText}</span> : null}{data.placeholderType === "scheduled-yt-stream" ? <span className="hidden leading-[13px] group-hover:inline-block">{t("component.videoCard.typeScheduledYT")}</span> : data.placeholderType === "external-stream" ? <span className="hidden leading-[13px] group-hover:inline-block">{t("component.videoCard.typeExternalStream")}</span> : data.placeholderType === "event" ? <span className="hidden leading-[13px] group-hover:inline-block">{t("component.videoCard.typeEventPlaceholder")}</span> : null}{(() => { const C = twitchPlaceholder ? TwitchIcon : twitterPlaceholder ? TwitterIcon : placeholderIconMap[data.placeholderType]; return <C className="h-4 w-4 rounded-sm" />; })()}</Badge></div>}
            </div>
          </div>
          {!horizontal && !shouldHideThumbnail ? <img src={imageSrc} width="100%" loading="lazy" decoding="async" className={cn("pointer-events-none aspect-video w-full object-cover", data.placeholderType === "scheduled-yt-stream" && "opacity-60 group-hover:opacity-100")} alt="" /> : !horizontal && shouldHideThumbnail ? <div className="pointer-events-none aspect-[60/9] w-full bg-white/6" /> : null}
        </div> : null}
        <div className={textClass}>
          {(denseList && data.channel) || showGridAvatar ? <div className={cn("mx-2 flex self-center flex-col", showGridAvatar && !denseList && "mx-0 [&_.rounded]:shadow-sm [&_img]:shadow-sm")}><Button type="button" variant="ghost" className="h-auto w-auto p-0 hover:bg-transparent" title={channelName} onClick={(e) => { e.stopPropagation(); goToChannel(); }}><ChannelImg channel={data.channel} rounded size={showGridAvatar && !denseList ? gridAvatarSize : undefined} noLink /></Button></div> : null}
          <div className={linesClass}>
            <div className={titleWrapClass}><Link ref={titleButton} href={titleHref} className={titleClass} title={title} style={{ fontSize: `${1 - app.currentGridSize / 16}rem` }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (shouldIgnoreTextClick(e)) return; goToVideo(); }}>{!isCertain ? <AlarmClock className="size-5 mr-1 inline-block h-[18px] w-[18px] align-text-bottom text-amber-400" aria-label={t("component.videoCard.uncertainPlaceholder")} /> : null}{title}</Link></div>
            <div className={metaClass}>
              {includeChannel ? (
                <div className={channelSlotClass}>
                  <div className="min-w-0 overflow-hidden truncate text-sm leading-tight text-muted-foreground">
                    <Button type="button" variant="ghost" className={cn("h-auto max-w-full justify-start truncate p-0 text-left font-normal text-muted-foreground underline-offset-4 hover:bg-transparent hover:text-foreground hover:underline", denseList && "max-w-[150px]", (data.type === "stream" || data.channel?.type === "vtuber") && "text-[#42a5f5]")} title={channelTitle} onClick={(e) => { e.stopPropagation(); if (shouldIgnoreTextClick(e)) return; goToChannel(); }}>{channelName}</Button>
                  </div>
                  {showChannelViewers ? <span className="ml-auto inline-flex flex-none items-center gap-1 whitespace-nowrap text-[0.8125rem] leading-none tracking-[0.025em] text-muted-foreground tabular-nums" title={viewerLabel}><Radio className="size-3.5" />{viewerCount}</span> : null}
                </div>
              ) : null}
              {showTimeMeta ? <div className={timeClass}><span className={cn("inline-block min-w-0 max-w-full flex-auto overflow-hidden text-ellipsis whitespace-nowrap", data.status === "live" && "font-medium text-red-500")} title={absoluteTimeText}>{timeText}</span>{data.clips?.length && !isPlaceholder ? <span className="flex-none whitespace-nowrap text-[color:var(--color-primary)]"> • {t("component.videoCard.clips", { n: typeof data.clips === "object" ? data.clips.length : +data.clips })}</span> : data.status === "live" && viewerLabel && !showChannelViewers ? <span className="flex-none whitespace-nowrap text-muted-foreground"> • {viewerLabel}</span> : null}</div> : null}
            </div>
          </div>
        </div>
        </ContextMenuTrigger>
        {menuOpen ? (
          <ContextMenuContent className="z-[500] w-[260px] rounded-2xl border-border p-2 shadow-2xl">
            <VideoCardMenu video={data} close={closeContextMenu} />
          </ContextMenuContent>
        ) : null}
      </ContextMenu>
      {(children || action || activePlaylistItem) ? <div className={itemActionsClass}>{activePlaylistItem ? <><Button type="button" variant="ghost" size="icon-xs" className="rounded-full p-1.5 text-foreground hover:bg-white/10" onClick={(event) => { event.stopPropagation(); event.preventDefault(); move("up"); }}><icons.ChevronUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon-xs" className="rounded-full p-1.5 text-foreground hover:bg-white/10" onClick={(event) => { event.stopPropagation(); event.preventDefault(); app.removeFromPlaylist(data.id); }}><icons.Trash2 className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon-xs" className="rounded-full p-1.5 text-foreground hover:bg-white/10" onClick={(event) => { event.stopPropagation(); event.preventDefault(); move("down"); }}><icons.ChevronDown className="h-4 w-4" /></Button></> : action || children}</div> : null}
    </article>
  );
}
