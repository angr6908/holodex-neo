"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChannelList } from "@/components/channel/ChannelList";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG, CHANNEL_TYPES } from "@/lib/consts";
import { localSortChannels } from "@/lib/functions";
import { useDomElement, useSwipeTabs } from "@/lib/hooks";
import {
  ArrowDown,
  Ban,
  Clapperboard,
  Heart,
  LayoutGrid,
  List,
  Radio,
  UserMinus,
} from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useStoredState } from "@/lib/stored-state";
import { cn } from "@/lib/utils";

const Tabs = Object.freeze({ VTUBER: 0, SUBBER: 1, FAVORITES: 2, BLOCKED: 3 });
const DEFAULT_SORT = "subscribers";
// v3: cardView defaults flipped to grid; older stored states pinned the implicit list default.
const KEY = "holodex-v3-channels";
const NAV_SELECT_TRIGGER_CLASS =
  "active:translate-y-px data-[popup-open]:bg-muted! data-[popup-open]:text-foreground!";

type SortOpt = { text: string; value: string; query_value: Record<string, any> };
type State = { category: number; sort: Record<number, string>; cardView: Record<number, boolean> };

const DEFAULT_STATE: State = {
  category: 0,
  sort: { 0: "subscribers", 1: "video_count", 2: "subscribers" },
  cardView: { 0: true, 1: true, 2: true },
};
const NO_ORGS: string[] = [];

function groupByOrg(channels: any[]) {
  const map = new Map<string, any[]>();
  for (const c of channels) {
    const k = c.org || "Other";
    const arr = map.get(k) || [];
    arr.push(c);
    map.set(k, arr);
  }
  return [...map.values()].flat();
}

// Category tabs, then (except on Blocked) the sort picker and the grid/list toggle.
function ChannelsControls({
  category,
  onCategory,
  sortValue,
  sortOptions,
  ascending,
  onSort,
  cardView,
  onCardView,
}: {
  category: number;
  onCategory: (value: number) => void;
  sortValue: string;
  sortOptions: SortOpt[];
  ascending: boolean;
  onSort: (value: string) => void;
  cardView: boolean;
  onCardView: (value: boolean) => void;
}) {
  const t = useTranslations();
  const tabOpts = useMemo(
    () => [
      { value: Tabs.VTUBER, label: t("views.channels.tabs.Vtuber"), icon: Radio },
      { value: Tabs.SUBBER, label: t("views.channels.tabs.Subber"), icon: Clapperboard },
      { value: Tabs.FAVORITES, label: t("views.channels.tabs.Favorites"), icon: Heart },
      { value: Tabs.BLOCKED, label: t("views.channels.tabs.Blocked"), icon: Ban },
    ],
    [t],
  );
  return (
    <div className="flex min-w-max shrink-0 flex-nowrap items-center justify-end gap-1.5">
      <ButtonGroup className="shrink-0">
        {tabOpts.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.value}
              type="button"
              variant="outline"
              size="lg"
              title={tab.label}
              aria-label={tab.label}
              aria-pressed={category === tab.value}
              selected={category === tab.value}
              onClick={() => onCategory(tab.value)}
            >
              <Icon className="size-4" />
              <span className="sr-only">{tab.label}</span>
            </Button>
          );
        })}
      </ButtonGroup>
      {category !== Tabs.BLOCKED ? (
        <Select value={sortValue} onValueChange={onSort}>
          <ButtonGroup className="shrink-0">
            <SelectTrigger buttonLike className={cn("min-w-0", NAV_SELECT_TRIGGER_CLASS)}>
              <SelectValue />
            </SelectTrigger>
            <ButtonGroupText
              className={cn(
                "px-2 text-muted-foreground opacity-40",
                ascending && "[&_svg]:rotate-180",
              )}
            >
              <ArrowDown className="h-4 w-4" />
            </ButtonGroupText>
            <Button
              type="button"
              variant="outline"
              size="lg"
              title={t("views.settings.gridSizeLabel")}
              onClick={() => onCardView(!cardView)}
            >
              {cardView ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
            </Button>
          </ButtonGroup>
          <SelectContent>
            {sortOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

function ChannelsEmpty({ favorites }: { favorites: boolean }) {
  const t = useTranslations();
  return (
    <Empty className="py-24">
      <EmptyMedia variant="icon">
        {favorites ? <Heart className="h-6 w-6" /> : <UserMinus className="h-6 w-6" />}
      </EmptyMedia>
      <EmptyHeader>
        <EmptyDescription>
          {t(favorites ? "views.channels.favoritesAreEmpty" : "views.channels.blockedAreEmpty")}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// Which orgs the list covers: none selected (or the all-vtubers org) means every org.
function orgScope(selectedHomeOrgs: string[] | undefined, currentOrgName: string) {
  const selectedOrgs: string[] = selectedHomeOrgs ?? NO_ORGS;
  const multiOrg = selectedOrgs.length > 1;
  const allVtubers = currentOrgName === ALL_VTUBERS_ORG || selectedOrgs.length === 0;
  return { selectedOrgs, multiOrg, allVtubers, singleOrg: !allVtubers && !multiOrg };
}

// The stored sort when the current tab offers it, else the default, else the first option.
function pickSort(sortOptions: SortOpt[], sortValue: string) {
  return (
    sortOptions.find((o) => o.value === sortValue) ||
    sortOptions.find((o) => o.value === DEFAULT_SORT) ||
    sortOptions[0]
  );
}

function emptyLocalList(
  category: number,
  favorites: any[] | undefined,
  blocked: any[] | undefined,
) {
  if (category === Tabs.FAVORITES && !favorites?.length) return "favorites";
  if (category === Tabs.BLOCKED && !blocked?.length) return "blocked";
  return null;
}

// Favorites and Blocked are listed from local state rather than loaded page by page.
function localChannels(category: number, favorites: any[], blocked: any[] | undefined) {
  if (category === Tabs.FAVORITES) return favorites;
  if (category === Tabs.BLOCKED) return blocked || [];
  return [];
}

export function ChannelsPage({ embedded = false }: { embedded?: boolean }) {
  const app = useAppState();
  const t = useTranslations();
  const portal = useDomElement("channels-panel-portal");
  // Persisted tab/sort/view choices (stored values are merged over the defaults).
  const [state, setState] = useStoredState<State>(KEY, DEFAULT_STATE);
  const { selectedOrgs, multiOrg, allVtubers, singleOrg } = orgScope(
    app.selectedHomeOrgs,
    app.currentOrg.name,
  );
  const orgsKey = JSON.stringify(selectedOrgs);
  const langsKey = app.settings.clipLangs.join(",");
  const groupKey = singleOrg ? "group" : "org";
  const category = state.category;
  const sortValue = state.sort[category];
  const cardView = !!state.cardView[category];

  useEffect(() => {
    document.title = `${t("component.mainNav.channels")} - Holodex`;
  }, [t]);

  const sortOptions = useMemo<SortOpt[]>(
    () => [
      {
        text: t("views.channels.sortOptions.subscribers"),
        value: "subscribers",
        query_value: { sort: "subscriber_count", order: "desc" },
      },
      ...((category === Tabs.VTUBER || category === Tabs.FAVORITES) && singleOrg
        ? [
            {
              text: t("views.channels.sortOptions.group"),
              value: "group",
              query_value: { sort: "suborg", order: "asc" },
            },
          ]
        : []),
      ...(multiOrg || allVtubers
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
    [t, category, singleOrg, multiOrg, allVtubers],
  );

  const currentSort = pickSort(sortOptions, sortValue);

  const setCategory = useCallback(
    (v: number) => setState((p) => ({ ...p, category: v })),
    [setState],
  );
  const swipeTabs = useSwipeTabs((d) => setCategory(Math.max(0, Math.min(3, category + d))));
  const setSort = useCallback(
    (v: string) =>
      setState((p) => ({
        ...p,
        sort: {
          ...p.sort,
          [p.category]: sortOptions.find((o) => o.value === v) ? v : DEFAULT_SORT,
        },
      })),
    [sortOptions, setState],
  );
  const setCardView = useCallback(
    (v: boolean) => setState((p) => ({ ...p, cardView: { ...p.cardView, [p.category]: v } })),
    [setState],
  );

  const { isLoggedIn, fetchFavorites } = app;
  useEffect(() => {
    if (category === Tabs.FAVORITES && isLoggedIn) fetchFavorites();
  }, [category, isLoggedIn, fetchFavorites]);

  const loadFn = useCallback(
    async (offset: number, limit: number) => {
      if (category === Tabs.FAVORITES || category === Tabs.BLOCKED) return [];
      const type = category === Tabs.SUBBER ? CHANNEL_TYPES.SUBBER : CHANNEL_TYPES.VTUBER;
      const sv = currentSort!.query_value;
      const { groupByOrg: gbo, ...apiSv } = sv;
      const base: Record<string, any> = {
        limit,
        offset,
        type,
        ...(type === CHANNEL_TYPES.SUBBER && { lang: langsKey }),
        ...apiSv,
      };
      if (type === CHANNEL_TYPES.VTUBER) {
        if (selectedOrgs.length > 1) {
          const res = await Promise.all(
            selectedOrgs.map((org) => api.channels({ ...base, org }).then((r: any) => r.data)),
          );
          return gbo ? res.flat() : localSortChannels(res.flat(), sv);
        }
        base.org = selectedOrgs.length === 1 ? selectedOrgs[0] : ALL_VTUBERS_ORG;
      }
      const res: any = await api.channels(base);
      return gbo ? groupByOrg(res.data) : res.data;
    },
    [category, currentSort, langsKey, selectedOrgs],
  );

  const perPage = category === Tabs.VTUBER ? 100 : 25;
  const cacheKey = `channel-list-${category}-${currentSort?.value || DEFAULT_SORT}-${app.currentOrg.name}-${orgsKey}-${langsKey}`;
  const sortedFavs = useMemo(
    () => localSortChannels([...(app.favorites || [])], currentSort!.query_value),
    [app.favorites, currentSort],
  );
  const channelList = localChannels(category, sortedFavs, app.settings.blockedChannels);
  const grouped = currentSort?.value === "group" || currentSort?.value === "org";

  const controls = (
    <ChannelsControls
      category={category}
      onCategory={setCategory}
      sortValue={sortValue}
      sortOptions={sortOptions}
      ascending={currentSort?.query_value.order === "asc"}
      onSort={setSort}
      cardView={cardView}
      onCardView={setCardView}
    />
  );

  const empty = emptyLocalList(category, app.favorites, app.settings.blockedChannels);

  return (
    <section
      className={cn(
        "flex min-h-[70vh] flex-col",
        !embedded &&
          "mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-10 pt-(--nav-total-height,120px) sm:px-5",
      )}
      onTouchStart={swipeTabs.onTouchStart}
      onTouchEnd={swipeTabs.onTouchEnd}
      data-embedded={embedded ? "true" : undefined}
    >
      {portal ? createPortal(controls, portal) : null}
      <div>
        {category === Tabs.BLOCKED || category === Tabs.FAVORITES ? (
          <ChannelList
            channels={channelList}
            includeVideoCount
            grouped={grouped}
            groupKey={groupKey}
            cardView={cardView}
          />
        ) : (
          <GenericListLoader cacheKey={cacheKey} infiniteLoad perPage={perPage} loadFn={loadFn}>
            {({ data, isLoading: lod }) => (
              <ChannelList
                channels={data}
                loading={lod && !data.length}
                includeVideoCount
                grouped={grouped}
                groupKey={groupKey}
                cardView={cardView}
              />
            )}
          </GenericListLoader>
        )}
      </div>
      {empty ? <ChannelsEmpty favorites={empty === "favorites"} /> : null}
    </section>
  );
}
