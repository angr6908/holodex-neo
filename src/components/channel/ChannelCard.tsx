"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { buildSearchUrl, formatCount } from "@/lib/functions";
import { channelDisplayName, channelGroup } from "@/lib/video-format";
import * as icons from "@/lib/icons";

export function ChannelCard({ channel }: { channel: Record<string, any> }) {
  const router = useRouter();
  const app = useAppState();
  const t = useTranslations();
  const channelName = channelDisplayName(channel, app.settings.useEnglishName);
  const group = channelGroup(channel);
  const subscriberCount = channel?.subscriber_count
    ? t("component.channelInfo.subscriberCount", { n: formatCount(channel.subscriber_count, app.settings.lang) })
    : "";

  async function searchTopic(topicId: string) {
    router.push(await buildSearchUrl([
      { type: "channel", value: channel.id, text: channel.name },
      { type: "topic", value: topicId, text: topicId },
    ]));
  }

  if (!channel) return null;
  return (
    <Card className="group flex h-full w-full flex-col gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/50 p-0 shadow-none ring-0">
      <Link href={`/channel/${channel.id}`} className="flex flex-col items-center gap-1.5 px-3 pb-2.5 pt-4 no-underline">
        <ChannelImg channel={channel} size={52} noLink />
        <div className="w-full min-w-0 text-center">
          <div className="truncate text-[15px] font-medium leading-tight text-foreground">
            {channel.inactive ? <icons.GraduationCap className="mr-0.5 inline-block size-4 align-[-2px]" /> : null}
            {channelName}
          </div>
          {channel.org ? <div className="mt-0.5 truncate text-[13px] leading-tight text-muted-foreground">{channel.org}{group ? " / " + group : ""}</div> : null}
          {channel.yt_handle ? <div className="mt-0.5 truncate text-xs leading-tight text-muted-foreground opacity-70">{channel.yt_handle[0]}</div> : null}
        </div>
      </Link>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 pb-2 text-[13px] leading-none text-muted-foreground">
        {subscriberCount ? <span className="whitespace-nowrap">{subscriberCount}</span> : null}
        {channel.video_count ? <span className="whitespace-nowrap">{t("component.channelInfo.videoCount", { arg0: formatCount(channel.video_count, app.settings.lang) })}</span> : null}
        {channel.clip_count > 0 ? (
          <Link href={`/channel/${channel.id}/clips`} className="whitespace-nowrap text-primary no-underline hover:underline" onClick={(event) => event.stopPropagation()}>
            {t("component.channelInfo.clipCount", { n: channel.clip_count })}
          </Link>
        ) : null}
      </div>

      {channel.top_topics && channel.top_topics.length ? (
        <div className="flex flex-wrap items-center justify-center gap-1 px-2 pb-3">
          {channel.top_topics.slice(0, 3).map((topic: string) => (
            <Button
              key={topic}
              type="button"
              variant="secondary"
              size="xs"
              onClick={(event) => { event.stopPropagation(); event.preventDefault(); void searchTopic(topic); }}
            >
              {topic}
            </Button>
          ))}
        </div>
      ) : null}

      {/* Muted footer strip, pinned to the bottom so cards in a grid row line up. */}
      <div className="mt-auto flex items-center justify-center border-t border-border/60 bg-muted/30 px-1 py-1">
        <ChannelSocials channel={channel} className="justify-center gap-0.5 p-0" />
      </div>
    </Card>
  );
}
