"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { buildSearchUrl, formatCount } from "@/lib/functions";
import { channelDisplayName, channelGroup } from "@/lib/video-format";
import * as icons from "@/lib/icons";

function Separator() {
  return <div role="none" className="h-px w-full shrink-0 bg-[color:var(--color-border)]" />;
}

export function ChannelCard({ channel }: { channel: Record<string, any> }) {
  const router = useRouter();
  const app = useAppState();
  const { t } = useI18n();
  const channelName = channelDisplayName(channel, app.settings.nameProperty === "english_name");
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
  function activateCard(event?: React.MouseEvent | React.KeyboardEvent) {
    const target = event?.target;
    if (target instanceof Element && target.closest("a,button,input,textarea,select")) return;
    event?.preventDefault();
    event?.stopPropagation();
    if (event && "metaKey" in event && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      window.open(`/channel/${channel.id}`, "_blank", "noopener");
      return;
    }
    router.push(`/channel/${channel.id}`);
  }

  if (!channel) return null;
  return (
    <div
      role="link"
      tabIndex={0}
      className="channel-card no-decoration block cursor-pointer"
      onClick={activateCard}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") activateCard(event);
      }}
    >
      <div className="channel-card-shell w-full overflow-hidden border border-[color:var(--color-border)]">
        <div className="flex flex-col items-center gap-1.5 px-3 pt-4 pb-2.5">
          <ChannelImg channel={channel} size={52} noLink />
          <div className="w-full min-w-0 text-center">
            <div className="truncate text-sm font-semibold leading-tight text-[color:var(--color-foreground)]">
              {channel.inactive ? <Icon icon={icons.mdiSchool} className="mr-0.5 inline-block h-3.5 w-3.5 align-[-2px] text-[color:var(--color-muted-foreground)]" /> : null}
              {channelName}
            </div>
            {channel.org ? <div className="mt-0.5 truncate text-xs leading-tight text-[color:var(--color-muted-foreground)]">{channel.org}{group ? " / " + group : ""}</div> : null}
            {channel.yt_handle ? <div className="mt-0.5 truncate text-[11px] leading-tight text-[color:var(--color-muted-foreground)] opacity-70">{channel.yt_handle[0]}</div> : null}
          </div>
        </div>

        <Separator />

        <div className="channel-card-stats flex items-center justify-center gap-3 px-2 py-2 text-xs leading-none text-[color:var(--color-muted-foreground)]">
          {subscriberCount ? <span className="whitespace-nowrap">{subscriberCount}</span> : null}
          {channel.video_count ? <span className="whitespace-nowrap">{t("component.channelInfo.videoCount", [formatCount(channel.video_count, app.settings.lang)])}</span> : null}
          {channel.clip_count > 0 ? (
            <Link href={`/channel/${channel.id}/clips`} className="whitespace-nowrap text-[color:var(--color-primary)] no-underline hover:underline" onClick={(event) => event.stopPropagation()}>
              {t("component.channelInfo.clipCount", { n: channel.clip_count })}
            </Link>
          ) : null}
        </div>

        {channel.top_topics && channel.top_topics.length ? (
          <div className="flex flex-wrap items-center justify-center gap-1 px-2 pb-2">
            {channel.top_topics.slice(0, 3).map((topic: string) => (
              <Badge key={topic} variant="secondary" className="channel-topic-badge cursor-pointer px-1.5 py-0.5 text-[11px] capitalize leading-tight tracking-normal" onClick={(event) => { event.stopPropagation(); event.preventDefault(); void searchTopic(topic); }}>
                {topic}
              </Badge>
            ))}
          </div>
        ) : null}

        <Separator />

        <div className="channel-card-footer flex items-center justify-center px-1 py-1">
          <ChannelSocials channel={channel} className="justify-center p-0" />
        </div>
      </div>
    </div>
  );
}
