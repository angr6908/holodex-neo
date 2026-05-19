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

const COL_CLASSES: Record<number, string> = {
  1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5",
};

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
  const gridClass = cn("grid gap-x-1 gap-y-[0.35rem]", COL_CLASSES[cols] || "grid-cols-1");

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
      <Item className="flex items-start gap-3 rounded-none px-4 py-3">
        <div className="shrink-0"><ChannelImg channel={channel} size={55} /></div>
        <ChannelInfo channel={channel} includeVideoCount={includeVideoCount}>
          {isXs ? <ChannelSocials channel={channel} className="justify-start p-0" showDelete /> : null}
        </ChannelInfo>
        {!isXs ? <ChannelSocials channel={channel} showDelete /> : null}
      </Item>
    );

  if (cardView) {
    if (grouped) return (
      <div className="space-y-4">
        {channelsByGroup.map((g, i) => (
          <div key={`card-group-${i}`}>
            <div className="px-2 py-3 text-xl font-semibold tracking-tight text-foreground">{g.title}</div>
            <div className={gridClass}>
              {g.items.map((c: any, j: number) => (
                <div key={`${c.id || "channel"}-${i}-${j}`} className={c.inactive ? "opacity-50" : undefined}>
                  <ChannelCard channel={c} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
    return (
      <div className={gridClass}>
        {(channels || []).map((c, i) => (
          <div key={`${c.id || "channel"}-${i}`} className={c.inactive ? "opacity-50" : undefined}>
            <ChannelCard channel={c} />
          </div>
        ))}
      </div>
    );
  }

  if (grouped) return (
    <div className="space-y-3">
      {channelsByGroup.map((g, i) => (
        <Collapsible key={`list-group-${i}`} defaultOpen className="overflow-hidden rounded-xl border border-border">
          <div className="flex justify-between gap-3 px-4 py-3">
            <CollapsibleTrigger render={<Button type="button" variant="ghost" className="h-auto flex-1 justify-start p-0 text-left text-lg font-semibold tracking-tight hover:bg-transparent" />}>
              {g.title}
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon"
                title={g.hide ? t("component.channelList.enableGroupDisplay") : t("component.channelList.disableGroupDisplay")}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleGroup(g); }}>
                {g.hide ? <EyeOff className="size-4 text-primary" /> : <Eye className="size-4" />}
              </Button>
              <Button variant="outline" size="sm"
                title={!app.isLoggedIn ? t("component.channelList.signInToFavorite") : g.allFavorited ? t("component.channelList.unfavoriteAllInGroup") : t("component.channelList.favoriteAllInGroup")}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavAll(i); }}>
                <icons.Heart className={cn("size-4", g.allFavorited && app.isLoggedIn && "text-primary")} />
                {t("views.search.type.all")}
              </Button>
            </div>
          </div>
          <CollapsibleContent>
            {g.items.map((c: any, j: number) => (
              <div key={`${c.id || "channel"}-${i}-${j}`}>
                <Separator />
                <div className={c.inactive ? "opacity-50" : undefined}>{renderChannelItem(c)}</div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );

  if ((channels || []).length > 0) return (
    <div className="overflow-hidden rounded-xl border border-border">
      {(channels || []).map((c, i) => (
        <div key={`${c.id || "channel"}-${i}`}>
          {i > 0 ? <Separator /> : null}
          <div className={c.inactive ? "opacity-50" : undefined}>{renderChannelItem(c)}</div>
        </div>
      ))}
    </div>
  );

  if (loading) return (
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

  return null;
}
