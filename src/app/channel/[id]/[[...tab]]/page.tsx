"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownAZ, ArrowUpAZ, LayoutDashboard, Grid2x2, LayoutGrid } from "@/lib/icons";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import linkifyHtml from "linkifyjs/html";
import { useDomElement } from "@/lib/hooks";
import { encodeCookieJson, HOME_STATE_COOKIE, type HomeUiState, HOME_STATE_STORAGE_KEY, HOME_TABS, primeHomePageState } from "@/lib/cookie-codec";
import { formatCount, getBannerImages } from "@/lib/functions";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { HomeSidePanel } from "@/components/home/HomeSidePanel";
import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { VideoCardList } from "@/components/video/VideoCardList";
import { SkeletonCardList } from "@/components/video/SkeletonCardList";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import * as icons from "@/lib/icons";
import { cn, getBreakpoint } from "@/lib/utils";
import { channelDisplayName, channelGroup } from "@/lib/video-format";
export default function ChannelPage() {
  const params = useParams<{ id: string; tab?: string[] }>();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.id;
  const routeTab = params.tab?.[0];
  const tab = routeTab === "clips" || routeTab === "collabs" || routeTab === "about" ? routeTab : "videos";
  const app = useAppState();
  const t = useTranslations();
  const [channel, setChannel] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);
  const [bannerAttempt, setBannerAttempt] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    setChannel({});
    setIsLoading(true);
    setHasError(false);
    setBannerFailed(false);
    setBannerAttempt(0);
    api.channel(id).then(({ data }: any) => { setChannel(data); document.title = `${channelDisplayName(data, app.settings.useEnglishName)} - Holodex`; setIsLoading(false); }).catch((e) => { console.error(e); setHasError(true); setIsLoading(false); });
  }, [id]);
  const breakpointName = getBreakpoint(app.windowWidth);
  const bannerSources = useMemo(() => {
    if (!channel.banner) return [];
    const { mobile, tablet, tv, banner } = getBannerImages(channel.banner);
    const banners: Record<string, string> = { xs: mobile, sm: tablet, xl: tv };
    return Array.from(new Set([
      banners[breakpointName] || banner,
      banner,
      tablet,
      mobile,
      tv,
      channel.banner,
    ].filter(Boolean)));
  }, [channel.banner, breakpointName]);
  useEffect(() => {
    setBannerFailed(false);
    setBannerAttempt(0);
  }, [channel.banner, breakpointName]);
  const bannerImage = bannerFailed ? "" : bannerSources[bannerAttempt] || "";
  function onBannerError() {
    if (bannerAttempt < bannerSources.length - 1) {
      setBannerAttempt((index) => index + 1);
      return;
    }
    setBannerFailed(true);
  }
  const avatarSize = breakpointName === "xs" || breakpointName === "sm" ? 48 : 72;
  const channelName = channelDisplayName(channel, app.settings.useEnglishName);
  const subscriberCount = channel.subscriber_count ? t("component.channelInfo.subscriberCount", { n: formatCount(channel.subscriber_count, app.settings.lang) }) : "";
  const group = channelGroup(channel);
  const channelOrg = new URLSearchParams({ org: channel.org || "" }).toString();
  const tabs = [
    { path: `/channel/${id}/`, name: `${t("views.channel.video")}`, exact: true },
    { path: `/channel/${id}/clips`, name: `${t("views.channel.clips")}`, hide: channel.type === "subber" },
    { path: `https://music.holodex.net/channel/${id}`, name: `${t("views.channel.music")}`, hide: channel.type === "subber" },
    { path: `/channel/${id}/collabs`, name: `${t("views.channel.collabs")}`, hide: channel.type === "subber" },
    { path: `/channel/${id}/about`, name: `${t("views.channel.about")}` },
  ];
  function isActiveTab(item: any) {
    if (item.path.includes("https")) return false;
    if (item.exact) return pathname === `/channel/${id}` || pathname === `/channel/${id}/`;
    return pathname.startsWith(item.path);
  }
  const visibleTabs = tabs.filter((item) => !item.hide);
  const activeTabClass = "bg-[color:var(--color-bold)] text-white hover:bg-[color:var(--color-bold)] hover:text-white";
  const inactiveTabClass =
    "text-[color:var(--color-muted-foreground)] hover:bg-white/8 hover:text-[color:var(--color-foreground)]";
  const tabButtonClass = (item: any, compact = false) => cn(
    "h-auto cursor-pointer rounded-xl whitespace-nowrap transition",
    compact ? "px-2.5 py-1.5 text-xs sm:text-sm" : "px-2.5 py-2 text-[0.8rem]",
    isActiveTab(item) ? activeTabClass : inactiveTabClass,
  );
  const renderTabLink = (item: any, compact = false) =>
    item.path.includes("https") ? (
      <Button nativeButton={false}
        key={item.path}
        render={<a href={item.path} target="_blank" rel="noreferrer" />}
        variant="ghost"
        size="sm"
        className={tabButtonClass(item, compact)}
      >
        {item.name}
      </Button>
    ) : (
      <Button nativeButton={false}
        key={item.path}
        render={<Link href={item.path} />}
        variant="ghost"
        size="sm"
        className={tabButtonClass(item, compact)}
      >
        {item.name}
      </Button>
    );
  const hideUpcoming = app.settings.hideUpcoming;
  const hideLive = app.settings.hideLive;
  const hideBothLiveUpcoming = hideLive && hideUpcoming;
  const live = app.homeLive || [];
  const livesVisible = hideLive ? [] : live.filter((v: any) => v.status === "live");
  const upcoming = hideUpcoming ? [] : live.filter((v: any) => v.status === "upcoming");
	  const liveUpcomingHeaderSplit = useMemo(() => {
	    const match = String(
	      t("views.home.liveOrUpcomingHeading") || "Live / Upcoming",
	    ).match(/(.+)([\/／・].+)/);
	    return match || ["", t("views.home.liveLabel"), ` / ${t("views.home.upcomingLabel")}`];
	  }, [t]);

  function openHomeState(next: HomeUiState) {
    const value = {
      viewMode: next.viewMode ?? "streams",
      isFavPage: next.isFavPage ?? false,
      tab: next.tab ?? HOME_TABS.LIVE_UPCOMING,
      scrollY: 0,
    };
    try {
      localStorage.setItem(HOME_STATE_STORAGE_KEY, JSON.stringify(value));
      const encoded = encodeCookieJson(value);
      if (encoded) document.cookie = `${HOME_STATE_COOKIE}=${encoded}; Path=/; SameSite=Lax`;
    } catch {}
    primeHomePageState(value);
    router.push("/");
  }

  if (isLoading || hasError) return (
    <div className="app-page flex items-center justify-center">
      {isLoading && !hasError ? (
        <Card className="inline-flex flex-row items-center gap-3 rounded-lg px-4 py-3">
          <Spinner />
        </Card>
      ) : null}
      {hasError ? <ApiErrorMessage /> : null}
    </div>
  );
  return (
    <section className="app-page flex">
      <HomeSidePanel
        isFavPage={false}
        viewMode="streams"
        tab={HOME_TABS.LIVE_UPCOMING}
        hideBothLiveUpcoming={hideBothLiveUpcoming}
        hideLive={hideLive}
        hideUpcoming={hideUpcoming}
        liveUpcomingHeaderSplit={liveUpcomingHeaderSplit}
        livesVisibleCount={livesVisible.length}
        upcomingCount={upcoming.length}
        isMobile={app.isMobile}
        showPortals={false}
        onHome={() => openHomeState({ viewMode: "streams", isFavPage: false, tab: HOME_TABS.LIVE_UPCOMING })}
        onFavorites={() => openHomeState({ viewMode: "streams", isFavPage: true, tab: HOME_TABS.LIVE_UPCOMING })}
        onStreams={(nextTab) => openHomeState({ viewMode: "streams", isFavPage: false, tab: nextTab })}
        onChannels={() => openHomeState({ viewMode: "channels", isFavPage: false, tab: HOME_TABS.LIVE_UPCOMING })}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Card className="mx-auto mt-2 aspect-[6.2/1] w-[calc(100%-1rem)] gap-0 overflow-hidden rounded-2xl border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0 shadow-none sm:m-0 sm:w-full">
          {bannerImage ? (
            <img key={bannerImage} src={bannerImage} className="block h-full w-full object-cover" alt="" onError={onBannerError} />
          ) : null}
        </Card>
        <div className="px-3 pt-3 sm:px-5 sm:pt-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <ChannelImg size={avatarSize} channel={channel} noLink className="shrink-0" />
            <div className="min-w-0 flex-1">
              <Link href={`/channel/${id}`} className="block truncate text-base font-semibold text-[color:var(--color-foreground)] no-underline sm:text-lg">
                {channel.inactive ? (
                  <Button variant="ghost" size="icon" className="mr-1 inline-flex h-4 w-4 align-baseline" title={t("component.channelInfo.inactiveChannel")}>
                    <icons.GraduationCap className="size-3.5" />
                  </Button>
                ) : null}
                {channelName}
              </Link>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-[color:var(--color-muted-foreground)] sm:text-sm">
                {channel.yt_handle ? (
                  <a href={`https://youtube.com/${channel.yt_handle[0]}`} target="_blank" rel="noreferrer" className="text-[color:var(--color-muted-foreground)] no-underline hover:text-[color:var(--color-foreground)]">
                    {channel.yt_handle[0]}
                  </a>
                ) : null}
                {channel.yt_handle && channel.org ? <span>/</span> : null}
                {channel.org ? (
                  <Link href={`/?${channelOrg}`} className="text-[color:var(--color-muted-foreground)] no-underline hover:text-[color:var(--color-foreground)]">
                    {channel.org + (group ? " / " + group : "")}
                  </Link>
                ) : null}
                {subscriberCount ? <span>{subscriberCount}</span> : null}
              </div>
            </div>
            <ChannelSocials channel={channel} showDelete className="hidden shrink-0 sm:flex" />
          </div>
          <ChannelSocials channel={channel} showDelete className="mt-2 flex shrink-0 sm:hidden" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--color-border)] px-2 pt-2 sm:px-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleTabs.map((item) => renderTabLink(item, true))}
          </div>
          <div id="channelTabControls" className="flex items-center gap-1" />
        </div>
        <div className="channel min-h-[85vh] px-2 py-3 sm:px-0">
          {tab === "about" ? <ChannelAbout channel={channel} /> : <ChannelVideos channel={channel} tab={tab} id={id} />}
        </div>
      </div>
    </section>
  );
}

function ChannelVideos({ channel, tab, id }: { channel: any; tab: "videos" | "clips" | "collabs"; id: string }) {
  const app = useAppState();
  const t = useTranslations();
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const controlsEl = useDomElement("channelTabControls");
  const pageLength = 24;
  const type = tab;
  const loaderKey = `${id}-${type}-${sortOrder}`;
  const currentGridSize = app.currentGridSize;
  const colSizes = { xs: 1 + currentGridSize, sm: 2 + currentGridSize, md: 3 + currentGridSize, lg: 4 + currentGridSize, xl: 5 + currentGridSize };
  let gridIcon = Grid2x2;
  if (currentGridSize === 1) gridIcon = LayoutDashboard;
  else if (currentGridSize === 2) gridIcon = LayoutGrid;
  const hasChannelInfo = tab === "clips" || tab === "collabs";

  const getLoadFn = useCallback(async (offset: number, limit: number) => {
    const query = {
      ...(channel.type !== "subber" && { lang: app.settings.clipLangs.join(","), type: "stream,placeholder" }),
      ...(type === "clips" && { status: "past" }),
      include: "clips,live_info",
      sort: "available_at",
      order: sortOrder,
      limit,
      offset,
      paginated: true,
    };
    const res = await api.channelVideos(id, { type, query });
    return res.data;
  }, [app.settings.clipLangs, channel.type, id, sortOrder, type]);

  useEffect(() => {
    const tabName = type === "clips" ? t("views.channel.clips") : type === "collabs" ? t("views.channel.collabs") : t("views.channel.video");

    const channelName = channelDisplayName(channel, app.settings.useEnglishName);
    if (channelName) document.title = `${channelName} - ${tabName} - Holodex`;
  }, [channel, type, app.settings.useEnglishName, t]);

  function toggleSort() { setSortOrder((value) => value === "desc" ? "asc" : "desc"); }
  function cycleGridSize() { app.setCurrentGridSize((currentGridSize + 1) % 3); }

  function renderControls() {
    return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" title={sortOrder === "desc" ? t("views.channels.sort.newestFirst") : t("views.channels.sort.oldestFirst")} onClick={toggleSort}>
        {sortOrder === "desc" ? <ArrowUpAZ className="size-5" /> : <ArrowDownAZ className="size-5" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" title={t("views.settings.gridSizeLabel")} onClick={cycleGridSize}>
        {(() => { const C = gridIcon; return <C className="size-5"  />; })()}
      </Button>
    </div>
    );
  }

  return (
    <>
      {controlsEl ? createPortal(renderControls(), controlsEl) : null}
      <GenericListLoader key={loaderKey} paginate perPage={pageLength} loadFn={getLoadFn}>
        {({ data, isLoading }) => (
          <>
            <VideoCardList videos={data} includeChannel={hasChannelInfo} cols={colSizes} dense className={isLoading ? "hidden" : undefined} />
            {isLoading ? <SkeletonCardList cols={colSizes} includeAvatar={hasChannelInfo} dense /> : null}
          </>
        )}
      </GenericListLoader>
    </>
  );
}

function ChannelAbout({ channel }: { channel: any }) {
  const t = useTranslations();
  const app = useAppState();
  useEffect(() => {
    const channelName = channelDisplayName(channel, app.settings.useEnglishName);
    if (channelName) document.title = `${channelName} - ${t("views.channel.about")} - Holodex`;
  }, [app.settings.useEnglishName, channel, t]);
  return (
    <div className="mx-auto w-full">
      <div className="flex flex-wrap gap-6">
        <div className="w-full text-sm text-[color:var(--color-muted-foreground)] md:w-[calc(25%-1.5rem)]">
          <strong className="text-[color:var(--color-foreground)]">{t("component.channelInfo.stats")}</strong>
          <Separator className="my-3 bg-[color:var(--color-border)]" />
          {t("component.channelInfo.videoCount", { arg0: channel.video_count })}
          <Separator className="my-3 bg-[color:var(--color-border)]" />
          {channel.clip_count} {t("component.channelInfo.clipCount", { n: channel.clip_count })}
          <Separator className="my-3 bg-[color:var(--color-border)]" />
          {channel.view_count} {t("component.channelInfo.totalViews")}
          <Separator className="my-3 bg-[color:var(--color-border)]" />
        </div>
        <div className="w-full flex-1 whitespace-pre-wrap text-sm text-[color:var(--color-muted-foreground)]">
          <strong className="text-[color:var(--color-foreground)]">{t("component.videoDescription.description")}</strong>
          <br />
          <div dangerouslySetInnerHTML={{ __html: linkifyHtml(channel.description || "") }} />
        </div>
      </div>
    </div>
  );
}
