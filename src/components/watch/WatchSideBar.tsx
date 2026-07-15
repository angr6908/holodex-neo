"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { SectionPanel } from "@/components/common/SectionPanel";
import { SongItem } from "@/components/media/SongItem";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VideoCardList } from "@/components/video/VideoCardList";
import { readJSON } from "@/lib/browser";
import { musicdexURL } from "@/lib/consts";
import { makeVideoFilter } from "@/lib/filter-videos";
import { videoTemporalComparator } from "@/lib/functions";
import * as icons from "@/lib/icons";
import { Timer } from "@/lib/icons";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import { decodeLayout, encodeLayout, getDesktopDefaults } from "@/lib/mv-utils";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

const MULTIVIEW_STORAGE_KEY = "holodex-v2-multiview";
const RELATION_KEYS = [
  "simulcasts",
  "clips",
  "sources",
  "same_source_clips",
  "recommendations",
  "refers",
] as const;

type RelationKey = (typeof RELATION_KEYS)[number];
type RelationVideo = Record<string, any>;
type RelatedVideos = Record<RelationKey, RelationVideo[]>;
type WatchSideBarProps = {
  video: Record<string, any>;
  showSongs?: boolean;
  showRelations?: boolean;
  onTimeJump?: (time: number) => void;
  className?: string;
};
type SimulcastMultiviewLink = {
  ok: boolean;
  url?: string;
  error?: { reason: string; i18nParameters: Record<string, unknown> };
};
function readPersistedAutoLayout() {
  const saved = readJSON(MULTIVIEW_STORAGE_KEY, {} as any);
  return Array.isArray(saved.autoLayout) ? saved.autoLayout : getDesktopDefaults();
}

export function WatchSideBar({
  video,
  showSongs = true,
  showRelations = true,
  onTimeJump,
  className = "",
}: WatchSideBarProps) {
  const app = useAppState();
  const multiview = useOptionalMultiviewStore();
  const router = useRouter();
  const t = useTranslations();
  const [showDetailed, setShowDetailed] = useState(false);
  const [fallbackAutoLayout] = useState(readPersistedAutoLayout);
  const [selectedRelation, setSelectedRelation] = useState<RelationKey | null>(null);
  const related = useMemo<RelatedVideos>(() => {
    const clips =
      video.clips
        ?.filter?.((x: any) => x.status !== "missing" && app.settings.clipLangs.includes(x.lang))
        .sort(videoTemporalComparator)
        .reverse() || [];
    return {
      simulcasts: video.simulcasts || [],
      clips,
      sources: video.sources || [],
      same_source_clips: video.same_source_clips?.slice(0, 10) || [],
      recommendations: video.recommendations?.slice(0, 10) || [],
      refers: video.refers || [],
    };
  }, [video, app.settings.clipLangs]);
  const songList = useMemo(
    () =>
      video?.songs
        ?.map((song: any) => ({
          ...song,
          video_id: video.id,
          channel_id: video.channel.id,
          channel: video.channel,
        }))
        .sort((a: any, b: any) => a.start - b.start) || [],
    [video],
  );
  const availableRelations = showRelations
    ? RELATION_KEYS.filter((key) => related[key].length > 0)
    : [];
  const relatedTotal = availableRelations.reduce((sum, key) => sum + related[key].length, 0);
  // The selection survives video navigation; fall back to the first non-empty category when the
  // selected one has no videos for the current video.
  const activeRelation =
    selectedRelation && related[selectedRelation].length > 0
      ? selectedRelation
      : availableRelations[0];

  const simulcastMultiviewLink = useMemo<SimulcastMultiviewLink>(() => {
    if (!related.simulcasts.length)
      return { ok: false, error: { reason: "noSimulcasts", i18nParameters: {} } };
    const autoLayout = multiview?.autoLayout || fallbackAutoLayout;
    const defaultLayoutString = autoLayout[related.simulcasts.length + 1];
    if (!defaultLayoutString)
      return {
        ok: false,
        error: {
          reason: "noDefaultLayout",
          i18nParameters: { videoCount: related.simulcasts.length + 1 },
        },
      };
    const { layout, content } = decodeLayout(defaultLayoutString);
    if (!layout) return { ok: false, error: { reason: "layoutBuildFailure", i18nParameters: {} } };
    const allSimulcastVideos = [
      { type: "video", id: video.id },
      ...related.simulcasts.map((simulcast: any) => ({ type: "video", id: simulcast.id })),
    ];
    const filledContents = Object.fromEntries(
      layout.map(({ i }: any) => [i, content[i] ?? allSimulcastVideos.shift()]),
    );
    if (allSimulcastVideos.length)
      return { ok: false, error: { reason: "layoutBuildFailure", i18nParameters: {} } };
    const layoutURIComponent = encodeLayout({
      layout,
      contents: filledContents,
      includeVideo: true,
    });
    if (!layoutURIComponent || layoutURIComponent === "error")
      return { ok: false, error: { reason: "layoutBuildFailure", i18nParameters: {} } };
    return { ok: true, url: `/multiview/${encodeURIComponent(layoutURIComponent)}` };
  }, [multiview?.autoLayout, fallbackAutoLayout, related.simulcasts, video.id]);

  const simulcastTooltip = (() => {
    if (simulcastMultiviewLink.ok) {
      return t("component.relatedVideo.simulcasts.linkToMultiview.tooltip");
    }

    const error = simulcastMultiviewLink.error || {
      reason: "layoutBuildFailure",
      i18nParameters: {},
    };
    return t(
      `component.relatedVideo.simulcasts.linkToMultiview.error.${error.reason}`,
      error.i18nParameters as Record<string, string | number | Date>,
    );
  })();

  function relationI18N(relation: RelationKey | "songs") {
    switch (relation) {
      case "clips":
        return t("component.relatedVideo.clipsLabel");
      case "simulcasts":
        return t("component.relatedVideo.simulcastsLabel");
      case "refers":
        return t("component.relatedVideo.refersLabel");
      case "sources":
        return t("component.relatedVideo.sourcesLabel");
      case "songs":
        return t("component.relatedVideo.songsLabel");
      case "recommendations":
        return t("component.relatedVideo.recommendationsLabel");
      case "same_source_clips":
        return t("component.relatedVideo.sameSourceClips");
      default:
        return "";
    }
  }
  function addToMusicPlaylist() {
    window.open(`${musicdexURL}/video/${video.id}`, "_blank");
  }
  const addToPlaylist = (videos: RelationVideo[]) =>
    [...videos]
      .filter(makeVideoFilter(app, { hideIgnoredTopics: false }))
      .reverse()
      .forEach((v) => {
        app.addToPlaylist(v);
      });
  function openSimulcastLayout() {
    if (simulcastMultiviewLink.ok && simulcastMultiviewLink.url)
      router.push(simulcastMultiviewLink.url);
  }

  function renderSongs() {
    if (!showSongs || !video.songcount) return null;

    return (
      <SectionPanel
        title={relationI18N("songs")}
        count={video.songcount}
        actions={
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setShowDetailed((value) => !value)}
            >
              <Timer className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={addToMusicPlaylist}
            >
              <icons.Music className="size-4" />
            </Button>
          </>
        }
        contentClassName="px-2 py-1"
      >
        {songList.map((song: any, index: number) => (
          <SongItem
            key={`${song.name}${song.video_id}${index}`}
            detailed={showDetailed}
            song={song}
            hoverIcon={icons.Play}
            onPlay={() => onTimeJump?.(song.start)}
            onPlayNow={() => onTimeJump?.(song.start)}
          />
        ))}
      </SectionPanel>
    );
  }

  function renderRelated() {
    if (!availableRelations.length || !activeRelation) return null;
    const activeVideos = related[activeRelation];

    return (
      <SectionPanel
        title={t("component.relatedVideo.title")}
        count={relatedTotal}
        actions={
          <>
            {activeRelation === "simulcasts" ? (
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex h-8 w-8" />}>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={!simulcastMultiviewLink.ok}
                    onClick={openSimulcastLayout}
                  >
                    <icons.LayoutDashboard className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{simulcastTooltip}</TooltipContent>
              </Tooltip>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => addToPlaylist(activeVideos)}
            >
              <icons.ListPlus className="size-4" />
            </Button>
          </>
        }
        contentClassName="flex flex-col gap-3 px-3 py-3"
      >
        {availableRelations.length > 1 ? (
          <ToggleGroup
            value={[activeRelation]}
            size="sm"
            onValueChange={(value) => {
              if (value[0]) setSelectedRelation(value[0] as RelationKey);
            }}
            className="flex-wrap justify-start gap-1.5"
          >
            {availableRelations.map((relation) => (
              <ToggleGroupItem key={relation} value={relation}>
                <span className="first-letter:uppercase">{relationI18N(relation)}</span> (
                {related[relation].length})
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <VideoCardList videos={activeVideos} includeChannel autoFill autoFitMin="13rem" />
      </SectionPanel>
    );
  }

  // The page gates on unfiltered video fields (e.g. clips before the clip-language filter), so
  // render nothing rather than an empty stack slot when every section filtered out.
  if (!((showSongs && video.songcount) || availableRelations.length > 0)) return null;

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col gap-3", className)}>
        {renderSongs()}
        {renderRelated()}
      </div>
    </TooltipProvider>
  );
}
