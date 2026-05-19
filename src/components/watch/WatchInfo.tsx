"use client";

import Link from "next/link";
import { useMemo, type MouseEvent, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { TruncatedText } from "@/components/common/TruncatedText";
import { useAppState } from "@/lib/store";
import { useLocale, useTranslations } from "next-intl";
import { decodeHTMLEntities, formatCount } from "@/lib/functions";
import { channelDisplayName, channelGroup, linkifyVideoTimestamps } from "@/lib/video-format";

type WatchInfoProps = {
  video: Record<string, any>;
  actions?: ReactNode;
  noSubCount?: boolean;
  onTimeJump?: (time: number) => void;
};

export function WatchInfo({ video, onTimeJump, noSubCount = false, actions }: WatchInfoProps) {
  const app = useAppState();
  const t = useTranslations();
  const locale = useLocale();
  const lang = locale;
  const ch = video.channel ?? {};
  const chName = channelDisplayName(ch, app.settings.useEnglishName);
  const group = channelGroup(ch);
  const orgText = ch.org ? ch.org + (group ? ` / ${group}` : "") : null;
  const orgUrl = ch.org ? `/?${new URLSearchParams({ org: ch.org })}` : null;
  const subCountText = !noSubCount && ch.subscriber_count ? t("component.channelInfo.subscriberCount", { n: formatCount(ch.subscriber_count, lang) }) : null;
  const title = decodeHTMLEntities(video.jp_name ? (app.settings.useEnglishName ? video.title || video.jp_name : video.jp_name || video.title) : video.title);

  const processedMessage = useMemo(
    () => linkifyVideoTimestamps(video.description, video.id, app.settings.redirectMode),
    [video.description, video.id, app.settings.redirectMode],
  );

  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.matches(".comment-chip")) { onTimeJump?.(Number(target.getAttribute("data-time") || 0)); e.preventDefault(); }
  }

  return (
    <>
      <section className="flex flex-col gap-0 px-4 pt-4">

        {/* Title */}
        <h1 className="text-xl font-semibold leading-snug text-foreground">{title}</h1>

        {/* Channel row */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <ChannelImg channel={ch} size={48} className="shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link href={`/channel/${ch.id}`} className="truncate text-base font-medium text-foreground no-underline hover:underline">
                {chName}
              </Link>
              <div className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                {orgText && orgUrl
                  ? <Link href={orgUrl} className="no-underline hover:underline">{orgText}</Link>
                  : null}
                {orgText && subCountText ? <span>·</span> : null}
                {subCountText
                  ? <Tooltip>
                      <TooltipTrigger><span className="cursor-default">{subCountText}</span></TooltipTrigger>
                      <TooltipContent>{ch.subscriber_count?.toLocaleString()}</TooltipContent>
                    </Tooltip>
                  : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {actions}
            <ChannelSocials channel={ch} />
          </div>
        </div>

        {video.type === "placeholder" && video.certainty !== "certain" ? (
          <p className="mt-3 pb-4 text-xs text-muted-foreground">
            {t("component.videoCard.uncertainPlaceholder")}
          </p>
        ) : (
          <div className="pb-4" />
        )}

      </section>
      <div className="px-4 pb-4 pt-[var(--pad)] text-sm text-muted-foreground" onClick={handleClick}>
        <TruncatedText html={processedMessage} lines={4} renderButton={(expanded) => expanded ? t("component.description.showLess") : t("component.description.showMore")} />
      </div>
    </>
  );
}
