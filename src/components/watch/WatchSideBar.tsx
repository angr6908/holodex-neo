"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { mdiTimerOutline } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { VideoCardList } from "@/components/video/VideoCardList";
import { SongItem } from "@/components/media/SongItem";
import { useAppState } from "@/lib/store";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import { useI18n } from "@/lib/i18n";
import { musicdexURL } from "@/lib/consts";
import { videoTemporalComparator } from "@/lib/functions";
import { filterVideo } from "@/lib/filter-videos";
import { decodeLayout, encodeLayout, getDesktopDefaults } from "@/lib/mv-utils";
import { readJSON } from "@/lib/storage";
import * as icons from "@/lib/icons";

const MULTIVIEW_STORAGE_KEY = "holodex-v2-multiview";

function readPersistedAutoLayout() {
  const saved = readJSON(MULTIVIEW_STORAGE_KEY, {} as any);
  return Array.isArray(saved.autoLayout) ? saved.autoLayout : getDesktopDefaults();
}

export function WatchSideBar({ video, showSongs = true, showRelations = true, onTimeJump, className = "" }: { video: Record<string, any>; showSongs?: boolean; showRelations?: boolean; onTimeJump?: (time: number) => void; className?: string }) {
  const app = useAppState();
  const multiview = useOptionalMultiviewStore();
  const router = useRouter();
  const { t } = useI18n();
  const [showDetailed, setShowDetailed] = useState(false);
  const [fallbackAutoLayout] = useState(readPersistedAutoLayout);
  const related = useMemo(() => {
    const clips = video.clips?.filter?.((x: any) => x.status !== "missing" && app.settings.clipLangs.includes(x.lang)).sort(videoTemporalComparator).reverse() || [];
    return { simulcasts: video.simulcasts || [], clips, sources: video.sources || [], same_source_clips: (video.same_source_clips && video.same_source_clips.slice(0, 10)) || [], recommendations: (video.recommendations && video.recommendations.slice(0, 10)) || [], refers: video.refers || [] };
  }, [video, app.settings.clipLangs]);
  const [hidden, setHidden] = useState<Record<string, boolean>>(() => ({
    clips: false,
    simulcasts: false,
    sources: false,
    recommendations: ((related.clips.length + related.sources.length + related.same_source_clips.length) >= 5),
    songs: false,
    same_source_clips: false,
    refers: related.refers.length > 0 && ((related.clips.length + related.simulcasts.length) >= 3),
  }));
  const songList = useMemo(() => video?.songs?.map((song: any) => ({ ...song, video_id: video.id, channel_id: video.channel.id, channel: video.channel })).sort((a: any, b: any) => a.start - b.start) || [], [video]);
  const orderedRelations = showRelations ? ["simulcasts", "clips", "sources", "same_source_clips", "recommendations", "refers"] : [];

  const simulcastMultiviewLink = useMemo(() => {
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

  const simulcastTooltip = simulcastMultiviewLink.ok
    ? t("component.relatedVideo.simulcasts.linkToMultiview.tooltip")
    : t(`component.relatedVideo.simulcasts.linkToMultiview.error.${(simulcastMultiviewLink as any).error.reason}`, (simulcastMultiviewLink as any).error.i18nParameters);

  function toggleExpansion(section: string) { setHidden((value) => ({ ...value, [section]: !value[section] })); }
  function relationI18N(relation: string) {
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
  const addToPlaylist = (videos: any[]) => [...videos].filter((v) => filterVideo(v, app, { hideIgnoredTopics: false })).reverse().forEach((v) => app.addToPlaylist(v));
  function openSimulcastLayout() { if (simulcastMultiviewLink.ok) router.push((simulcastMultiviewLink as any).url); }

  return <div className={className}>{showSongs && video.songcount ? <><div className="lightup flex items-center gap-2"><button type="button" className="mx-2 my-1 pr-2 text-xs uppercase tracking-[0.2em] text-slate-300" onClick={() => toggleExpansion("songs")}>{hidden.songs ? "＋" : "－"} {video.songcount} {relationI18N("songs")}</button><div className="flex-1" /><Button type="button" size="icon" variant="ghost" className="mr-2 my-1 h-8 w-8" onClick={() => setShowDetailed((value) => !value)}><Icon icon={mdiTimerOutline} size="sm" /></Button><Button type="button" size="icon" variant="ghost" className="mr-2 my-1 h-8 w-8" onClick={addToMusicPlaylist}><Icon icon={icons.mdiMusic} size="sm" /></Button></div>{!hidden.songs ? <div className="px-2 py-0"><div className="w-full">{songList.map((song: any, idx: number) => <SongItem key={song.name + song.video_id + idx} detailed={showDetailed} song={song} hoverIcon={icons.mdiPlay} style={{ width: "100%" }} onPlay={() => onTimeJump?.(song.start)} onPlayNow={() => onTimeJump?.(song.start)} />)}</div></div> : null}</> : null}{orderedRelations.map((relation) => related[relation as keyof typeof related].length ? <div key={relation}><div className="lightup flex items-center gap-2"><button type="button" className="mx-2 my-1 pr-2 text-xs uppercase tracking-[0.2em] text-slate-300" onClick={() => toggleExpansion(relation)}>{hidden[relation] ? "＋" : "－"} {related[relation as keyof typeof related].length} {relationI18N(relation)}</button><div className="flex-1" />{relation === "simulcasts" ? <Button type="button" size="icon" variant="ghost" className="mr-2 my-1 h-8 w-8" disabled={!simulcastMultiviewLink.ok} title={simulcastTooltip} onClick={openSimulcastLayout}><Icon icon={icons.mdiViewDashboard} size="sm" /></Button> : null}<Button type="button" size="icon" variant="ghost" className="mr-2 my-1 h-8 w-8" onClick={() => addToPlaylist(related[relation as keyof typeof related])}><Icon icon={icons.mdiPlaylistPlus} size="sm" /></Button></div>{!hidden[relation] ? <VideoCardList videos={related[relation as keyof typeof related]} horizontal includeChannel cols={{ lg: 12, md: 4, cols: 12, sm: 6 }} dense /> : null}</div> : null)}</div>;
}
