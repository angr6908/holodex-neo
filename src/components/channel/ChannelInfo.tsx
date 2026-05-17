"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { buildSearchUrl, formatCount } from "@/lib/functions";
import { cn } from "@/lib/utils";
import { channelDisplayName, channelGroup } from "@/lib/video-format";
import * as icons from "@/lib/icons";

export function ChannelInfo({
  channel,
  includeSocials = false,
  includeVideoCount = false,
  noSubscriberCount = false,
  noGroup = false,
  children,
  style,
  className = "",
}: {
  channel: Record<string, any>;
  includeSocials?: boolean;
  includeVideoCount?: boolean;
  noSubscriberCount?: boolean;
  noGroup?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const router = useRouter();
  const app = useAppState();
  const t = useTranslations();
  const channelName = channelDisplayName(channel, app.settings.useEnglishName);
  const group = channelGroup(channel);
  const subscriberCount = channel?.subscriber_count
    ? t("component.channelInfo.subscriberCount", { n: formatCount(channel.subscriber_count, app.settings.lang) })
    : t("component.channelInfo.subscriberNA");
  const channelOrg = new URLSearchParams({ org: channel?.org || "" }).toString();

  async function searchTopic(topicId: string) {
    router.push(await buildSearchUrl([
      { type: "channel", value: channel.id, text: channel.name },
      { type: "topic", value: topicId, text: topicId },
    ]));
  }

  return (
    <div className={cn("min-w-0 flex-1", className)} style={style}>
      <div className="self-start">
        <Link href={`/channel/${channel.id}`} className="truncate no-underline">
          {channel.inactive ? (
            <Button variant="ghost" size="icon" className="h-[18px] w-[18px]" title={t("component.channelInfo.inactiveChannel")}>
              <icons.GraduationCap className="h-5 w-5" />
            </Button>
          ) : null}
          {channelName}
        </Link>{" "}<br />
        {channel.yt_handle ? (
          <a href={`https://youtube.com/${channel.yt_handle[0]}`} target="__blank" className="text-xs font-light text-muted-foreground no-underline opacity-70 hover:opacity-100">
            {channel.yt_handle[0]} •
          </a>
        ) : null}
        <span style={{ display: channel.org ? undefined : "none" }}>
          <Link href={`/?${channelOrg}`} className="text-xs font-light text-muted-foreground no-underline opacity-70 hover:opacity-100">
            {channel.org + (!noGroup && group ? " / " + group : "")}
          </Link>
        </span>
      </div>
      <div className="text-sm text-[color:var(--color-muted-foreground)]">
        {!noSubscriberCount ? <span className="subscriber-count">{subscriberCount}</span> : null}
        {includeVideoCount ? (
          <>
            {" • "}
            {t("component.channelInfo.videoCount", { arg0: channel.video_count })}
            {channel.clip_count > 0 ? (
              <Link href={`/channel/${channel.id}/clips`} className="no-underline">
                {" • "}
                <span className="text-[color:var(--color-primary)]">{t("component.channelInfo.clipCount", { n: channel.clip_count })}</span>
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
      {channel.top_topics && channel.top_topics.length ? (
        <div className="text-sm text-[color:var(--color-muted-foreground)]">
          🏆{" "}
          {channel.top_topics.map((topic: string) => (
            <Button
              key={topic}
              type="button"
              variant="outline"
              size="xs"
              className="mr-1 h-auto rounded-full bg-muted px-2 py-0.5 text-xs font-normal capitalize hover:border-transparent hover:bg-primary hover:text-primary-foreground"
              onClick={(event) => { event.stopPropagation(); event.preventDefault(); void searchTopic(topic); }}
            >
              {topic}
            </Button>
          ))}
        </div>
      ) : null}
      {includeSocials ? <div className="text-sm text-[color:var(--color-muted-foreground)]"><ChannelSocials channel={channel} /></div> : null}
      {children}
    </div>
  );
}
