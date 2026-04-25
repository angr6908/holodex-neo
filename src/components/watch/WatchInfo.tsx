"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { mdiAt } from "@mdi/js";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelInfo } from "@/components/channel/ChannelInfo";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { TruncatedText } from "@/components/common/TruncatedText";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { decodeHTMLEntities, formatCount, getKnownLiveViewerCount, getLiveViewerCount } from "@/lib/functions";
import { linkifyVideoTimestamps } from "@/lib/video-format";
import { dayjs, formatDistance, formatDuration, localizedDayjs, titleTimeString } from "@/lib/time";
import * as icons from "@/lib/icons";

export function WatchInfo({ video, onTimeJump, noSubCount = false }: { video: Record<string, any>; onTimeJump?: (time: number) => void; noChips?: boolean; noSubCount?: boolean }) {
  const pathname = usePathname();
  const app = useAppState();
  const { t } = useI18n();
  const [elapsedTime, setElapsedTime] = useState("");
  const [showAllMentions, setShowAllMentions] = useState(false);
  const [lastViewerCount, setLastViewerCount] = useState(-1);
  const previousLiveViewers = useRef<number | undefined>(undefined);
  const lang = app.settings.lang;
  const absoluteTimeString = titleTimeString(video.available_at, lang);
  const formattedTime = video.status === "upcoming" ? formatDistance(video.start_scheduled, lang, t) : video.status === "live" ? t("component.watch.streamingFor", [elapsedTime]) : localizedDayjs(video.available_at, lang).format("LLL");
  const liveViewerCount = getLiveViewerCount(video);
  const knownLiveViewerCount = getKnownLiveViewerCount(video);
  const liveViewers = liveViewerCount ? formatCount(liveViewerCount, lang) : "";
  const liveViewerChange = knownLiveViewerCount === null || lastViewerCount < 0 ? 0 : knownLiveViewerCount - lastViewerCount;
  const mentions = video.mentions || [];
  const channelChips = mentions.length > 3 && !showAllMentions ? mentions.slice(0, 3) : mentions;
  const title = decodeHTMLEntities(video.jp_name ? (app.settings.nameProperty === "english_name" ? video.title || video.jp_name : (video.jp_name || video.title)) : video.title);
  const isEditPath = pathname.includes("edit");

  useEffect(() => {
    if (video.status !== "live") return;
    const timer = setInterval(() => setElapsedTime(formatDuration(dayjs().diff(dayjs(video.start_actual)))), 1000);
    return () => clearInterval(timer);
  }, [video.status, video.start_actual]);
  useEffect(() => {
    if (knownLiveViewerCount === null) {
      previousLiveViewers.current = undefined;
      setLastViewerCount(-1);
      return;
    }
    setLastViewerCount(previousLiveViewers.current ?? -1);
    previousLiveViewers.current = knownLiveViewerCount;
  }, [knownLiveViewerCount]);

  const processedMessage = useMemo(
    () => linkifyVideoTimestamps(video.description, video.id, app.settings.redirectMode),
    [video.description, video.id, app.settings.redirectMode],
  );

  const searchTopicUrl = (() => {
    const topic = video.topic_id || "";
    if (!topic) return "#";
    const capitalizedTopic = topic[0].toUpperCase() + topic.slice(1);
    const org = video.channel?.org;
    let q = `type,value,text\ntopic,"${topic}","${capitalizedTopic}"`;
    if (org) q += `\norg,${org},${org}`;
    return `/search?${new URLSearchParams({ q })}`;
  })();

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.matches(".comment-chip")) {
      onTimeJump?.(Number(target.getAttribute("data-time") || 0));
      e.preventDefault();
    }
  }

  return (
    <Card className="watch-card rounded-none border-x-0 px-0 py-0 shadow-none">
      <div className="relative px-4 py-4">
        <div className="text-lg font-medium text-[color:var(--color-foreground)]">{!isEditPath ? <span>{title}</span> : <Link href={`/watch/${video.id}`} className="text-[color:var(--color-foreground)] no-underline"><span style={{ cursor: "pointer" }}>{video.title}</span></Link>}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-sm text-[color:var(--color-muted-foreground)]">
          <span className={`text-${video.status}`} title={absoluteTimeString}>{formattedTime}</span>
          {video.status !== "live" && video.duration ? <span className="inline-flex items-center gap-1">• {formatDuration(video.duration * 1000)}</span> : null}
          {video.status === "live" && liveViewers ? <span className="live-viewers inline-flex items-center gap-1">• {t("component.videoCard.watching", [liveViewers])}{liveViewerChange ? <span className={liveViewerChange > 0 ? "text-emerald-400" : "text-rose-400"}>({(liveViewerChange > 0 ? "+ " : "") + liveViewerChange})</span> : null}</span> : null}
          {video.topic_id ? <span className="inline-flex items-center gap-1" style={{ textTransform: "capitalize" }}>• <Link href={searchTopicUrl} className="inline-flex items-center gap-1 text-sky-300 no-underline"><Icon icon={icons.mdiAnimationPlay} size="sm" />{video.topic_id}</Link></span> : null}
          {video.type === "placeholder" && !(video.certainty === "certain") ? <span className="basis-full" style={{ fontSize: "95%" }}>{t("component.videoCard.uncertainPlaceholder")}</span> : null}
        </div>
        <Button as={Link} id="video-edit-btn" href={isEditPath ? `/watch/${video.id}` : `/edit/video/${video.id}${video.type !== "stream" ? "/mentions" : "/"}`} variant="outline" size="sm" className="watch-edit-btn absolute bottom-4 right-4">{isEditPath ? t("editor.exitMode") : t("editor.enterMode")}</Button>
      </div>
      <div className="border-t border-[color:var(--color-border)]" />
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="shrink-0"><ChannelImg channel={video.channel} size={80} /></div>
          <ChannelInfo channel={video.channel} className="uploader-data-list" noSubscriberCount={noSubCount} />
          <ChannelSocials channel={video.channel} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {channelChips && channelChips.length > 0 ? <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)]"><Icon icon={mdiAt} /></div> : null}
          {channelChips.map((mention: any, index: number) => <ChannelChip key={`${mention.id || "mention"}-${index}`} channel={mention} size={60} />)}
          {mentions.length > 3 ? <button type="button" className="text-sm text-sky-300" onClick={() => setShowAllMentions((value) => !value)}>[ {showAllMentions ? "-" : "+"} {mentions.length - 3} ]</button> : null}
        </div>
      </div>
      <div className="px-4 pb-4 text-sm text-[color:var(--color-muted-foreground)]" onClick={handleClick}>
        <TruncatedText html={processedMessage} lines={4} renderButton={(expanded) => <Button type="button" variant="ghost" size="sm">{expanded ? t("component.description.showLess") : t("component.description.showMore")}</Button>} />
      </div>
    </Card>
  );
}
