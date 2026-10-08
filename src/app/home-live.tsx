import { Fragment } from "react";
import { CARD_AVATAR_SIZE } from "@/components/channel/avatar-size";
import { DEFAULT_ORG } from "@/lib/consts";
import { type AppBootState, HOME_TABS, type HomeUiState } from "@/lib/cookie-codec";
import { makeVideoFilter } from "@/lib/filter-videos";
import {
  getChannelPhoto,
  getChannelPhotoSrcSet,
  getLiveViewerCount,
  videoTemporalComparator,
} from "@/lib/functions";
import {
  HOME_LIVE_QUERY,
  homeLiveTargets,
  isLiveInWindow,
  type LiveListSeed,
  liveListOrgs,
  liveListPath,
} from "@/lib/live-list";
import { loadLiveList } from "@/lib/server/live-list";
import { getBreakpoint } from "@/lib/utils";
import { dedupeVideos, videoImagePreload } from "@/lib/video-format";

// The home page's first screen is its live list, which the client could only request once its
// JavaScript had loaded and hydrated. A document request for the home page starts loading the
// list right away instead: the client uses it for its first request (see seedLiveLists), and
// the first rows' thumbnails are preloaded while the page's scripts are still loading.

// Rows of cards a first screen shows (or partly shows), for preloading their images.
const GRID_ROWS = 4;
const LIST_ROWS = 8;
// What the server knows of the viewer: nothing blocked, hidden or favorited.
const NO_VIEWER_STATE = {
  blockedChannelIDs: new Set<string>(),
  favoriteChannelIDs: new Set<string>(),
  ignoredTopicsSet: new Set<string>(),
  settings: { hiddenGroups: {} },
};

type HomeLiveStart = {
  seeds: LiveListSeed[];
  // Whether the first screen shows the list's thumbnails.
  showsThumbnails: boolean;
  targets: string[];
};

// Starts loading the live list the home page will show (as the store's fetchHomeLive would
// request it), or returns null when the page opens to favorites, which need the user's token.
export function startHomeLive(
  boot: AppBootState,
  homeState: HomeUiState | null,
): HomeLiveStart | null {
  const settings = boot.settings ?? {};
  if (homeState?.isFavPage ?? settings.defaultOpen === "favorites") return null;
  const targets = homeLiveTargets(boot.selectedHomeOrgs?.filter(Boolean) ?? [DEFAULT_ORG]);
  const seeds = liveListOrgs(targets).map((org) => {
    const path = liveListPath(org, HOME_LIVE_QUERY);
    return { path, data: loadLiveList(path) };
  });
  const showsThumbnails =
    (homeState?.viewMode ?? "streams") === "streams" &&
    (homeState?.tab ?? HOME_TABS.LIVE_UPCOMING) === HOME_TABS.LIVE_UPCOMING &&
    settings.homeViewMode !== "denseList";
  return { seeds, showsThumbnails, targets };
}

// The cards the first screen shows: live streams by viewers, then upcoming ones, which the grid
// starts on a new row.
function firstScreenVideos(live: any[], upcoming: any[], columns: number, grid: boolean) {
  if (!grid) return [...live, ...upcoming].slice(0, LIST_ROWS);
  const liveRows = Math.ceil(live.length / columns);
  return [
    ...live.slice(0, GRID_ROWS * columns),
    ...upcoming.slice(0, Math.max(0, GRID_ROWS - liveRows) * columns),
  ];
}

// Once the list has loaded, preloads the thumbnails and channel avatars of the cards the first
// screen shows, filtered and laid out as ConnectedVideoList does.
export async function PreloadHomeLiveThumbnails({
  live,
  boot,
}: {
  live: HomeLiveStart;
  boot: AppBootState;
}) {
  let videos: any[];
  try {
    videos = (await Promise.all(live.seeds.map((s) => s.data))).flat();
  } catch {
    return null;
  }
  const settings = boot.settings ?? {};
  const gridSize = boot.currentGridSize ?? 1;
  const horizontal = settings.homeViewMode === "list";
  const breakpoint = getBreakpoint(boot.windowWidth ?? 1440);
  const columns = horizontal ? 1 : { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }[breakpoint] + gridSize;
  // As useListGeometry: cards get too narrow for an avatar in dense grids.
  const avatars = !(
    (breakpoint === "md" && gridSize > 1) ||
    ((breakpoint === "sm" || breakpoint === "xs") && gridSize > 0)
  );
  const shown = makeVideoFilter(NO_VIEWER_STATE, {
    forOrgs: live.targets,
    hideGroups: true,
    hideLive: settings.hideLive,
    hideUpcoming: settings.hideUpcoming,
  });
  const listed = dedupeVideos(videos).filter((v) => isLiveInWindow(v) && shown(v));
  const first = firstScreenVideos(
    listed
      .filter((v) => v.status === "live")
      .sort((a, b) => getLiveViewerCount(b) - getLiveViewerCount(a)),
    listed.filter((v) => v.status === "upcoming").sort(videoTemporalComparator),
    columns,
    !horizontal,
  );
  // Rendered as <link> elements rather than react-dom's preload(): hints issued after the
  // page's shell only reach the client in the RSC payload, too late for its scripts to matter.
  // Each preload mirrors its <img> (VideoThumbnail, ChannelImg) so the image is reused.
  return first.map((video) => {
    const { href, imageSrcSet } = videoImagePreload(video, {
      horizontal,
      colSize: columns,
      forceJpg: true,
    });
    const channelId = avatars ? video.channel?.id : null;
    return (
      <Fragment key={video.id}>
        {href ? (
          <link
            rel="preload"
            as="image"
            href={href}
            imageSrcSet={imageSrcSet}
            fetchPriority="high"
          />
        ) : null}
        {channelId ? (
          <link
            rel="preload"
            as="image"
            href={getChannelPhoto(channelId)}
            imageSrcSet={getChannelPhotoSrcSet(channelId)}
            imageSizes={`${CARD_AVATAR_SIZE}px`}
          />
        ) : null}
      </Fragment>
    );
  });
}
