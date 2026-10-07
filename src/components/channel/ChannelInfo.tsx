"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { Button } from "@/components/ui/button";
import { buildSearchUrl, formatCount } from "@/lib/functions";
import * as icons from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import { channelDisplayName, channelGroup } from "@/lib/video-format";

// "@handle · Org / Group", each part only when present.
function ChannelHandleLine({
  handle,
  orgText,
  org,
}: {
  handle: string;
  orgText: string;
  org?: string;
}) {
  if (!handle && !orgText) return null;
  const orgQS = new URLSearchParams({ org: org || "" }).toString();
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
      {handle ? (
        <a
          href={`https://youtube.com/${handle}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground no-underline hover:text-foreground"
        >
          {handle}
        </a>
      ) : null}
      {handle && orgText ? <span>·</span> : null}
      {orgText ? (
        <Link
          href={`/?${orgQS}`}
          className="text-muted-foreground no-underline hover:text-foreground"
        >
          {orgText}
        </Link>
      ) : null}
    </div>
  );
}

// "N subscribers · N videos · N clips"
function ChannelCountsLine({
  channel,
  subscriberCount,
  includeVideoCount,
}: {
  channel: Record<string, any>;
  subscriberCount: string | null;
  includeVideoCount: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
      {subscriberCount !== null ? <span>{subscriberCount}</span> : null}
      {includeVideoCount ? (
        <>
          {subscriberCount !== null ? <span>·</span> : null}
          <span>{t("component.channelInfo.videoCount", { arg0: channel.video_count })}</span>
          {channel.clip_count > 0 ? (
            <>
              <span>·</span>
              <Link
                href={`/channel/${channel.id}/clips`}
                className="text-primary no-underline hover:underline"
              >
                {t("component.channelInfo.clipCount", { n: channel.clip_count })}
              </Link>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ChannelTopTopics({ channel }: { channel: Record<string, any> }) {
  const router = useRouter();
  async function searchTopic(topicId: string) {
    router.push(
      await buildSearchUrl([
        { type: "channel", value: channel.id, text: channel.name },
        { type: "topic", value: topicId, text: topicId },
      ]),
    );
  }
  if (!channel.top_topics?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {channel.top_topics.slice(0, 3).map((topic: string) => (
        <Button
          key={topic}
          type="button"
          variant="secondary"
          size="xs"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            void searchTopic(topic);
          }}
        >
          {topic}
        </Button>
      ))}
    </div>
  );
}

function orgLine(channel: Record<string, any>, group: string, noGroup: boolean) {
  if (!channel?.org) return "";
  return channel.org + (!noGroup && group ? ` / ${group}` : "");
}

// Identity block used in channel list rows; mirrors the avatar/name/org pattern of WatchInfo
// and the ChannelChip hover card: medium name link, then muted meta lines with `·` separators.
export function ChannelInfo({
  channel,
  includeSocials = false,
  includeVideoCount = false,
  noSubscriberCount = false,
  noGroup = false,
  children,
  className = "",
}: {
  channel: Record<string, any>;
  includeSocials?: boolean;
  includeVideoCount?: boolean;
  noSubscriberCount?: boolean;
  noGroup?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const app = useAppState();
  const t = useTranslations();
  const channelName = channelDisplayName(channel, app.settings.useEnglishName);
  const group = channelGroup(channel);
  const subscriberCount = channel?.subscriber_count
    ? t("component.channelInfo.subscriberCount", {
        n: formatCount(channel.subscriber_count, app.settings.lang),
      })
    : t("component.channelInfo.subscriberNA");
  const orgText = orgLine(channel, group, noGroup);
  const handle = channel?.yt_handle?.[0] || "";

  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}>
      <Link
        href={`/channel/${channel.id}`}
        className="flex min-w-0 items-center gap-1.5 text-[15px] font-medium text-foreground no-underline hover:underline"
      >
        {channel.inactive ? (
          <icons.GraduationCap
            className="size-4 shrink-0 text-muted-foreground"
            aria-label={t("component.channelInfo.inactiveChannel")}
          />
        ) : null}
        <span className="truncate">{channelName}</span>
      </Link>

      <ChannelHandleLine handle={handle} orgText={orgText} org={channel?.org} />
      <ChannelCountsLine
        channel={channel}
        subscriberCount={noSubscriberCount ? null : subscriberCount}
        includeVideoCount={includeVideoCount}
      />
      <ChannelTopTopics channel={channel} />

      {includeSocials ? <ChannelSocials channel={channel} className="mt-1" /> : null}
      {children}
    </div>
  );
}
