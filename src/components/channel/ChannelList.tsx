"use client";

import { useRouter } from "next/navigation";
import { mdiEyeOffOutline, mdiEyeOutline } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelInfo } from "@/components/channel/ChannelInfo";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { ChannelCard } from "@/components/channel/ChannelCard";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import * as icons from "@/lib/icons";

export function ChannelList({
  channels,
  cardView = false,
  includeVideoCount = false,
  grouped = false,
  groupKey = "group",
  loading = false,
}: {
  channels: any[];
  cardView?: boolean;
  includeVideoCount?: boolean;
  grouped?: boolean;
  groupKey?: string;
  loading?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const app = useAppState();
  const isXs = app.windowWidth <= 420;
  const colSize =
    app.windowWidth < 600
      ? 1
      : app.windowWidth < 960
        ? 2
        : app.windowWidth < 1264
          ? 3
          : app.windowWidth < 1904
            ? 4
            : 5;
  const gridStyle = {
    "--channel-grid-columns": colSize,
  } as React.CSSProperties;
  function isHidden(groupName: string) {
    const org = app.currentOrg.name;
    const hiding = app.settings.hiddenGroups;
    if (!hiding) return false;
    if (!Object.keys(hiding).includes(org)) return false;
    return app.settings.hiddenGroups[org].includes(groupName.toLowerCase());
  }

  const channelsByGroup = (() => {
    const groupedChannels: any[] = [];
    let lastGroup = "";
    (channels || []).forEach((c) => {
      const group = c?.[groupKey] || "Other";
      if (group !== lastGroup) {
        groupedChannels.push({
          title: group,
          items: [],
          allFavorited: true,
          hide: isHidden(group),
          org: app.currentOrg.name,
        });
        lastGroup = group;
      }
      groupedChannels[groupedChannels.length - 1].items.push(c);
      if (!app.isFavorited(c.id))
        groupedChannels[groupedChannels.length - 1].allFavorited = false;
    });
    return groupedChannels;
  })();

  function toggleFavoriteAll(index: number) {
    if (!app.isLoggedIn) return;
    const allFav = channelsByGroup[index].allFavorited;
    channelsByGroup[index].items.forEach((c: any) => {
      if ((!app.isFavorited(c.id) && !allFav) || (app.isFavorited(c.id) && allFav))
        app.toggleFavorite(c.id);
    });
  }

  function toggleGroupDisplay(group: any) {
    const groupName = `${group.title}`.toLowerCase();
    const orgName = `${group.org}`;
    const hiddenGroups = { ...(app.settings.hiddenGroups || {}) };
    hiddenGroups[orgName] = [...(hiddenGroups[orgName] || [])];
    const index = hiddenGroups[orgName].findIndex(
      (x: string) => x.toLowerCase() === groupName,
    );
    if (index >= 0) hiddenGroups[orgName].splice(index, 1);
    else hiddenGroups[orgName].push(groupName);
    app.patchSettings({ hiddenGroups });
  }

  function activateChannel(channelId: string, event?: React.MouseEvent | React.KeyboardEvent) {
    if (!channelId) return;
    const target = event?.target;
    if (target instanceof Element && target.closest("a,button,input,textarea,select")) return;
    if (event && "preventDefault" in event) event.preventDefault();
    if (event && "stopPropagation" in event) event.stopPropagation();
    if (event && "metaKey" in event && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      window.open(`/channel/${channelId}`, "_blank", "noopener");
      return;
    }
    router.push(`/channel/${channelId}`);
  }

  if (cardView) {
    if (grouped) {
      return (
        <div className="space-y-4">
          {channelsByGroup.map((group, index) => (
            <div key={`card-group-${index}`}>
              <div className="px-2 py-3 text-xl font-medium tracking-tight text-[color:var(--color-foreground)]">
                {group.title}
              </div>
              <div className="channel-card-grid" style={gridStyle}>
                {group.items.map((channel: any, itemIndex: number) => (
                  <div
                    key={`${channel.id || "channel"}-${index}-${itemIndex}`}
                    style={{ opacity: channel.inactive ? 0.5 : 1 }}
                  >
                    <ChannelCard channel={channel} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="channel-card-grid" style={gridStyle}>
        {(channels || []).map((channel, index) => (
          <div
            key={`${channel.id || "channel"}-${index}`}
            style={{ opacity: channel.inactive ? 0.5 : 1 }}
          >
            <ChannelCard channel={channel} />
          </div>
        ))}
      </div>
    );
  }

  if (grouped) {
    return (
      <div className="space-y-3">
        {channelsByGroup.map((group, index) => (
          <details
            key={`list-group-${index}`}
            open
            className="channel-list-container"
          >
            <summary className="flex cursor-pointer list-none justify-between gap-3 px-4 py-3">
              <div className="flex-1 text-lg font-medium tracking-tight text-[color:var(--color-foreground)]">
                {group.title}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  title={
                    group.hide
                      ? t("component.channelList.enableGroupDisplay")
                      : t("component.channelList.disableGroupDisplay")
                  }
                  onClick={(event: React.MouseEvent) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleGroupDisplay(group);
                  }}
                >
                  <Icon
                    icon={group.hide ? mdiEyeOffOutline : mdiEyeOutline}
                    size="sm"
                    className={group.hide ? "text-rose-400" : "text-slate-400"}
                  />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  title={
                    !app.isLoggedIn
                      ? t("component.channelList.signInToFavorite")
                      : group.allFavorited
                        ? t("component.channelList.unfavoriteAllInGroup")
                        : t("component.channelList.favoriteAllInGroup")
                  }
                  onClick={(event: React.MouseEvent) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleFavoriteAll(index);
                  }}
                >
                  <Icon
                    icon={icons.mdiHeart}
                    size="sm"
                    className={
                      group.allFavorited && app.isLoggedIn
                        ? "text-rose-400"
                        : "text-slate-400"
                    }
                  />
                  {t("views.search.type.all")}
                </Button>
              </div>
            </summary>
            {group.items.map((channel: any, index2: number) => (
              <div key={`${channel.id || "channel"}-${index}-${index2}`}>
                <div className="channel-list-divider" />
                <div
                  style={{ opacity: channel.inactive ? 0.5 : 1 }}
                >
                  {channel ? (
                    <div
                      role="link"
                      tabIndex={0}
                      className="flex cursor-pointer items-start gap-3 px-4 py-3 no-underline hover:bg-white/5"
                      onClick={(event) => activateChannel(channel.id, event)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") activateChannel(channel.id, event);
                      }}
                    >
                      <div className="shrink-0">
                        <ChannelImg channel={channel} size={55} />
                      </div>
                      <ChannelInfo
                        channel={channel}
                        includeVideoCount={includeVideoCount}
                        style={{ width: "80px" }}
                      >
                        {isXs ? (
                          <ChannelSocials
                            channel={channel}
                            className="justify-start p-0"
                            showDelete
                          />
                        ) : null}
                      </ChannelInfo>
                      {!isXs ? (
                        <ChannelSocials channel={channel} showDelete />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </details>
        ))}
      </div>
    );
  }

  if ((channels || []).length > 0) {
    return (
      <div className="channel-list-container">
        {(channels || []).map((channel, index) => (
          <div key={`${channel.id || "channel"}-${index}`}>
            {index > 0 ? <div className="channel-list-divider" /> : null}
            <div style={{ opacity: channel.inactive ? 0.5 : 1 }}>
              {channel ? (
                <div
                  role="link"
                  tabIndex={0}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3 no-underline hover:bg-white/5"
                  onClick={(event) => activateChannel(channel.id, event)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") activateChannel(channel.id, event);
                  }}
                >
                  <div className="shrink-0">
                    <ChannelImg channel={channel} size={55} />
                  </div>
                  <ChannelInfo
                    channel={channel}
                    includeVideoCount={includeVideoCount}
                  >
                    {isXs ? (
                      <ChannelSocials
                        channel={channel}
                        className="justify-start p-0"
                        showDelete
                      />
                    ) : null}
                  </ChannelInfo>
                  {!isXs ? (
                    <ChannelSocials channel={channel} showDelete />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="channel-list-container">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((i) => (
          <div key={i}>
            {i > 1 ? <div className="channel-list-divider" /> : null}
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="h-[55px] w-[55px] shrink-0 animate-pulse rounded-full bg-[color:var(--skeleton-fill)]" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                <div className="h-4 w-3/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
                <div className="h-3 w-2/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
