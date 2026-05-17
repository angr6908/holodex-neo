"use client";

import { EyeOff, Eye } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelInfo } from "@/components/channel/ChannelInfo";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { ChannelCard } from "@/components/channel/ChannelCard";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";
import { cn, getBreakpoint } from "@/lib/utils";
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
  const t = useTranslations();
  const app = useAppState();
  const isXs = app.windowWidth <= 420;
  const bpCols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 };
  const colSize = bpCols[getBreakpoint(app.windowWidth)];
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

  if (cardView) {
    if (grouped) {
      return (
        <div className="space-y-4">
          {channelsByGroup.map((group, index) => (
            <div key={`card-group-${index}`}>
              <div className="px-2 py-3 text-xl font-medium tracking-tight text-[color:var(--color-foreground)]">
                {group.title}
              </div>
              <div className="grid grid-cols-[repeat(var(--channel-grid-columns,1),minmax(140px,1fr))] gap-x-1 gap-y-[0.35rem]" style={gridStyle}>
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
      <div className="grid grid-cols-[repeat(var(--channel-grid-columns,1),minmax(140px,1fr))] gap-x-1 gap-y-[0.35rem]" style={gridStyle}>
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
          <Collapsible
            key={`list-group-${index}`}
            defaultOpen
            className="overflow-hidden rounded-xl border border-border"
          >
            <div className="flex justify-between gap-3 px-4 py-3">
              <CollapsibleTrigger
                render={
                  <Button type="button" variant="ghost" className="h-auto flex-1 justify-start p-0 text-left text-lg font-medium tracking-tight hover:bg-transparent" />
                }
              >
                {group.title}
              </CollapsibleTrigger>
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
                  {group.hide ? <EyeOff className={cn("size-4", group.hide ? "text-rose-400" : "text-slate-400")} /> : <Eye className={cn("size-4", group.hide ? "text-rose-400" : "text-slate-400")} />}
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
                  <icons.Heart className={cn("size-4", group.allFavorited && app.isLoggedIn
                        ? "text-rose-400"
                        : "text-slate-400")} />
                  {t("views.search.type.all")}
                </Button>
              </div>
            </div>
            <CollapsibleContent>
              {group.items.map((channel: any, index2: number) => (
                <div key={`${channel.id || "channel"}-${index}-${index2}`}>
                  <Separator />
                  <div
                    style={{ opacity: channel.inactive ? 0.5 : 1 }}
                  >
                    {channel ? (
                      <Item className="flex items-start gap-3 rounded-none px-4 py-3 hover:bg-white/5">
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
                      </Item>
                    ) : null}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  }

  if ((channels || []).length > 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        {(channels || []).map((channel, index) => (
          <div key={`${channel.id || "channel"}-${index}`}>
            {index > 0 ? <Separator /> : null}
            <div style={{ opacity: channel.inactive ? 0.5 : 1 }}>
              {channel ? (
                <Item className="flex items-start gap-3 rounded-none px-4 py-3 hover:bg-white/5">
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
                </Item>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((i) => (
          <div key={i}>
            {i > 1 ? <Separator /> : null}
            <div className="flex items-start gap-3 px-4 py-3">
              <Skeleton className="h-[55px] w-[55px] shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
