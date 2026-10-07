"use client";

import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { VideoCardMenu } from "@/components/common/VideoCardMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { hasWatchedSync, hasWatched as hasWatchedVideo } from "@/lib/browser";
import * as icons from "@/lib/icons";
import {
  AlarmClock,
  type AnyIcon,
  BroadcastIcon,
  Calendar,
  Check,
  Clock,
  Music,
  Plus,
  Radio,
  TwitchIcon,
  TwitterIcon,
  YoutubeIcon,
} from "@/lib/icons";
import { preloadImage } from "@/lib/image-preload";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  absoluteTime,
  channelDisplayName,
  compactVideoTime,
  formattedDuration,
  videoImage,
  videoTitle,
  viewerCountText,
} from "@/lib/video-format";
import { preloadWatchPlayer, preloadWatchVideo, warmWatchPageWhenIdle } from "@/lib/watch-preload";

function externalHref(link = "") {
  if (!link) return "";
  return /^https?:\/\//i.test(link) ? link : `https://${link.replace(/^\/+/, "")}`;
}

// Renders the live elapsed-duration badge text with its own 1s ticker so the rest
// of the card never re-renders as the clock advances.
function TickingDuration({ video, t }: { video: any; t: any }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formattedDuration(video, t, now)}</>;
}

// Renders the upcoming-stream countdown with its own ticker so the rest of the
// card never re-renders (and never flickers) as the time updates.
function TickingCompactTime({ video, lang }: { video: any; lang: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const text = compactVideoTime(video, lang, now);
  // Once an upcoming stream is overdue, compactVideoTime yields "soon"; accent it
  // so the imminent state reads at a glance, coherent with how live draws the eye.
  if (text === "soon") return <span className="font-medium text-primary">{text}</span>;
  return <>{text}</>;
}

// Where a click / open-in-new-tab goes. "Open on Holodex" on (redirectMode off) sends
// youtube videos and twitch streams to the Holodex watch page; off sends them to their
// source (youtu.be / twitch.tv). Other placeholders only ever have their external source.
function videoCardLinks(data: any, redirectMode: boolean, parentPlaylistId: string | null) {
  const isPlaceholder = data?.type === "placeholder";
  const watchLink = `/watch/${data?.id || ""}${parentPlaylistId ? `?playlist=${parentPlaylistId}` : ""}`;
  const isTwitch = data?.type === "twitch" || (data?.link || "").includes("twitch");
  const externalUrl =
    isPlaceholder || isTwitch
      ? externalHref(data?.link || (isTwitch ? `twitch.tv/${data?.id}` : ""))
      : `https://youtu.be/${data?.id}`;
  const watchableOnHolodex = !isPlaceholder || isTwitch;
  const openExternal = redirectMode || !watchableOnHolodex;
  return {
    watchLink,
    externalUrl,
    openExternal,
    titleHref: openExternal ? externalUrl : watchLink,
  };
}

// Hover title for the channel name: its name, English name, org and group on separate lines.
function channelTooltip(channel: any, channelName: string) {
  if (!channel) return channelName;
  return `${channel.name || ""}${channel.english_name ? `\nEN: ${channel.english_name}` : ""}${channel.org ? `\n> ${channel.org}` : ""}${channel.group ? `\n> ${channel.group}` : ""}`;
}

// Count only clips in the user's selected clip languages (same filter as the watch page's
// clips tab); some endpoints return clips in every language.
function clipsInLangCount(data: any, clipLangs: string[]) {
  if (data.type === "placeholder" || !Array.isArray(data.clips)) return 0;
  const langs = new Set<string>(clipLangs);
  return data.clips.filter((clip: any) => clip.status !== "missing" && langs.has(clip.lang)).length;
}

// Past streams with TLs in the user's language, or live/upcoming ones with recent TLs.
function hasTlsFor(data: any, tlLang: string) {
  return (
    (data?.status === "past" && data?.live_tl_count?.[tlLang]) ||
    data?.recent_live_tls?.includes?.(tlLang)
  );
}

// Time, viewer and duration texts shared by the thumbnail badges and the meta row.
function videoCardTimes(data: any, lang: string, t: any, displayStartTime: boolean) {
  const viewerCount = viewerCountText(data, lang);
  return {
    durationText: formattedDuration(data, t),
    compactTimeText: compactVideoTime(data, lang, undefined, displayStartTime),
    absoluteTimeText: absoluteTime(data, lang, displayStartTime),
    viewerCount,
    viewerLabel: viewerCount ? t("component.videoCard.watching", { arg0: viewerCount }) : "",
  };
}

type VideoCardTimes = ReturnType<typeof videoCardTimes>;

const placeholderIconMap: Record<string, AnyIcon> = {
  event: Calendar,
  "scheduled-yt-stream": YoutubeIcon,
  "external-stream": Radio,
};

function placeholderIcon(data: any) {
  if (data.link?.includes("twitch.tv")) return TwitchIcon;
  if (data.link?.includes("/i/spaces/")) return TwitterIcon;
  return placeholderIconMap[data.placeholderType];
}

// Placeholders flag whether their time is confirmed.
function isCertainVideo(data: any) {
  return data.type !== "placeholder" || data.certainty === "certain";
}

// Videos already in the multiview layout are greyed out in its selector.
function inMultiviewLayout(activeVideos: any[] | undefined, id: string | undefined) {
  return !!activeVideos?.some((video: any) => video.id === id);
}

// A click on selected text keeps the selection instead of navigating.
function shouldIgnoreTextClick(event: any) {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return false;
  const currentTarget = event?.currentTarget;
  if (!(currentTarget instanceof Element) || selection.rangeCount === 0) return true;
  const commonAncestor = selection.getRangeAt(0).commonAncestorContainer;
  const selectionRoot =
    commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentElement : commonAncestor;
  return !selectionRoot || currentTarget.contains(selectionRoot);
}

// Dragging from the text or the item actions selects text instead of moving the card.
function shouldSuppressDrag(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !!target.closest(".video-card-text, .video-card-item-actions");
}

function articleClassFor({
  fluid,
  active,
  dragging,
  horizontal,
  denseList,
}: {
  fluid: boolean;
  active: boolean;
  dragging: boolean;
  horizontal: boolean;
  denseList: boolean;
}) {
  return cn(
    "group relative flex cursor-pointer [&_a]:cursor-pointer [&_button]:cursor-pointer",
    fluid && "w-full",
    active && "outline outline-ring",
    dragging && "opacity-70",
    horizontal && "flex-row",
    denseList && "min-h-12 flex-row",
    !(horizontal || denseList) && "flex-col",
  );
}

// Watched videos dim their title; the stored flag is read synchronously first, then confirmed
// from the async store.
function useHasWatched(id: string | undefined) {
  const [hasWatched, setHasWatched] = useState(() => hasWatchedSync(id));
  useEffect(() => {
    let cancelled = false;
    const initial = hasWatchedSync(id);
    setHasWatched(initial);
    if (!initial && id)
      hasWatchedVideo(id)
        .then((watched) => {
          if (!cancelled && watched) setHasWatched(true);
        })
        .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [id]);
  return [hasWatched, setHasWatched] as const;
}

function removeDragPreview(preview: React.RefObject<HTMLElement | null>) {
  preview.current?.remove();
  preview.current = null;
}

// Cards drag out as the video (URL + JSON) with a tilted copy of the card as the drag image.
function useCardDrag(data: any) {
  const [dragging, setDragging] = useState(false);
  const [dragSelectionLocked, setDragSelectionLocked] = useState(false);
  const dragPreviewEl = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const releaseDragLock = () => setDragSelectionLocked(false);
    window.addEventListener("mouseup", releaseDragLock);
    return () => {
      window.removeEventListener("mouseup", releaseDragLock);
      removeDragPreview(dragPreviewEl);
    };
  }, []);
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
    removeDragPreview(dragPreviewEl);
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
    ev.dataTransfer.setDragImage(
      preview,
      Math.min(rect.width / 2, 120),
      Math.min(rect.height / 2, 90),
    );
  }
  return {
    dragging,
    dragProps: {
      draggable: !dragSelectionLocked,
      onMouseDownCapture: (event: React.MouseEvent) =>
        setDragSelectionLocked(shouldSuppressDrag(event.target)),
      onDragStart: drag,
      onDragEnd: () => {
        setDragging(false);
        setDragSelectionLocked(false);
        removeDragPreview(dragPreviewEl);
      },
    },
  };
}

// Hover long enough to skip cards the pointer only passes over.
const HOVER_PREFETCH_DELAY_MS = 80;
// A touch that starts a scroll is cancelled within this time; one that holds still is a tap.
const TOUCH_PREFETCH_DELAY_MS = 50;

// Prefetches the watch page of a card that is about to be opened: hovering, focusing or pressing
// it fetches the route in full (so the click needs no server round trip) and the player's script;
// a press also starts the video request. Off for cards that don't open the page.
function useWatchPrefetch(data: any, watchLink: string, enabled: boolean, clipLangs: string) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prefetchFullRoute = useEffectEvent(() =>
    router.prefetch(watchLink, { kind: PrefetchKind.FULL }),
  );
  useEffect(() => {
    if (enabled) warmWatchPageWhenIdle(() => prefetchFullRoute());
    return () => clearTimeout(timer.current);
  }, [enabled]);
  function prefetchRoute() {
    clearTimeout(timer.current);
    if (!enabled) return;
    router.prefetch(watchLink, { kind: PrefetchKind.FULL });
    preloadWatchPlayer(data);
  }
  function press() {
    prefetchRoute();
    preloadWatchVideo(data, clipLangs);
  }
  return {
    onPointerEnter: (e: React.PointerEvent) => {
      if (!enabled || e.pointerType !== "mouse") return;
      clearTimeout(timer.current);
      timer.current = setTimeout(prefetchRoute, HOVER_PREFETCH_DELAY_MS);
    },
    onPointerLeave: () => clearTimeout(timer.current),
    onPointerCancel: () => clearTimeout(timer.current),
    onFocus: prefetchRoute,
    onPointerDown: (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      if ((e.target as Element).closest?.(".video-card-item-actions")) return;
      if (e.pointerType === "mouse") return press();
      clearTimeout(timer.current);
      timer.current = setTimeout(press, TOUCH_PREFETCH_DELAY_MS);
    },
  };
}

const metricPairClass =
  "inline-grid h-4 grid-cols-[0.875rem_auto] items-center gap-x-1 whitespace-nowrap leading-none [backface-visibility:hidden] [transform:translateZ(0)] [will-change:transform]";
const metricTextOnlyClass =
  "inline-block whitespace-nowrap leading-none [backface-visibility:hidden] [transform:translateZ(0)] [will-change:transform]";

function Metric({
  icon: Icon,
  text,
  title,
  truncate = false,
}: {
  icon: AnyIcon | null;
  text: React.ReactNode;
  title: string;
  truncate?: boolean;
}) {
  return (
    <span
      className={cn(Icon ? metricPairClass : metricTextOnlyClass, truncate && "truncate")}
      title={title}
    >
      {Icon ? <Icon className="block size-3.5 shrink-0 -translate-y-[0.5px]" /> : null}
      <span className="block leading-none">{text}</span>
    </span>
  );
}

// Live viewers (when shown), otherwise the scheduled/published time (ticking for upcoming).
function StatusMetric({
  data,
  lang,
  times,
  showViewers,
  truncateTime = false,
}: {
  data: any;
  lang: string;
  times: VideoCardTimes;
  showViewers: boolean;
  truncateTime?: boolean;
}) {
  const isLiveStatus = data.status === "live";
  if (isLiveStatus && showViewers && times.viewerCount)
    return <Metric icon={BroadcastIcon} text={times.viewerCount} title={times.viewerLabel} />;
  if (!isLiveStatus && times.compactTimeText)
    return (
      <Metric
        icon={data.status !== "past" ? Clock : null}
        text={
          data.status === "upcoming" ? (
            <TickingCompactTime video={data} lang={lang} />
          ) : (
            times.compactTimeText
          )
        }
        title={times.absoluteTimeText}
        truncate={truncateTime}
      />
    );
  return null;
}

function ChannelAvatarButton({
  channel,
  channelName,
  size,
  onClick,
}: {
  channel: any;
  channelName: string;
  size?: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-auto rounded-full border-0 p-0"
      title={channelName}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <ChannelImg channel={channel} rounded size={size} noLink />
    </Button>
  );
}

function VideoCardTitle({
  title,
  href,
  denseList,
  hasWatched,
  dimmed,
  isCertain,
  onOpen,
}: {
  title: string;
  href: string;
  denseList: boolean;
  hasWatched: boolean;
  dimmed: boolean;
  isCertain: boolean;
  onOpen: () => void;
}) {
  const app = useAppState();
  const t = useTranslations();
  const gridSize = app.currentGridSize;
  return (
    <div className={cn("min-h-0", denseList ? "m-0 min-w-0 flex-1 overflow-hidden" : "flex-none")}>
      <Link
        href={href}
        lang="en"
        className={cn(
          "video-card-title select-text text-left font-medium no-underline",
          denseList
            ? "block w-full truncate text-sm leading-[1.3]"
            : // Two lines, always reserving the height of both so card rows line up.
              "line-clamp-2 min-h-11 cursor-pointer break-words hyphens-auto",
          hasWatched && "text-primary/70 opacity-60",
          dimmed && "grayscale opacity-30",
          !denseList &&
            (gridSize === 2 ? "text-sm" : gridSize === 1 ? "text-[0.9375rem]" : "text-base"),
          // After the size: cn() drops a line height that precedes a font size.
          !denseList && "leading-5.5",
        )}
        title={title}
        onMouseDown={(e) => {
          if (e.button === 2 || (e.button === 0 && e.ctrlKey))
            e.currentTarget.style.userSelect = "none";
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          const el = e.currentTarget;
          requestAnimationFrame(() => {
            el.style.userSelect = "";
          });
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (shouldIgnoreTextClick(e)) return;
          onOpen();
        }}
      >
        {!isCertain ? (
          <AlarmClock
            className="mr-1 inline-block h-[18px] w-[18px] align-text-bottom"
            aria-label={t("component.videoCard.uncertainPlaceholder")}
          />
        ) : null}
        {title}
      </Link>
    </div>
  );
}

function ClipsCount({ count }: { count: number }) {
  const t = useTranslations();
  if (!count) return null;
  return <span className="text-primary">· {t("component.videoCard.clips", { n: count })}</span>;
}

// Channel (with its inline avatar for live/upcoming streams) on the left, the status metric and
// clip count on the right.
function ChannelMetaRow({
  data,
  lang,
  times,
  denseList,
  includeAvatar,
  channelName,
  clipsInLang,
  onChannel,
}: {
  data: any;
  lang: string;
  times: VideoCardTimes;
  denseList: boolean;
  includeAvatar: boolean;
  channelName: string;
  clipsInLang: number;
  onChannel: () => void;
}) {
  const showAvatar =
    includeAvatar &&
    !denseList &&
    data.type !== "clip" &&
    ["live", "upcoming"].includes(data.status) &&
    data.channel;
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm leading-none",
        denseList
          ? "max-w-[min(360px,42vw)] flex-[0_1_360px] overflow-hidden"
          : "min-h-0 justify-between",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {showAvatar ? (
          <ChannelAvatarButton
            channel={data.channel}
            channelName={channelName}
            size={24}
            onClick={onChannel}
          />
        ) : null}
        <Button
          type="button"
          variant="link"
          className={cn(
            "-ml-0.5 block h-auto min-w-0 flex-1 truncate border-0 p-0 pl-0.5 text-left text-sm font-normal leading-tight text-muted-foreground no-underline hover:text-foreground hover:no-underline",
            denseList && "max-w-[180px]",
          )}
          title={channelTooltip(data.channel, channelName)}
          onClick={(e) => {
            e.stopPropagation();
            if (shouldIgnoreTextClick(e)) return;
            onChannel();
          }}
        >
          {channelName}
        </Button>
      </div>
      <div className="ml-auto flex flex-none items-center gap-1.5 whitespace-nowrap font-ibm text-sm! leading-none tabular-nums text-muted-foreground">
        <StatusMetric
          data={data}
          lang={lang}
          times={times}
          showViewers={data.status === "live" && !!times.viewerCount}
        />
        <ClipsCount count={clipsInLang} />
      </div>
    </div>
  );
}

function VideoCardMeta({
  includeChannel,
  ...props
}: React.ComponentProps<typeof ChannelMetaRow> & { includeChannel: boolean }) {
  const { data, lang, times, denseList, clipsInLang } = props;
  return (
    <div
      className={cn(
        "min-h-0",
        denseList ? "m-0 flex flex-1 flex-none flex-row items-center gap-3" : "flex flex-col",
      )}
    >
      {includeChannel ? (
        <ChannelMetaRow {...props} />
      ) : (
        <div
          className={cn(
            "flex min-h-4 items-center gap-1.5 font-ibm text-sm! leading-none tabular-nums text-muted-foreground",
            denseList && "min-w-20 whitespace-nowrap",
          )}
        >
          <StatusMetric
            data={data}
            lang={lang}
            times={times}
            showViewers={!!times.viewerCount}
            truncateTime
          />
          <ClipsCount count={clipsInLang} />
        </div>
      )}
    </div>
  );
}

// The dense-list avatar, then the title and meta lines.
function VideoCardText({
  denseList,
  horizontal,
  avatar,
  children,
}: {
  denseList: boolean;
  horizontal: boolean;
  avatar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "video-card-text flex flex-1 flex-row gap-2.5",
        denseList
          ? "items-center gap-2 overflow-hidden py-0 pr-2 pl-1"
          : horizontal
            ? "px-2 py-1.5"
            : "px-2.5 pt-2 pb-1.5",
      )}
    >
      {avatar ? <div className="mx-2 flex flex-col self-center">{avatar}</div> : null}
      <div
        className={cn(
          "flex min-w-0 flex-1",
          denseList
            ? "flex-row flex-nowrap items-center gap-2.5"
            : horizontal
              ? "flex-col gap-0.5"
              : "flex-col gap-1.5",
          horizontal && "justify-around",
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Red while live, like the live viewer badge.
function DurationBadge({ live, children }: { live: boolean; children: React.ReactNode }) {
  const durationBadgeClass = cn(
    "m-1 font-ibm font-light",
    live && "bg-live/90 text-white dark:bg-live/90 dark:text-white",
  );
  return (
    <Badge variant="secondary" className={durationBadgeClass}>
      {children}
    </Badge>
  );
}

function SaveToPlaylistButton({ data }: { data: any }) {
  const app = useAppState();
  const hasSaved = !!app.playlist.find((v) => v.id === data?.id);
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-xs"
      className="pointer-events-auto m-1"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasSaved) app.removeFromPlaylist(data.id);
        else app.addToPlaylist(data);
      }}
    >
      {hasSaved ? <Check className="size-4" /> : <Plus className="size-4" />}
    </Button>
  );
}

// Song count, TL count/presence and duration badges for real videos.
function VideoBadges({ data, durationNode }: { data: any; durationNode: React.ReactNode }) {
  const app = useAppState();
  const t = useTranslations();
  const isPast = data.status === "past";
  return (
    <div className="flex flex-col items-end">
      {data.songcount ? (
        <Badge variant="secondary" className="m-1" title={t("component.videoCard.totalSongs")}>
          {data.songcount > 1 ? data.songcount : ""}
          <Music className="h-3.5 w-3.5" />
        </Badge>
      ) : null}
      {hasTlsFor(data, app.settings.liveTlLang) ? (
        <Badge
          variant="secondary"
          className="m-1"
          title={isPast ? t("component.videoCard.totalTLs") : t("component.videoCard.tlPresence")}
        >
          {isPast ? data.live_tl_count?.[app.settings.liveTlLang || "en"] : ""}
          <icons.TlChatIcon className="h-3.5 w-3.5" />
        </Badge>
      ) : null}
      {data.duration > 0 || data.start_actual ? (
        <DurationBadge live={data.status === "live"}>{durationNode}</DurationBadge>
      ) : null}
    </div>
  );
}

// Placeholders show their duration, swapped on hover for their kind, plus the source icon.
function PlaceholderBadge({
  data,
  durationText,
  durationNode,
}: {
  data: any;
  durationText: string;
  durationNode: React.ReactNode;
}) {
  const t = useTranslations();
  const Icon = placeholderIcon(data);
  return (
    <div className="flex flex-col items-end">
      <DurationBadge live={data.status === "live"}>
        {durationText ? (
          <span className="inline-block leading-3.25 group-hover:hidden">{durationNode}</span>
        ) : null}
        {data.placeholderType === "scheduled-yt-stream" ? (
          <span className="hidden leading-3.25 group-hover:inline-block">
            {t("component.videoCard.typeScheduledYT")}
          </span>
        ) : data.placeholderType === "external-stream" ? (
          <span className="hidden leading-3.25 group-hover:inline-block">
            {t("component.videoCard.typeExternalStream")}
          </span>
        ) : data.placeholderType === "event" ? (
          <span className="hidden leading-3.25 group-hover:inline-block">
            {t("component.videoCard.typeEventPlaceholder")}
          </span>
        ) : null}
        {Icon ? <Icon className="h-4 w-4 rounded-sm" /> : null}
      </DurationBadge>
    </div>
  );
}

// Badges over the thumbnail: topic and save button on top, viewers and info badges below.
function ThumbnailOverlay({
  data,
  times,
  includeChannel,
  horizontal,
}: {
  data: any;
  times: VideoCardTimes;
  includeChannel: boolean;
  horizontal: boolean;
}) {
  const t = useTranslations();
  const isPlaceholder = data.type === "placeholder";
  const isLiveStatus = data.status === "live";
  // The meta row shows the viewers when it has the channel; otherwise they go on the thumbnail.
  const showViewerBadge = !includeChannel && !horizontal && isLiveStatus && !!times.viewerCount;
  // Elapsed live duration ticks every second; keep the ticking inside its own child.
  const durationNode =
    isLiveStatus && data.start_actual ? <TickingDuration video={data} t={t} /> : times.durationText;
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] flex h-full w-full flex-col justify-between overflow-hidden rounded-[inherit]">
      <div className="flex items-start justify-between">
        <div>
          {data.topic_id && data.type !== "clip" ? (
            <Badge variant="secondary" className="m-1.5 max-w-full truncate capitalize font-ibm">
              {data.topic_id}
            </Badge>
          ) : null}
        </div>
        {!isPlaceholder ? <SaveToPlaylistButton data={data} /> : null}
      </div>
      <div className="flex min-w-0 items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          {showViewerBadge ? (
            <Badge variant="destructive" className="m-1 gap-1" title={times.viewerLabel}>
              <BroadcastIcon className="size-3.5" />
              {times.viewerCount}
            </Badge>
          ) : null}
        </div>
        {!isPlaceholder ? (
          <VideoBadges data={data} durationNode={durationNode} />
        ) : (
          <PlaceholderBadge
            data={data}
            durationText={times.durationText}
            durationNode={durationNode}
          />
        )}
      </div>
    </div>
  );
}

function VideoThumbnail({
  title,
  imageSrc,
  horizontal,
  hideThumbnail,
  dimmed,
  onClick,
  children,
}: {
  title: string;
  imageSrc: string;
  horizontal: boolean;
  hideThumbnail: boolean;
  dimmed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full shrink-0 cursor-pointer overflow-hidden bg-muted",
        horizontal && "my-1.5 ml-1.5 h-[72px] w-[128px] self-center rounded-lg",
        dimmed && "grayscale opacity-30",
      )}
    >
      {horizontal && !hideThumbnail ? (
        <img
          src={imageSrc}
          width="128"
          height="72"
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          alt=""
        />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="absolute inset-0 z-0 h-full w-full rounded-none border-0 bg-transparent p-0 text-transparent hover:bg-transparent! focus-visible:ring-2 focus-visible:ring-primary"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <span className="sr-only">{title}</span>
      </Button>
      {children}
      {!horizontal && !hideThumbnail ? (
        <img
          src={imageSrc}
          width="100%"
          loading="lazy"
          decoding="async"
          className="pointer-events-none aspect-video w-full object-cover"
          alt=""
        />
      ) : !horizontal && hideThumbnail ? (
        <div className="pointer-events-none aspect-[60/9] w-full bg-muted" />
      ) : null}
    </div>
  );
}

// Move up / remove / move down for an item of the user's active playlist.
function PlaylistItemActions({ data }: { data: any }) {
  const app = useAppState();
  const t = useTranslations();
  function move(direction: "up" | "down") {
    const curIdx = app.playlist.findIndex((elem: any) => elem.id === data.id);
    if (curIdx < 0) return;
    const toIdx = direction === "up" ? curIdx - 1 : curIdx + 1;
    if (toIdx < 0 || toIdx >= app.playlist.length) return;
    app.reorderPlaylist({ from: curIdx, to: toIdx });
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("component.common.moveUp")}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          move("up");
        }}
      >
        <icons.ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("component.videoCard.removeFromPlaylist")}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          app.removeFromPlaylist(data.id);
        }}
      >
        <icons.Trash2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("component.common.moveDown")}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          move("down");
        }}
      >
        <icons.ChevronDown className="h-4 w-4" />
      </Button>
    </>
  );
}

// The strip under the card: playlist controls for the active playlist, otherwise the caller's
// action or children.
function VideoCardItemActions({
  data,
  denseList,
  activePlaylistItem,
  content,
}: {
  data: any;
  denseList: boolean;
  activePlaylistItem: boolean;
  content: React.ReactNode;
}) {
  if (!(content || activePlaylistItem)) return null;
  return (
    <div
      className={cn(
        "video-card-item-actions flex items-center gap-1",
        denseList ? "h-auto self-stretch border-l px-2 py-0" : "border-t px-3 py-2",
      )}
    >
      {activePlaylistItem ? <PlaylistItemActions data={data} /> : content}
    </div>
  );
}

export function VideoCard({
  video,
  source,
  fluid = false,
  includeChannel = false,
  includeAvatar = false,
  hideThumbnail = false,
  horizontal = false,
  colSize = 1,
  active = false,
  disableDefaultClick = false,
  activePlaylistItem = false,
  parentPlaylistId = null,
  denseList = false,
  displayStartTime = false,
  inMultiViewSelector = false,
  onVideoClicked,
  children,
  action,
}: any) {
  const data = source || video;
  const router = useRouter();
  const pathname = usePathname();
  const app = useAppState();
  const multiviewStore = useOptionalMultiviewStore();
  const t = useTranslations();
  const lang = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuResetKey, setMenuResetKey] = useState(0);
  const [hasWatched, setHasWatched] = useHasWatched(data?.id);
  const { dragging, dragProps } = useCardDrag(data);
  const title = videoTitle(data, app.settings.useEnglishName);
  const imageSrc = videoImage(data, { horizontal, colSize, forceJpg: true });
  const channelName = channelDisplayName(data?.channel, app.settings.useEnglishName);
  const shouldHideThumbnail = app.settings.hideThumbnail || hideThumbnail;
  const { watchLink, externalUrl, openExternal, titleHref } = videoCardLinks(
    data,
    app.settings.redirectMode,
    parentPlaylistId,
  );
  const inMultiViewActiveVideos =
    inMultiViewSelector && inMultiviewLayout(multiviewStore?.activeVideos, data?.id);
  const clipLangs = app.settings.clipLangs.join(",");
  const watchPrefetch = useWatchPrefetch(
    data,
    watchLink,
    !!data?.id && !openExternal && !disableDefaultClick,
    clipLangs,
  );

  useEffect(() => {
    if (!denseList && !shouldHideThumbnail) void preloadImage(imageSrc);
  }, [denseList, imageSrc, shouldHideThumbnail]);

  function goToVideo() {
    onVideoClicked?.(data);
    if (disableDefaultClick) return;
    if (openExternal) {
      if (externalUrl) window.open(externalUrl, "_blank", "noopener");
      return;
    }
    preloadWatchVideo(data, clipLangs);
    setHasWatched(true);
    if (pathname.startsWith("/watch") && app.isMobile) router.replace(watchLink);
    else router.push(watchLink);
  }
  function onThumbnailClicked() {
    if (disableDefaultClick) return onVideoClicked?.(data);
    goToVideo();
  }
  function goToChannel() {
    onVideoClicked?.(data);
    if (disableDefaultClick) return;
    router.push(`/channel/${data.channel.id}`);
  }
  function closeContextMenu() {
    setMenuOpen(false);
    setMenuResetKey((key) => key + 1);
  }
  if (!data) return null;
  const times = videoCardTimes(data, lang, t, displayStartTime);
  const shellClass = cn(
    "video-card-shell flex w-full gap-0 overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:[box-shadow:0_0_0_1px_color-mix(in_oklch,var(--color-primary)_50%,transparent),0_0_16px_color-mix(in_oklch,var(--color-primary)_15%,transparent)]",
    horizontal || denseList ? "flex-row" : "flex-col",
    denseList && "min-h-12",
  );
  return (
    <article
      className={articleClassFor({ fluid, active, dragging, horizontal, denseList })}
      {...dragProps}
      {...watchPrefetch}
    >
      {/* Clicking anywhere on the card opens the video (the title link is the keyboard path);
          `contents` keeps the card's layout. */}
      <div
        role="presentation"
        className="contents"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,button")) return;
          if (shouldIgnoreTextClick(e)) return;
          goToVideo();
        }}
      >
        <ContextMenu key={menuResetKey} onOpenChange={setMenuOpen}>
          <ContextMenuTrigger render={<Card className={shellClass} />}>
            {!denseList ? (
              <VideoThumbnail
                title={title}
                imageSrc={imageSrc}
                horizontal={horizontal}
                hideThumbnail={shouldHideThumbnail}
                dimmed={inMultiViewActiveVideos}
                onClick={onThumbnailClicked}
              >
                <ThumbnailOverlay
                  data={data}
                  times={times}
                  includeChannel={includeChannel}
                  horizontal={horizontal}
                />
              </VideoThumbnail>
            ) : null}
            <VideoCardText
              denseList={denseList}
              horizontal={horizontal}
              avatar={
                denseList && data.channel ? (
                  <ChannelAvatarButton
                    channel={data.channel}
                    channelName={channelName}
                    onClick={goToChannel}
                  />
                ) : null
              }
            >
              <VideoCardTitle
                title={title}
                href={titleHref}
                denseList={denseList}
                hasWatched={hasWatched}
                dimmed={inMultiViewActiveVideos}
                isCertain={isCertainVideo(data)}
                onOpen={goToVideo}
              />
              <VideoCardMeta
                data={data}
                lang={lang}
                times={times}
                denseList={denseList}
                includeChannel={includeChannel}
                includeAvatar={includeAvatar}
                channelName={channelName}
                clipsInLang={clipsInLangCount(data, app.settings.clipLangs)}
                onChannel={goToChannel}
              />
            </VideoCardText>
          </ContextMenuTrigger>
          {menuOpen ? (
            <ContextMenuContent className="w-[260px]">
              <VideoCardMenu video={data} close={closeContextMenu} />
            </ContextMenuContent>
          ) : null}
        </ContextMenu>
        <VideoCardItemActions
          data={data}
          denseList={denseList}
          activePlaylistItem={activePlaylistItem}
          content={action || children}
        />
      </div>
    </article>
  );
}
