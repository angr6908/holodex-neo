"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownAZ, ArrowUpAZ, Grid2x2, LayoutDashboard, LayoutGrid } from "@/lib/icons";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import linkifyHtml from "linkify-html";
import { useDomElement } from "@/lib/hooks";
import { formatCount, getBannerImages } from "@/lib/functions";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
    setChannel({}); setIsLoading(true); setHasError(false); setBannerFailed(false); setBannerAttempt(0);
    api.channel(id).then(({ data }: any) => {
      setChannel(data);
      document.title = `${channelDisplayName(data, app.settings.useEnglishName)} - Holodex`;
      setIsLoading(false);
    }).catch((e) => { console.error(e); setHasError(true); setIsLoading(false); });
  }, [id]);

  const bp = getBreakpoint(app.windowWidth);
  // The banner is a small fixed-size thumbnail now, so always prefer the smallest variants and
  // keep the larger ones only as error fallbacks.
  const bannerSources = useMemo(() => {
    if (!channel.banner) return [];
    const { mobile, tablet, tv, banner } = getBannerImages(channel.banner);
    return [...new Set([mobile, tablet, banner, tv, channel.banner].filter(Boolean))];
  }, [channel.banner]);

  useEffect(() => { setBannerFailed(false); setBannerAttempt(0); }, [channel.banner]);

  const bannerImage = bannerFailed ? "" : bannerSources[bannerAttempt] || "";
  const onBannerError = () => bannerAttempt < bannerSources.length - 1 ? setBannerAttempt((i) => i + 1) : setBannerFailed(true);

  const avatarSize = bp === "xs" || bp === "sm" ? 48 : 56;
  const channelName = channelDisplayName(channel, app.settings.useEnglishName);
  const subCount = channel.subscriber_count ? t("component.channelInfo.subscriberCount", { n: formatCount(channel.subscriber_count, app.settings.lang) }) : "";
  const group = channelGroup(channel);
  const orgQS = new URLSearchParams({ org: channel.org || "" }).toString();
  const tabs = [
    { path: `/channel/${id}/`, name: t("views.channel.video"), exact: true },
    { path: `/channel/${id}/clips`, name: t("views.channel.clips"), hide: channel.type === "subber" },
    { path: `https://music.holodex.net/channel/${id}`, name: t("views.channel.music"), hide: channel.type === "subber" },
    { path: `/channel/${id}/collabs`, name: t("views.channel.collabs"), hide: channel.type === "subber" },
    { path: `/channel/${id}/about`, name: t("views.channel.about") },
  ];
  const isActiveTab = (i: any) => i.path.includes("https") ? false
    : i.exact ? pathname === `/channel/${id}` || pathname === `/channel/${id}/` : pathname.startsWith(i.path);
  const visibleTabs = tabs.filter((i) => !i.hide);
  const tabBtnClass = (compact = false) =>
    cn("h-auto shrink-0 cursor-pointer rounded-lg whitespace-nowrap transition", compact ? "px-2.5 py-1.5 text-xs sm:text-sm" : "px-2.5 py-2 text-[0.8rem]");
  const renderTabLink = (i: any, compact = false) => {
    const ext = i.path.includes("https");
    const render = ext ? <a href={i.path} target="_blank" rel="noreferrer" /> : <Link href={i.path} />;
    return <Button nativeButton={false} key={i.path} render={render} variant={isActiveTab(i) ? "secondary" : "ghost"} size="sm" className={tabBtnClass(compact)}>{i.name}</Button>;
  };
  if (hasError) return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] items-center justify-center px-5 pb-10 pt-[calc(var(--nav-header-height,56px)+0.75rem)] sm:px-8 lg:px-10 xl:px-12">
      <ApiErrorMessage />
    </div>
  );
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 pb-10 pt-[calc(var(--nav-header-height,56px)+0.75rem)] sm:px-8 lg:px-10 xl:px-12">
        {/* Same panel scheme as the watch page sections: card body + muted strip. */}
        <div className="mt-2 overflow-hidden rounded-xl border border-border/60 bg-card/50">
          <div className="flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4">
            <ChannelImg size={avatarSize} channel={channel} noLink className="shrink-0" />
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <>
                  <Skeleton className="mb-1.5 h-5 w-44 max-w-full" />
                  <Skeleton className="h-4 w-64 max-w-full" />
                </>
              ) : (
                <>
                  <Link href={`/channel/${id}`} className="block truncate text-base font-semibold text-foreground no-underline sm:text-lg">
                    {channel.inactive ? <Button variant="ghost" size="icon" className="mr-1 inline-flex h-4 w-4 align-baseline" title={t("component.channelInfo.inactiveChannel")}><icons.GraduationCap className="size-3.5" /></Button> : null}
                    {channelName}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground sm:text-sm">
                    {channel.yt_handle ? <a href={`https://youtube.com/${channel.yt_handle[0]}`} target="_blank" rel="noreferrer" className="text-muted-foreground no-underline hover:text-foreground">{channel.yt_handle[0]}</a> : null}
                    {channel.yt_handle && channel.org ? <span>/</span> : null}
                    {channel.org ? <Link href={`/?${orgQS}`} className="text-muted-foreground no-underline hover:text-foreground">{channel.org + (group ? " / " + group : "")}</Link> : null}
                    {subCount ? <span>{subCount}</span> : null}
                  </div>
                  <ChannelSocials channel={channel} showDelete className="mt-1.5 flex sm:hidden" />
                </>
              )}
            </div>
            <ChannelSocials channel={channel} showDelete className="hidden shrink-0 sm:flex" />
            {/* Reserve the banner slot while the channel loads so the row doesn't reflow when
                the image arrives; only bannerless channels settle the layout once. */}
            {isLoading || bannerImage ? (
              <div className="hidden h-14 w-[280px] shrink-0 overflow-hidden rounded-lg border border-border/60 md:block lg:h-16 lg:w-[320px]">
                {bannerImage
                  ? <img key={bannerImage} src={bannerImage} className="h-full w-full object-cover" alt="" onError={onBannerError} />
                  : <Skeleton className="h-full w-full rounded-none" />}
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-2 py-1.5 sm:px-3">
            <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">{visibleTabs.map((i) => renderTabLink(i, true))}</div>
            <div id="channelTabControls" className="flex shrink-0 items-center gap-1" />
          </div>
        </div>
        <div className="channel min-h-[85vh] py-3">
          {tab === "about" ? <ChannelAbout channel={channel} /> : <ChannelVideos channel={channel} tab={tab} id={id} />}
        </div>
    </section>
  );
}

function ChannelVideos({ channel, tab, id }: { channel: any; tab: "videos" | "clips" | "collabs"; id: string }) {
  const app = useAppState();
  const t = useTranslations();
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const controlsEl = useDomElement("channelTabControls");
  const gs = app.currentGridSize;
  const clipLangsKey = app.settings.clipLangs.join(",");
  const cols = { xs: 1 + gs, sm: 2 + gs, md: 3 + gs, lg: 4 + gs, xl: 5 + gs };
  const gridIcon = [Grid2x2, LayoutDashboard, LayoutGrid][gs] ?? Grid2x2;
  const hasCh = tab === "clips" || tab === "collabs";
  const cacheKey = `channel-videos-${id}-${tab}-${sortOrder}-${clipLangsKey}-${channel.type || ""}`;

  const loadFn = useCallback(async (offset: number, limit: number) => {
    const query = {
      ...(channel.type !== "subber" && { lang: clipLangsKey, type: "stream,placeholder" }),
      ...(tab === "clips" && { status: "past" }),
      include: "clips,live_info", sort: "available_at", order: sortOrder, limit, offset, paginated: true,
    };
    const res = await api.channelVideos(id, { type: tab, query });
    return res.data;
  }, [channel.type, clipLangsKey, id, sortOrder, tab]);

  useEffect(() => {
    const name = tab === "clips" ? t("views.channel.clips") : tab === "collabs" ? t("views.channel.collabs") : t("views.channel.video");
    const ch = channelDisplayName(channel, app.settings.useEnglishName);
    if (ch) document.title = `${ch} - ${name} - Holodex`;
  }, [channel, tab, app.settings.useEnglishName, t]);

  const controls = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" title={sortOrder === "desc" ? t("views.channels.sort.newestFirst") : t("views.channels.sort.oldestFirst")} onClick={() => setSortOrder((v) => v === "desc" ? "asc" : "desc")}>
        {sortOrder === "desc" ? <ArrowUpAZ className="size-5" /> : <ArrowDownAZ className="size-5" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" title={t("views.settings.gridSizeLabel")} onClick={() => app.setCurrentGridSize((gs + 1) % 3)}>
        {(() => { const C = gridIcon; return <C className="size-5" />; })()}
      </Button>
    </div>
  );

  return (
    <>
      {controlsEl ? createPortal(controls, controlsEl) : null}
      <GenericListLoader cacheKey={cacheKey} paginate preloadAdjacent perPage={24} loadFn={loadFn}>
        {({ data, isLoading, isFetching }) => (
          <div className="relative">
            {isFetching && data.length > 0 ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex min-h-32 items-start justify-center rounded-xl bg-background/60 pt-10 backdrop-blur-[1px]">
                <Spinner className="size-6 text-primary" />
              </div>
            ) : null}
            <VideoCardList videos={data} includeChannel={hasCh} cols={cols} dense className={isLoading && data.length === 0 ? "hidden" : undefined} />
            {isLoading && data.length === 0 ? <SkeletonCardList cols={cols} includeChannel={hasCh} includeAvatar={false} dense /> : null}
          </div>
        )}
      </GenericListLoader>
    </>
  );
}

function ChannelAbout({ channel }: { channel: any }) {
  const t = useTranslations();
  const app = useAppState();
  useEffect(() => {
    const ch = channelDisplayName(channel, app.settings.useEnglishName);
    if (ch) document.title = `${ch} - ${t("views.channel.about")} - Holodex`;
  }, [app.settings.useEnglishName, channel, t]);
  return (
    <div className="mx-auto w-full">
      <div className="flex flex-wrap gap-6">
        <div className="w-full text-sm text-muted-foreground md:w-[calc(25%-1.5rem)]">
          <strong className="text-foreground">{t("component.channelInfo.stats")}</strong>
          <Separator className="my-3 bg-border" />
          {t("component.channelInfo.videoCount", { arg0: channel.video_count })}
          <Separator className="my-3 bg-border" />
          {channel.clip_count} {t("component.channelInfo.clipCount", { n: channel.clip_count })}
          <Separator className="my-3 bg-border" />
          {channel.view_count} {t("component.channelInfo.totalViews")}
          <Separator className="my-3 bg-border" />
        </div>
        <div className="w-full flex-1 whitespace-pre-wrap text-sm text-muted-foreground">
          <strong className="text-foreground">{t("component.videoDescription.description")}</strong>
          <br />
          <div dangerouslySetInnerHTML={{ __html: linkifyHtml(channel.description || "") }} />
        </div>
      </div>
    </div>
  );
}
