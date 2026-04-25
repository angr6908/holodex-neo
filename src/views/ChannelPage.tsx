"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { mdiSortAscending, mdiSortDescending } from "@mdi/js";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { vueLinkifyHtml } from "@/lib/linkify";
import { formatCount, getBannerImages } from "@/lib/functions";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { VideoCardList } from "@/components/video/VideoCardList";
import { SkeletonCardList } from "@/components/video/SkeletonCardList";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import * as icons from "@/lib/icons";
import { cn } from "@/lib/cn";
import { channelDisplayName, channelGroup } from "@/lib/video-format";
import { mdiViewComfy, mdiViewGrid, mdiViewModule } from "@/lib/icons";

export function ChannelPage({ tab = "videos" }: { tab?: "videos" | "clips" | "collabs" | "about" }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const id = params.id;
  const app = useAppState();
  const { t } = useI18n();
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
    api.channel(id).then(({ data }: any) => { setChannel(data); document.title = `${channelDisplayName(data, app.settings.nameProperty === "english_name")} - Holodex`; setIsLoading(false); }).catch((e) => { console.error(e); setHasError(true); setIsLoading(false); });
  }, [id]);
  const breakpointName = app.windowWidth < 600 ? "xs" : app.windowWidth < 960 ? "sm" : app.windowWidth < 1264 ? "md" : app.windowWidth < 1904 ? "lg" : "xl";
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
  const channelName = channelDisplayName(channel, app.settings.nameProperty === "english_name");
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

  if (isLoading || hasError) return <LoadingOverlay isLoading={isLoading} showError={hasError} />;
  return (
    <section className="channel-container">
      <div className="channel-banner-wrap">{bannerImage ? <img key={bannerImage} src={bannerImage} className="channel-banner" alt="" onError={onBannerError} /> : null}</div>
      <div className="channel-header">
        <div className="channel-identity">
          <ChannelImg size={avatarSize} channel={channel} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <Link href={`/channel/${id}`} className="truncate text-base font-semibold text-white no-underline sm:text-lg">
                {channel.inactive ? <Button variant="ghost" size="icon" className="mr-1 inline-flex h-4 w-4 align-baseline" title={t("component.channelInfo.inactiveChannel")}><Icon icon={icons.mdiSchool} size="xs" /></Button> : null}
                {channelName}
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 sm:text-sm">
              {channel.yt_handle ? <a href={`https://youtube.com/${channel.yt_handle[0]}`} target="_blank" rel="noreferrer" className="text-slate-500 no-underline hover:text-slate-300">{channel.yt_handle[0]}</a> : null}
              {channel.yt_handle && channel.org ? <span className="text-slate-600">•</span> : null}
              {channel.org ? <Link href={`/?${channelOrg}`} className="text-slate-500 no-underline hover:text-slate-300">{channel.org + (group ? " / " + group : "")}</Link> : null}
              {channel.subscriber_count ? <span className="text-slate-600">•</span> : null}
              {channel.subscriber_count ? <span>{subscriberCount}</span> : null}
            </div>
          </div>
          <ChannelSocials channel={channel} showDelete className="hidden shrink-0 sm:flex" />
        </div>
        <ChannelSocials channel={channel} showDelete className="flex shrink-0 sm:hidden" />
      </div>
      <div className="channel-tabs">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.filter((item) => !item.hide).map((item) => item.path.includes("https") ? <a key={item.path} href={item.path} target="_blank" rel="noreferrer" className={cn("inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition", isActiveTab(item) ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]" : "text-slate-400 hover:bg-white/8 hover:text-white")}>{item.name}</a> : <Link key={item.path} href={item.path} className={cn("inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition", isActiveTab(item) ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]" : "text-slate-400 hover:bg-white/8 hover:text-white")}>{item.name}</Link>)}
        </div>
        <div id="channelTabControls" className="flex items-center gap-1" />
      </div>
      <div className="channel min-h-[85vh] px-2 py-3 sm:px-0">
        {tab === "about" ? <ChannelAbout channel={channel} /> : <ChannelVideos channel={channel} tab={tab} id={id} />}
      </div>
    </section>
  );
}

function ChannelVideos({ channel, tab, id }: { channel: any; tab: "videos" | "clips" | "collabs"; id: string }) {
  const app = useAppState();
  const { t } = useI18n();
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [controlsEl, setControlsEl] = useState<HTMLElement | null>(null);
  const pageLength = 24;
  const type = tab === "clips" ? "clips" : tab === "collabs" ? "collabs" : "videos";
  const loaderKey = `${id}-${type}-${sortOrder}`;
  const currentGridSize = app.currentGridSize;
  const colSizes = { xs: 1 + currentGridSize, sm: 2 + currentGridSize, md: 3 + currentGridSize, lg: 4 + currentGridSize, xl: 5 + currentGridSize };
  const gridIcon = currentGridSize === 1 ? mdiViewComfy : currentGridSize === 2 ? mdiViewModule : mdiViewGrid;
  const hasChannelInfo = tab === "clips" || tab === "collabs";

  useEffect(() => {
    const update = () => setControlsEl(document.getElementById("channelTabControls"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id, type]);

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
    const channelName = channel?.[app.settings.nameProperty] || channel?.name;
    if (channelName) document.title = `${channelName} - ${tabName} - Holodex`;
  }, [channel, type, app.settings.nameProperty, t]);

  function toggleSort() { setSortOrder((value) => value === "desc" ? "asc" : "desc"); }
  function cycleGridSize() { app.setCurrentGridSize((currentGridSize + 1) % 3); }

  const controls = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" title={sortOrder === "desc" ? "Newest first" : "Oldest first"} onClick={toggleSort}>
        <Icon icon={sortOrder === "desc" ? mdiSortDescending : mdiSortAscending} />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Toggle grid size" onClick={cycleGridSize}>
        <Icon icon={gridIcon} />
      </Button>
    </div>
  );

  return (
    <>
      {controlsEl ? createPortal(controls, controlsEl) : null}
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
  const { t } = useI18n();
  const app = useAppState();
  useEffect(() => {
    const channelName = channel?.[app.settings.nameProperty] || channel?.name;
    if (channelName) document.title = `${channelName} - ${t("views.channel.about")} - Holodex`;
  }, [app.settings.nameProperty, channel, t]);
  return <div className="mx-auto w-full"><div className="flex flex-wrap gap-6"><div className="w-full md:w-[calc(25%-1.5rem)]"><strong>{t("component.channelInfo.stats")}</strong><div className="my-3 h-px bg-white/10" />{t("component.channelInfo.videoCount", [channel.video_count])}<div className="my-3 h-px bg-white/10" />{channel.clip_count} {t("component.channelInfo.clipCount", [channel.clip_count])}<div className="my-3 h-px bg-white/10" />{channel.view_count} {t("component.channelInfo.totalViews")}<div className="my-3 h-px bg-white/10" /></div><div style={{ whiteSpace: "pre-wrap" }} className="w-full flex-1"><strong>{t("component.videoDescription.description")}</strong><br /><div dangerouslySetInnerHTML={{ __html: vueLinkifyHtml(channel.description || "") }} /></div></div></div>;
}
