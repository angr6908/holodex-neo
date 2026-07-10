"use client";

import type { ReactNode } from "react";
import { EyeOff, Eye } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Item } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelInfo } from "@/components/channel/ChannelInfo";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { ChannelCard } from "@/components/channel/ChannelCard";
import { SectionPanel } from "@/components/common/SectionPanel";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";
import { cn, getBreakpoint, GRID_COLUMN_CLASSES } from "@/lib/utils";

export function ChannelList({
  channels, cardView = false, includeVideoCount = false,
  grouped = false, groupKey = "group", loading = false,
}: {
  channels: any[]; cardView?: boolean; includeVideoCount?: boolean;
  grouped?: boolean; groupKey?: string; loading?: boolean;
}) {
  const t = useTranslations();
  const app = useAppState();
  const isXs = app.windowWidth <= 420;
  const cols = ({ xs: 1, sm: 2, md: 3, lg: 4, xl: 5 } as const)[getBreakpoint(app.windowWidth)];
  const gridClass = cn("grid gap-2", GRID_COLUMN_CLASSES[cols] || "grid-cols-1");
  const panelClass = "overflow-hidden rounded-xl border border-border/60 bg-card/50";

  const isHidden = (g: string) => app.settings.hiddenGroups?.[app.currentOrg.name]?.includes(g.toLowerCase()) ?? false;

  const channelsByGroup = (() => {
    const groups: any[] = [];
    let last = "";
    (channels || []).forEach((c) => {
      const g = c?.[groupKey] || "Other";
      if (g !== last) {
        groups.push({ title: g, items: [], allFavorited: true, hide: isHidden(g), org: app.currentOrg.name });
        last = g;
      }
      const cur = groups[groups.length - 1];
      cur.items.push(c);
      if (!app.isFavorited(c.id)) cur.allFavorited = false;
    });
    return groups;
  })();

  function toggleFavAll(i: number) {
    if (!app.isLoggedIn) return;
    const allFav = channelsByGroup[i].allFavorited;
    channelsByGroup[i].items.forEach((c: any) => {
      if ((!app.isFavorited(c.id) && !allFav) || (app.isFavorited(c.id) && allFav)) app.toggleFavorite(c.id);
    });
  }

  function toggleGroup(g: any) {
    const name = `${g.title}`.toLowerCase();
    const hg = { ...(app.settings.hiddenGroups || {}) };
    hg[g.org] = [...(hg[g.org] || [])];
    const i = hg[g.org].findIndex((x: string) => x.toLowerCase() === name);
    if (i >= 0) hg[g.org].splice(i, 1);
    else hg[g.org].push(name);
    app.patchSettings({ hiddenGroups: hg });
  }

  const renderChannelItem = (channel: any) =>
    !channel ? null : (
      <Item className="flex items-center gap-3 rounded-none px-4 py-2.5 transition-colors hover:bg-muted/30">
        <div className="shrink-0"><ChannelImg channel={channel} size={48} /></div>
        <ChannelInfo channel={channel} includeVideoCount={includeVideoCount}>
          {isXs ? <ChannelSocials channel={channel} className="mt-1 justify-start p-0" showDelete /> : null}
        </ChannelInfo>
        {!isXs ? <ChannelSocials channel={channel} className="shrink-0" showDelete /> : null}
      </Item>
    );

  const renderCardGrid = (items: any[], keyPrefix: string, className?: string) => (
    <div className={cn(gridClass, className)}>
      {items.map((c: any, j: number) => (
        <div key={`${c.id || "channel"}-${keyPrefix}-${j}`} className={cn("h-full", c.inactive && "opacity-50")}>
          <ChannelCard channel={c} />
        </div>
      ))}
    </div>
  );

  // Same SectionPanel shell as the watch-page sections, so list and grid groups read
  // identically: title trigger, member count, hide toggle, favorite-all.
  const renderGroup = (g: any, i: number, content: ReactNode) => (
    <SectionPanel
      key={`group-${i}`}
      title={g.title}
      count={g.items.length}
      actions={
        <>
          <Button variant="ghost" size="icon" className="h-8 w-8"
            title={g.hide ? t("component.channelList.enableGroupDisplay") : t("component.channelList.disableGroupDisplay")}
            onClick={() => toggleGroup(g)}>
            {g.hide ? <EyeOff className="size-4 text-primary" /> : <Eye className="size-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8"
            title={!app.isLoggedIn ? t("component.channelList.signInToFavorite") : g.allFavorited ? t("component.channelList.unfavoriteAllInGroup") : t("component.channelList.favoriteAllInGroup")}
            onClick={() => toggleFavAll(i)}>
            <icons.Heart className={cn("size-4", g.allFavorited && app.isLoggedIn && "text-primary")} />
            {t("views.search.type.all")}
          </Button>
        </>
      }
    >
      {content}
    </SectionPanel>
  );

  if (grouped) return (
    <div className="flex flex-col gap-3">
      {channelsByGroup.map((g, i) => renderGroup(g, i, cardView
        ? renderCardGrid(g.items, `${i}`, "p-3")
        : g.items.map((c: any, j: number) => (
            <div key={`${c.id || "channel"}-${i}-${j}`}>
              {j > 0 ? <Separator /> : null}
              <div className={c.inactive ? "opacity-50" : undefined}>{renderChannelItem(c)}</div>
            </div>
          ))))}
    </div>
  );

  if (cardView) return renderCardGrid(channels || [], "flat");

  if ((channels || []).length > 0) return (
    <div className={panelClass}>
      {(channels || []).map((c, i) => (
        <div key={`${c.id || "channel"}-${i}`}>
          {i > 0 ? <Separator /> : null}
          <div className={c.inactive ? "opacity-50" : undefined}>{renderChannelItem(c)}</div>
        </div>
      ))}
    </div>
  );

  if (loading) return (
    <div className={panelClass}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((i) => (
        <div key={i}>
          {i > 1 ? <Separator /> : null}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return null;
}
