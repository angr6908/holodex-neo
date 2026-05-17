"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { UserMinus, ArrowDown, Heart, List, LayoutGrid } from "@/lib/icons";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG, CHANNEL_TYPES } from "@/lib/consts";
import { localSortChannels } from "@/lib/functions";
import { readJSON, writeJSON } from "@/lib/browser";
import { useDomElement, useSwipeTabs } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChannelList } from "@/components/channel/ChannelList";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { cn } from "@/lib/utils";
const Tabs = Object.freeze({ VTUBER: 0, SUBBER: 1, FAVORITES: 2, BLOCKED: 3 });
const defaultSort = "subscribers";
const CHANNELS_STORAGE_KEY = "holodex-v2-channels";

type SortOption = {
  text: string;
  value: string;
  query_value: Record<string, any>;
};

type ChannelsPersistedState = {
  category: number;
  sort: Record<number, string>;
  cardView: Record<number, boolean>;
};

const defaultChannelsState = (): ChannelsPersistedState => ({
  category: 0,
  sort: { 0: "subscribers", 1: "video_count", 2: "subscribers" },
  cardView: { 0: false, 1: false, 2: false },
});

const readChannelsState = (): ChannelsPersistedState =>
  ({ ...defaultChannelsState(), ...readJSON(CHANNELS_STORAGE_KEY, {}) });

function stableGroupByOrg(channels: any[]) {
  const buckets = new Map<string, any[]>();
  for (const ch of channels) {
    const org = ch.org || "Other";
    const arr = buckets.get(org) || [];
    arr.push(ch);
    buckets.set(org, arr);
  }
  return Array.from(buckets.values()).flat();
}

export function ChannelsPage({ embedded = false }: { embedded?: boolean }) {
  const app = useAppState();
  const t = useTranslations();
  const portal = useDomElement("channels-panel-portal");
  const [persisted, setPersisted] = useState<ChannelsPersistedState>(() =>
    defaultChannelsState(),
  );
  const [identifier, setIdentifier] = useState(0);
  const selectedOrgs = app.selectedHomeOrgs || [];
  const selectedOrgsKey = JSON.stringify(selectedOrgs);
  const clipLangsKey = app.settings.clipLangs.join(",");
  const isMultiOrg = selectedOrgs.length > 1;
  const isAllVtubers =
    app.currentOrg.name === ALL_VTUBERS_ORG || selectedOrgs.length === 0;
  const isSingleOrg = !isAllVtubers && !isMultiOrg;
  const groupKey = isSingleOrg ? "group" : "org";
  const category = persisted.category;
  const sortValue = persisted.sort[category];
  const cardView = !!persisted.cardView[category];

  useEffect(() => {
    setPersisted(readChannelsState());
  }, []);
  useEffect(() => {
    writeJSON(CHANNELS_STORAGE_KEY, persisted);
  }, [persisted]);
  useEffect(() => {
    document.title = `${t("component.mainNav.channels")} - Holodex`;
  }, [t]);

  const sortOptions = useMemo<SortOption[]>(
    () => [
      {
        text: t("views.channels.sortOptions.subscribers"),
        value: "subscribers",
        query_value: { sort: "subscriber_count", order: "desc" },
      },
      ...((category === Tabs.VTUBER || category === Tabs.FAVORITES) &&
      isSingleOrg
        ? [
            {
              text: t("views.channels.sortOptions.group"),
              value: "group",
              query_value: { sort: "suborg", order: "asc" },
            },
          ]
        : []),
      ...(isMultiOrg || isAllVtubers
        ? [
            {
              text: t("views.channels.sortOptions.org"),
              value: "org",
              query_value: { sort: "suborg", order: "asc", groupByOrg: true },
            },
          ]
        : []),
      {
        text: t("views.channels.sortOptions.videoCount"),
        value: "video_count",
        query_value: { sort: "video_count", order: "desc" },
      },
      ...(category === Tabs.VTUBER || category === Tabs.FAVORITES
        ? [
            {
              text: t("views.channels.sortOptions.clipCount"),
              value: "clip_count",
              query_value: { sort: "clip_count", order: "desc" },
            },
          ]
        : []),
      ...(category === Tabs.VTUBER || category === Tabs.SUBBER
        ? [
            {
              text: t("views.channels.sortOptions.recentUpload"),
              value: "recently_added",
              query_value: { sort: "created_at", order: "desc" },
            },
          ]
        : []),
    ],
    [t, category, isSingleOrg, isMultiOrg, isAllVtubers],
  );

  const currentSortValue =
    sortOptions.find((opt) => opt.value === sortValue) ||
    sortOptions.find((opt) => opt.value === defaultSort) ||
    sortOptions[0];
  const tabOptions = useMemo(
    () => [
      { value: Tabs.VTUBER, label: t("views.channels.tabs.Vtuber") },
      { value: Tabs.SUBBER, label: t("views.channels.tabs.Subber") },
      { value: Tabs.FAVORITES, label: t("views.channels.tabs.Favorites") },
      { value: Tabs.BLOCKED, label: t("views.channels.tabs.Blocked") },
    ],
    [t],
  );

  const resetChannels = useCallback(() => setIdentifier((v) => v + 1), []);
  const setCategory = useCallback((value: number) => setPersisted((p) => ({ ...p, category: value })), []);
  const swipeTabs = useSwipeTabs((dir) => setCategory(Math.max(0, Math.min(3, category + dir))));
  const setSort = useCallback((value: string) => setPersisted((p) => ({
    ...p,
    sort: { ...p.sort, [p.category]: sortOptions.find((o) => o.value === value) ? value : defaultSort },
  })), [sortOptions]);
  const setCardView = useCallback((value: boolean) => setPersisted((p) => ({
    ...p, cardView: { ...p.cardView, [p.category]: value },
  })), []);

  useEffect(() => {
    resetChannels();
    if (category === Tabs.FAVORITES && app.isLoggedIn) app.fetchFavorites();
  }, [category]);

  useEffect(() => {
    if (category !== Tabs.FAVORITES) resetChannels();
  }, [sortValue]);

  useEffect(() => {
    if (!sortOptions.find((opt) => opt.value === sortValue))
      setSort(defaultSort);
    resetChannels();
  }, [app.currentOrg.name, selectedOrgsKey, sortOptions.length]);

  const getLoadFn = useCallback(
    async (offset: number, limit: number) => {
      if (category === Tabs.FAVORITES || category === Tabs.BLOCKED) return [];
      const type =
        category === Tabs.SUBBER ? CHANNEL_TYPES.SUBBER : CHANNEL_TYPES.VTUBER;
      const sortVal = currentSortValue!.query_value;
      const { groupByOrg, ...apiSortVal } = sortVal;
      const baseQuery: Record<string, any> = {
        limit,
        offset,
        type,
        ...(type === CHANNEL_TYPES.SUBBER && { lang: clipLangsKey }),
        ...apiSortVal,
      };

      if (type === CHANNEL_TYPES.VTUBER) {
        const orgs = selectedOrgs;
        if (orgs.length > 1) {
          const results = await Promise.all(
            orgs.map((org: string) =>
              api.channels({ ...baseQuery, org }).then((r: any) => r.data),
            ),
          );
          if (groupByOrg) return results.flat();
          return localSortChannels(results.flat(), sortVal);
        }
        baseQuery.org = orgs.length === 1 ? orgs[0] : ALL_VTUBERS_ORG;
      }

      const res: any = await api.channels(baseQuery);
      if (groupByOrg) return stableGroupByOrg(res.data);
      return res.data;
    },
    [category, currentSortValue, clipLangsKey, selectedOrgsKey, selectedOrgs],
  );

  const perPage = category === Tabs.VTUBER ? 100 : 25;
  const cacheKey = `channel-list-${category}-${identifier}`;
  const sortedFavorites = useMemo(
    () =>
      localSortChannels(
        [...(app.favorites || [])],
        currentSortValue!.query_value,
      ),
    [app.favorites, currentSortValue],
  );
  const channelList =
    category === Tabs.FAVORITES
      ? sortedFavorites
      : category === Tabs.BLOCKED
        ? app.settings.blockedChannels || []
        : [];

  const panelControls = (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        value={[String(category)]}
        onValueChange={(value) => { if (value[0]) setCategory(Number(value[0])); }}
        className="flex-col items-stretch gap-1"
      >
        {tabOptions.map((tab) => (
          <ToggleGroupItem
            key={tab.value}
            value={String(tab.value)}
            size="sm"
            className="h-auto cursor-pointer justify-start rounded-xl px-2.5 py-2 text-left text-xs font-medium whitespace-nowrap transition-colors data-[state=on]:bg-[color:var(--color-bold)] data-[state=on]:text-white data-[state=on]:hover:bg-[color:var(--color-bold)] data-[state=on]:hover:text-white data-[state=off]:text-[color:var(--color-muted-foreground)] data-[state=off]:hover:bg-white/8 data-[state=off]:hover:text-[color:var(--color-foreground)]"
          >
            {tab.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {category !== Tabs.BLOCKED ? (
        <div className="flex items-center gap-1">
          <Select value={sortValue} onValueChange={setSort}>
            <SelectTrigger size="sm" className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
            {sortOptions.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.text}</SelectItem>
            ))}
            </SelectContent>
          </Select>
          <span
            className={cn(
              "inline-flex items-center text-xs text-[color:var(--color-muted-foreground)] opacity-40",
              currentSortValue?.query_value.order === "asc" && "rotate-180",
            )}
          >
            <ArrowDown className="h-4 w-4" />
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCardView(!cardView)}
          >
            {cardView ? <LayoutGrid className="size-5" /> : <List className="size-5" />}
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <section
      className={cn("flex min-h-[70vh] flex-col", !embedded && "app-page")}
      onTouchStart={swipeTabs.onTouchStart}
      onTouchEnd={swipeTabs.onTouchEnd}
      data-embedded={embedded ? "true" : undefined}
    >
      {portal ? createPortal(panelControls, portal) : null}
      <div>
        {(() => {
          const grouped = currentSortValue?.value === "group" || currentSortValue?.value === "org";
          if (category === Tabs.BLOCKED || category === Tabs.FAVORITES) {
            return <ChannelList channels={channelList} includeVideoCount grouped={grouped} groupKey={groupKey} cardView={cardView} />;
          }
          return (
            <GenericListLoader key={cacheKey} cacheKey={cacheKey} infiniteLoad perPage={perPage} loadFn={getLoadFn}>
              {({ data, isLoading: lod }) => (
                <ChannelList channels={data} loading={lod && data.length === 0} includeVideoCount grouped={grouped} groupKey={groupKey} cardView={cardView} />
              )}
            </GenericListLoader>
          );
        })()}
      </div>
      {(() => {
        const isFavEmpty = category === Tabs.FAVORITES && !(app.favorites?.length);
        const isBlockedEmpty = category === Tabs.BLOCKED && !(app.settings.blockedChannels?.length);
        if (!isFavEmpty && !isBlockedEmpty) return null;
        return (
          <Empty className="py-24">
            <EmptyMedia variant="icon">{isFavEmpty ? <Heart className="h-6 w-6" /> : <UserMinus className="h-6 w-6" />}</EmptyMedia>
            <EmptyHeader><EmptyDescription>{t(isFavEmpty ? "views.channels.favoritesAreEmpty" : "views.channels.blockedAreEmpty")}</EmptyDescription></EmptyHeader>
          </Empty>
        );
      })()}
    </section>
  );
}
