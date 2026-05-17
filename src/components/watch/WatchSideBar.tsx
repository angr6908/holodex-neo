"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VideoCardList } from "@/components/video/VideoCardList";
import { SongItem } from "@/components/media/SongItem";
import { useAppState } from "@/lib/store";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import { useTranslations } from "next-intl";
import { musicdexURL } from "@/lib/consts";
import { videoTemporalComparator } from "@/lib/functions";
import { filterVideo } from "@/lib/filter-videos";
import { decodeLayout, encodeLayout, getDesktopDefaults } from "@/lib/mv-utils";
import { readJSON } from "@/lib/browser";
import * as icons from "@/lib/icons";

const MULTIVIEW_STORAGE_KEY = "holodex-v2-multiview";
const RELATION_KEYS = ["simulcasts", "clips", "sources", "same_source_clips", "recommendations", "refers"] as const;

type RelationKey = (typeof RELATION_KEYS)[number];
type RelationVideo = Record<string, any>;
type RelatedVideos = Record<RelationKey, RelationVideo[]>;
type HiddenSections = Record<RelationKey | "songs", boolean>;
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
const sectionToggleClass = [
  "mx-2 my-1 h-auto shrink justify-start whitespace-normal rounded-none px-0 py-0 pr-2",
  "text-left text-xs font-normal uppercase tracking-[0.2em] text-slate-300",
  "hover:bg-transparent hover:text-slate-300 dark:hover:bg-transparent",
].join(" ");

function readPersistedAutoLayout() {
  const saved = readJSON(MULTIVIEW_STORAGE_KEY, {} as any);
  return Array.isArray(saved.autoLayout) ? saved.autoLayout : getDesktopDefaults();
}

export function WatchSideBar({ video, showSongs = true, showRelations = true, onTimeJump, className = "" }: WatchSideBarProps) {
  const app = useAppState();
  const multiview = useOptionalMultiviewStore();
  const router = useRouter();
  const t = useTranslations();
  const [showDetailed, setShowDetailed] = useState(false);
  const [fallbackAutoLayout] = useState(readPersistedAutoLayout);
  const related = useMemo<RelatedVideos>(() => {
    const clips = video.clips?.filter?.((x: any) => x.status !== "missing" && app.settings.clipLangs.includes(x.lang)).sort(videoTemporalComparator).reverse() || [];
    return {
      simulcasts: video.simulcasts || [],
      clips,
      sources: video.sources || [],
      same_source_clips: (video.same_source_clips && video.same_source_clips.slice(0, 10)) || [],
      recommendations: (video.recommendations && video.recommendations.slice(0, 10)) || [],
      refers: video.refers || [],
    };
  }, [video, app.settings.clipLangs]);
  const [hidden, setHidden] = useState<HiddenSections>(() => ({
    clips: false,
    simulcasts: false,
    sources: false,
    recommendations: ((related.clips.length + related.sources.length + related.same_source_clips.length) >= 5),
    songs: false,
    same_source_clips: false,
    refers: related.refers.length > 0 && ((related.clips.length + related.simulcasts.length) >= 3),
  }));
  const songList = useMemo(() => video?.songs?.map((song: any) => ({ ...song, video_id: video.id, channel_id: video.channel.id, channel: video.channel })).sort((a: any, b: any) => a.start - b.start) || [], [video]);
  const orderedRelations = showRelations ? RELATION_KEYS : [];

  const simulcastMultiviewLink = useMemo<SimulcastMultiviewLink>(() => {
    if (!related.simulcasts.length) return { ok: false, error: { reason: "noSimulcasts", i18nParameters: {} } };
    const autoLayout = multiview?.autoLayout || fallbackAutoLayout;
    const defaultLayoutString = autoLayout[related.simulcasts.length + 1];
    if (!defaultLayoutString) return { ok: false, error: { reason: "noDefaultLayout", i18nParameters: { videoCount: related.simulcasts.length + 1 } } };
    const { layout, content } = decodeLayout(defaultLayoutString);
    if (!layout) return { ok: false, error: { reason: "layoutBuildFailure", i18nParameters: {} } };
    const allSimulcastVideos = [{ type: "video", id: video.id }, ...related.simulcasts.map((simulcast: any) => ({ type: "video", id: simulcast.id }))];
    const filledContents = Object.fromEntries(layout.map(({ i }: any) => [i, content[i] ?? allSimulcastVideos.shift()]));
    if (allSimulcastVideos.length) return { ok: false, error: { reason: "layoutBuildFailure", i18nParameters: {} } };
    const layoutURIComponent = encodeLayout({ layout, contents: filledContents, includeVideo: true });
    if (!layoutURIComponent || layoutURIComponent === "error") return { ok: false, error: { reason: "layoutBuildFailure", i18nParameters: {} } };
    return { ok: true, url: `/multiview/${encodeURIComponent(layoutURIComponent)}` };
  }, [multiview?.autoLayout, fallbackAutoLayout, related.simulcasts, video.id]);

  const simulcastTooltip = (() => {
    if (simulcastMultiviewLink.ok) {
      return t("component.relatedVideo.simulcasts.linkToMultiview.tooltip");
    }

    const error = simulcastMultiviewLink.error || { reason: "layoutBuildFailure", i18nParameters: {} };
    return t(`component.relatedVideo.simulcasts.linkToMultiview.error.${error.reason}`, error.i18nParameters as Record<string, string | number | Date>);
  })();

  function toggleExpansion(section: RelationKey | "songs") { setHidden((value) => ({ ...value, [section]: !value[section] })); }
  function relationI18N(relation: RelationKey | "songs") {
    switch (relation) {
      case "clips": return t("component.relatedVideo.clipsLabel");
      case "simulcasts": return t("component.relatedVideo.simulcastsLabel");
      case "refers": return t("component.relatedVideo.refersLabel");
      case "sources": return t("component.relatedVideo.sourcesLabel");
      case "songs": return t("component.relatedVideo.songsLabel");
      case "recommendations": return t("component.relatedVideo.recommendationsLabel");
      case "same_source_clips": return t("component.relatedVideo.sameSourceClips");
      default: return "";
    }
  }
  function addToMusicPlaylist() { window.open(`${musicdexURL}/video/${video.id}`, "_blank"); }
  const addToPlaylist = (videos: RelationVideo[]) => [...videos].filter((v) => filterVideo(v, app, { hideIgnoredTopics: false })).reverse().forEach((v) => app.addToPlaylist(v));
  function openSimulcastLayout() { if (simulcastMultiviewLink.ok && simulcastMultiviewLink.url) router.push(simulcastMultiviewLink.url); }

  function renderSectionToggle(section: RelationKey | "songs", count: number) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={sectionToggleClass}
        onClick={() => toggleExpansion(section)}
      >
        <span>{hidden[section] ? "＋" : "－"} {count} {relationI18N(section)}</span>
      </Button>
    );
  }

  function renderSongs() {
    if (!showSongs || !video.songcount) return null;

    return (
      <>
        <div className="relative z-[1] flex items-center gap-2 hover:bg-white/6 [&_*]:z-[1] [&_*]:!leading-7">
          {renderSectionToggle("songs", video.songcount)}
          <div className="flex-1" />
          <Button type="button" size="icon" variant="ghost" className="mr-2 my-1 h-8 w-8" onClick={() => setShowDetailed((value) => !value)}>
            <Timer className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="mr-2 my-1 h-8 w-8" onClick={addToMusicPlaylist}>
            <icons.Music className="size-4" />
          </Button>
        </div>

        {!hidden.songs ? (
          <div className="px-2 py-0">
            <div className="w-full">
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
            </div>
          </div>
        ) : null}
      </>
    );
  }

  function renderRelation(relation: RelationKey) {
    const videos = related[relation];
    if (!videos.length) return null;

    return (
      <div key={relation}>
        <div className="relative z-[1] flex items-center gap-2 hover:bg-white/6 [&_*]:z-[1] [&_*]:!leading-7">
          {renderSectionToggle(relation, videos.length)}
          <div className="flex-1" />
          {relation === "simulcasts" ? (
            <Tooltip>
              <TooltipTrigger
                render={<span className="mr-2 my-1 inline-flex h-8 w-8" />}
              >
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
          <Button type="button" size="icon" variant="ghost" className="mr-2 my-1 h-8 w-8" onClick={() => addToPlaylist(videos)}>
            <icons.ListPlus className="size-4" />
          </Button>
        </div>

        {!hidden[relation] ? (
          <VideoCardList videos={videos} horizontal includeChannel cols={{ lg: 12, md: 4, cols: 12, sm: 6 }} dense />
        ) : null}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={className}>
        {renderSongs()}
        {orderedRelations.map(renderRelation)}
      </div>
    </TooltipProvider>
  );
}
