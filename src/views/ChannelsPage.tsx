"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  mdiAccountOff,
  mdiArrowDown,
  mdiHeartOutline,
  mdiViewList,
  mdiViewModule,
} from "@mdi/js";
import { api } from "@/lib/api";
import { CHANNEL_TYPES } from "@/lib/consts";
import { localSortChannels } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { ChannelList } from "@/components/channel/ChannelList";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { cn } from "@/lib/cn";

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

function defaultChannelsState(): ChannelsPersistedState {
  return {
    category: 0,
    sort: { 0: "subscribers", 1: "video_count", 2: "subscribers" },
    cardView: { 0: false, 1: false, 2: false },
  };
}

function readChannelsState(): ChannelsPersistedState {
  if (typeof window === "undefined") return defaultChannelsState();
  try {
    const raw = localStorage.getItem(CHANNELS_STORAGE_KEY);
    return raw
      ? { ...defaultChannelsState(), ...JSON.parse(raw) }
      : defaultChannelsState();
  } catch {
    return defaultChannelsState();
  }
}

function writeChannelsState(value: ChannelsPersistedState) {
  try {
    localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

function stableGroupByOrg(channels: any[]) {
  const orgBuckets = new Map<string, any[]>();
  for (const ch of channels) {
    const org = ch.org || "Other";
    if (!orgBuckets.has(org)) orgBuckets.set(org, []);
    orgBuckets.get(org)!.push(ch);
  }
  return Array.from(orgBuckets.values()).flat();
}

function useMountedElement(id: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => setEl(document.getElementById(id));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);
  return el;
}

export function ChannelsPage({ embedded = false }: { embedded?: boolean }) {
  const app = useAppState();
  const { t } = useI18n();
  const portal = useMountedElement("channels-panel-portal");
  const [persisted, setPersisted] = useState<ChannelsPersistedState>(() =>
    defaultChannelsState(),
  );
  const [identifier, setIdentifier] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const selectedOrgs = app.selectedHomeOrgs || [];
  const selectedOrgsKey = JSON.stringify(selectedOrgs);
  const clipLangsKey = app.settings.clipLangs.join(",");
  const isMultiOrg = selectedOrgs.length > 1;
  const isAllVtubers =
    app.currentOrg.name === "All Vtubers" || selectedOrgs.length === 0;
  const isSingleOrg = !isAllVtubers && !isMultiOrg;
  const groupKey = isSingleOrg ? "group" : "org";
  const category = persisted.category;
  const sortValue = persisted.sort[category];
  const cardView = !!persisted.cardView[category];

  useEffect(() => {
    setPersisted(readChannelsState());
  }, []);
  useEffect(() => {
    writeChannelsState(persisted);
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

  const currentSortValue = useMemo(
    () =>
      sortOptions.find((opt) => opt.value === sortValue) ||
      sortOptions.find((opt) => opt.value === defaultSort) ||
      sortOptions[0],
    [sortOptions, sortValue],
  );
  const tabOptions = useMemo(
    () => [
      { value: Tabs.VTUBER, label: t("views.channels.tabs.Vtuber") },
      { value: Tabs.SUBBER, label: t("views.channels.tabs.Subber") },
      { value: Tabs.FAVORITES, label: t("views.channels.tabs.Favorites") },
      { value: Tabs.BLOCKED, label: t("views.channels.tabs.Blocked") },
    ],
    [t],
  );

  const resetChannels = useCallback(() => setIdentifier((value) => value + 1), []);
  const setCategory = useCallback(
    (value: number) => setPersisted((prev) => ({ ...prev, category: value })),
    [],
  );
  const setSort = useCallback(
    (value: string) =>
      setPersisted((prev) => ({
        ...prev,
        sort: {
          ...prev.sort,
          [prev.category]: sortOptions.find((opt) => opt.value === value)
            ? value
            : defaultSort,
        },
      })),
    [sortOptions],
  );
  const setCardView = useCallback(
    (value: boolean) =>
      setPersisted((prev) => ({
        ...prev,
        cardView: { ...prev.cardView, [prev.category]: value },
      })),
    [],
  );

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
        baseQuery.org = orgs.length === 1 ? orgs[0] : "All Vtubers";
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

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    touchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) setCategory(Math.max(category - 1, 0));
    else setCategory(Math.min(category + 1, 3));
  }

  const panelControls = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        {tabOptions.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={cn(
              "cursor-pointer rounded-xl px-2.5 py-2 text-left text-xs font-medium whitespace-nowrap transition-colors",
              category === tab.value
                ? "bg-[color:var(--color-bold)] text-white"
                : "text-[color:var(--color-muted-foreground)] hover:bg-white/8 hover:text-[color:var(--color-foreground)]",
            )}
            onClick={() => setCategory(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {category !== Tabs.BLOCKED ? (
        <div className="flex items-center gap-1">
          <Select
            value={sortValue}
            options={sortOptions}
            labelKey="text"
            valueKey="value"
            className="h-8 min-w-0 flex-1 text-xs"
            fluid={false}
            onChange={(value) => setSort(value)}
          />
          <span
            className={cn(
              "inline-flex items-center text-xs text-[color:var(--color-muted-foreground)] opacity-40",
              currentSortValue?.query_value.order === "asc" && "rotate-asc",
            )}
          >
            <Icon icon={mdiArrowDown} className="h-4 w-4" />
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCardView(!cardView)}
          >
            <Icon icon={cardView ? mdiViewModule : mdiViewList} />
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <section
      className="flex min-h-[70vh] flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-embedded={embedded ? "true" : undefined}
    >
      {portal ? createPortal(panelControls, portal) : null}
      <div>
        {category === Tabs.BLOCKED || category === Tabs.FAVORITES ? (
          <ChannelList
            channels={channelList}
            includeVideoCount
            grouped={
              currentSortValue?.value === "group" ||
              currentSortValue?.value === "org"
            }
            groupKey={groupKey}
            cardView={cardView}
            showDelete={category === Tabs.BLOCKED}
          />
        ) : (
          <GenericListLoader
            key={cacheKey}
            cacheKey={cacheKey}
            infiniteLoad
            perPage={perPage}
            loadFn={getLoadFn}
          >
            {({ data, isLoading: lod }) => (
              <ChannelList
                channels={data}
                loading={lod && data.length === 0}
                includeVideoCount
                grouped={
                  currentSortValue?.value === "group" ||
                  currentSortValue?.value === "org"
                }
                groupKey={groupKey}
                cardView={cardView}
                showDelete={category === Tabs.SUBBER}
              />
            )}
          </GenericListLoader>
        )}
      </div>
      {category === Tabs.FAVORITES ? (
        <div
          style={{
            display:
              !app.favorites || app.favorites.length === 0 ? undefined : "none",
          }}
          className="flex flex-col items-center justify-center gap-4 py-24 text-center"
        >
          <Icon
            icon={mdiHeartOutline}
            className="h-12 w-12 text-[color:var(--color-muted-foreground)] opacity-40"
          />
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t("views.channels.favoritesAreEmpty")}
          </p>
        </div>
      ) : null}
      {category === Tabs.BLOCKED ? (
        <div
          style={{
            display:
              !app.settings.blockedChannels ||
              app.settings.blockedChannels.length === 0
                ? undefined
                : "none",
          }}
          className="flex flex-col items-center justify-center gap-4 py-24 text-center"
        >
          <Icon
            icon={mdiAccountOff}
            className="h-12 w-12 text-[color:var(--color-muted-foreground)] opacity-40"
          />
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t("views.channels.blockedAreEmpty")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
