"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
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
    <Card className="group block w-full gap-0 overflow-hidden">
        <Link href={`/channel/${channel.id}`} className="flex flex-col items-center gap-1.5 px-3 pt-4 pb-2.5 no-underline">
          <ChannelImg channel={channel} size={52} noLink />
          <div className="w-full min-w-0 text-center">
            <div className="truncate text-sm font-semibold leading-tight text-foreground">
              {channel.inactive ? <icons.GraduationCap className="mr-0.5 inline-block h-3.5 w-3.5 align-[-2px]" /> : null}
              {channelName}
            </div>
            {channel.org ? <div className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">{channel.org}{group ? " / " + group : ""}</div> : null}
            {channel.yt_handle ? <div className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground opacity-70">{channel.yt_handle[0]}</div> : null}
          </div>
        </Link>

        <Separator />

        <div className="flex shrink-0 items-center justify-center gap-3 px-2 py-2 text-xs leading-none text-muted-foreground">
          {subscriberCount ? <span className="whitespace-nowrap">{subscriberCount}</span> : null}
          {channel.video_count ? <span className="whitespace-nowrap">{t("component.channelInfo.videoCount", { arg0: formatCount(channel.video_count, app.settings.lang) })}</span> : null}
          {channel.clip_count > 0 ? (
            <Link href={`/channel/${channel.id}/clips`} className="whitespace-nowrap text-primary no-underline hover:underline" onClick={(event) => event.stopPropagation()}>
              {t("component.channelInfo.clipCount", { n: channel.clip_count })}
            </Link>
          ) : null}
        </div>

        {channel.top_topics && channel.top_topics.length ? (
          <div className="flex flex-wrap items-center justify-center gap-1 px-2 pb-2">
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

        <Separator />

        <div className="flex items-center justify-center px-1 py-1">
          <ChannelSocials channel={channel} className="justify-center gap-0.5 p-0" />
        </div>
      </Card>
  );
}
