"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { TruncatedText } from "@/components/common/TruncatedText";
import { useAppState } from "@/lib/store";
import { useLocale, useTranslations } from "next-intl";
import { decodeHTMLEntities, formatCount, getKnownLiveViewerCount, getLiveViewerCount } from "@/lib/functions";
import { channelDisplayName, channelGroup, elapsedLiveDuration, linkifyVideoTimestamps } from "@/lib/video-format";
import { dayjs, formatDistance, formatDuration, titleTimeString } from "@/lib/time";
import * as icons from "@/lib/icons";

export function WatchInfo({ video, onTimeJump, noSubCount = false }: { video: Record<string, any>; onTimeJump?: (time: number) => void; noChips?: boolean; noSubCount?: boolean }) {
  const app = useAppState();
  const t = useTranslations();
  const locale = useLocale();
  const [elapsedTime, setElapsedTime] = useState("");
  const [showAllMentions, setShowAllMentions] = useState(false);
  const [lastViewerCount, setLastViewerCount] = useState(-1);
  const previousLiveViewers = useRef<number | undefined>(undefined);
  const lang = locale;
  const ch = video.channel ?? {};
  const chName = channelDisplayName(ch, app.settings.useEnglishName);
  const group = channelGroup(ch);
  const orgText = ch.org ? ch.org + (group ? ` / ${group}` : "") : null;
  const orgUrl = ch.org ? `/?${new URLSearchParams({ org: ch.org })}` : null;
  const subCountText = !noSubCount && ch.subscriber_count ? t("component.channelInfo.subscriberCount", { n: formatCount(ch.subscriber_count, lang) }) : null;
  const absoluteTimeString = titleTimeString(video.available_at, lang);
  const formattedTime = video.status === "upcoming" ? formatDistance(video.start_scheduled, lang, t) : video.status === "live" ? t("component.watch.streamingFor", { arg0: elapsedTime }) : dayjs(video.available_at).format("LLL");
  const liveViewerCount = getLiveViewerCount(video);
  const knownLiveViewerCount = getKnownLiveViewerCount(video);
  const liveViewers = liveViewerCount ? formatCount(liveViewerCount, lang) : "";
  const liveViewerChange = knownLiveViewerCount === null || lastViewerCount < 0 ? 0 : knownLiveViewerCount - lastViewerCount;
  const mentions = video.mentions || [];
  const channelChips = mentions.length > 3 && !showAllMentions ? mentions.slice(0, 3) : mentions;
  const title = decodeHTMLEntities(video.jp_name ? (app.settings.useEnglishName ? video.title || video.jp_name : video.jp_name || video.title) : video.title);

  useEffect(() => {
    if (video.status !== "live") return;
    const timer = setInterval(() => setElapsedTime(elapsedLiveDuration(video.start_actual)), 1000);
    return () => clearInterval(timer);
  }, [video.status, video.start_actual]);

  useEffect(() => {
    if (knownLiveViewerCount === null) { previousLiveViewers.current = undefined; setLastViewerCount(-1); return; }
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
    let q = `type,value,text\ntopic,"${topic}","${capitalizedTopic}"`;
    if (ch.org) q += `\norg,${ch.org},${ch.org}`;
    return `/search?${new URLSearchParams({ q })}`;
  })();

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.matches(".comment-chip")) { onTimeJump?.(Number(target.getAttribute("data-time") || 0)); e.preventDefault(); }
  }

  return (
    <>
      <section className="grid auto-rows-min items-start gap-1 px-4 py-4 max-[640px]:grid-cols-1 min-[641px]:grid-cols-[1fr_auto]">
        <h1 className="text-xl font-semibold leading-snug text-foreground">{title}</h1>

          <div className="flex flex-col gap-1.5 text-muted-foreground">
            <div className="flex items-center gap-2 text-sm">
              <ChannelImg channel={ch} size={28} />
              <Link href={`/channel/${ch.id}`} className="font-semibold text-foreground no-underline hover:underline">
                {chName}
              </Link>
              {orgText && orgUrl ? (
                <>
                  <span>·</span>
                  <Link href={orgUrl} className="text-muted-foreground no-underline hover:underline">
                    {orgText}
                  </Link>
                </>
              ) : null}
              {subCountText ? <><span>·</span><span>{subCountText}</span></> : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span title={absoluteTimeString}>{formattedTime}</span>
              {video.status !== "live" && video.duration ? <span>· {formatDuration(video.duration * 1000)}</span> : null}
              {video.status === "live" && liveViewers ? (
	                <span>· {t("component.videoCard.watching", { arg0: liveViewers })}{liveViewerChange ? <span className={liveViewerChange > 0 ? "text-primary" : "text-destructive"}> ({liveViewerChange > 0 ? "+" : ""}{liveViewerChange})</span> : null}</span>
              ) : null}
              {video.topic_id ? (
                <Badge
                  render={<Link href={searchTopicUrl} className="inline-flex items-center gap-1 capitalize no-underline" />}
                  variant="secondary"
                >
                  <icons.CirclePlay className="size-4" />{video.topic_id}
                </Badge>
              ) : null}
              {video.type === "placeholder" && video.certainty !== "certain" ? <span className="basis-full">{t("component.videoCard.uncertainPlaceholder")}</span> : null}
            </div>
          </div>

          <div className="col-start-2 row-span-2 row-start-1 max-w-[min(42vw,28rem)] justify-self-end overflow-visible max-[640px]:col-start-1 max-[640px]:row-span-1 max-[640px]:row-start-3 max-[640px]:mt-2 max-[640px]:w-full max-[640px]:max-w-full max-[640px]:justify-self-start">
            <div className="flex flex-wrap items-center justify-end gap-2 max-[640px]:justify-start">
              <ChannelSocials channel={ch} />
              {channelChips.length > 0 ? <Badge variant="secondary"><AtSign className="size-4" /></Badge> : null}
              {channelChips.map((mention: any, i: number) => <ChannelChip key={`${mention.id ?? "m"}-${i}`} channel={mention} size={40} />)}
              {mentions.length > 3 ? (
	                <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-sm font-normal" onClick={() => setShowAllMentions(v => !v)}>
                  [ {showAllMentions ? "-" : "+"}{mentions.length - 3} ]
                </Button>
              ) : null}
            </div>
          </div>
      </section>
      <div className="px-4 pb-4 pt-[var(--pad)] text-sm text-muted-foreground" onClick={handleClick}>
        <TruncatedText html={processedMessage} lines={4} renderButton={(expanded) => expanded ? t("component.description.showLess") : t("component.description.showMore")} />
      </div>
    </>
  );
}
