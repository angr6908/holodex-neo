"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { decodeHTMLEntities, getYTLangFromState } from "@/lib/functions";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { YoutubePlayer, type YoutubePlayerHandle } from "@/components/player/YoutubePlayer";
import { WatchInfo } from "@/components/watch/WatchInfo";
import { WatchToolbar } from "@/components/watch/WatchToolbar";
import { WatchLiveChat } from "@/components/watch/WatchLiveChat";
import { WatchComments } from "@/components/watch/WatchComments";
import { VideoEditSongs, type VideoEditSongsHandle } from "@/components/edit/VideoEditSongs";
import { VideoEditMentions } from "@/components/edit/VideoEditMentions";
import { CommentSongParser } from "@/components/media/CommentSongParser";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import * as icons from "@/lib/icons";
import { readWatchControlsState, writeWatchControlsState } from "@/lib/watch-state";

const TABS = Object.freeze({ TOPIC: 0, MUSIC: 1, MENTIONS: 2, SOURCES_CLIPS: 3 });
const activeTabClass = "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]";
const inactiveTabClass = "bg-white/6 text-[color:var(--color-muted-foreground)] hover:bg-white/10 hover:text-[color:var(--color-foreground)]";

export function EditVideoPage() {
  const params = useParams<{ id?: string; tab?: string[] }>();
  const search = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const app = useAppState();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [video, setVideo] = useState<any>(null);
  const [currentTab, setCurrentTab] = useState<number>(TABS.TOPIC);
  const [newTopic, setNewTopic] = useState<string | null>(null);
  const [topics, setTopics] = useState<{ value: string; text: string }[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTL, setShowTL] = useState(() => readWatchControlsState().showTL);
  const [showLiveChat, setShowLiveChat] = useState(() => readWatchControlsState().showLiveChat);
  const stopAt = useRef<number | null>(null);
  const player = useRef<YoutubePlayerHandle | null>(null);
  const musicEditor = useRef<VideoEditSongsHandle | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoId = params.id || search.get("v") || "";
  const timeOffset = Number(search.get("t") || 0) || 0;
  const title = (video?.title && decodeHTMLEntities(video.title)) || "";
  const isLive = !!video && ["live", "upcoming"].includes(video.status);
  const getLang = getYTLangFromState({ settings: { lang: app.settings.lang } });

  async function fetchVideo() {
    if (!videoId) {
      setHasError(true);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setHasError(false);
    try {
      const { data } = await api.video(videoId, null as any, 1);
      setVideo(data);
      setIsLoading(false);
    } catch (e) {
      setHasError(true);
      setIsLoading(false);
      console.error(e);
    }
  }

  async function populateTopics() {
    try {
      const { data } = await api.topics();
      setTopics(data.map((topic: any) => ({ value: topic.id, text: `${topic.id} (${topic.count ?? 0})` })));
    } catch (e) {
      console.error(e);
    }
  }

  function seekTo(time: number, playNow?: boolean, updateStartTime?: boolean, _stopPlayingAt?: number) {
    if (!player.current) return;
    player.current.seekTo(time);
    stopAt.current = _stopPlayingAt ?? null;
    if (playNow) player.current.playVideo();
    if (updateStartTime && currentTab === TABS.MUSIC) musicEditor.current?.setStartTime(time);
  }

  function setTimer() {
    if (timer.current) clearInterval(timer.current);
    if (!player.current) return;
    timer.current = setInterval(async () => {
      try {
        const time = await player.current?.getCurrentTime?.();
        setCurrentTime(Number(time) || 0);
      } catch {}
    }, 200);
  }

  function saveTopic() {
    api.topicSet(newTopic, videoId, app.userdata.jwt);
  }

  function selectSongCandidate(timeframe: any, songdata?: any) {
    musicEditor.current?.setSongCandidate(timeframe, songdata);
    seekTo(timeframe.start_time, true);
  }


  useEffect(() => {
    const tab = params.tab?.[0]?.toUpperCase();
    setCurrentTab(tab ? (TABS as Record<string, number>)[tab] ?? TABS.TOPIC : TABS.TOPIC);
  }, [params.tab]);

  useEffect(() => { if (title) document.title = title; }, [title]);
  useEffect(() => {
    const current = readWatchControlsState();
    writeWatchControlsState({ ...current, showTL, showLiveChat });
  }, [showTL, showLiveChat]);
  useEffect(() => { fetchVideo(); }, [videoId]);
  useEffect(() => { if (currentTab === TABS.TOPIC) populateTopics(); }, [currentTab]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (isLoading || hasError || !video) return <LoadingOverlay isLoading={isLoading} showError={hasError} />;

  return (
    <section className="video-editor">
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="px-0 pt-0 lg:col-span-4">
          <div>
            <div className="video">
              {video.id ? (
                <YoutubePlayer
                  ref={player}
                  videoId={video.id}
                  start={timeOffset}
                  autoplay
                  lang={getLang}
                  onReady={(p) => { player.current = p; setTimer(); }}
                />
              ) : null}
            </div>
          </div>
          <WatchToolbar video={video}>
              {isLive ? (
                <Button type="button" size="icon" variant={showTL ? "default" : "ghost"} title={showTL ? t("views.watch.chat.hideTLBtn") : t("views.watch.chat.showTLBtn")} onClick={() => setShowTL((value) => !value)}>
                  <Icon icon={icons.tlChat} />
                </Button>
              ) : null}
              {isLive ? (
                <Button type="button" size="icon" variant={showLiveChat ? "default" : "ghost"} onClick={() => setShowLiveChat((value) => !value)}>
                  <Icon icon={icons.ytChat} />
                </Button>
              ) : null}
          </WatchToolbar>
          {isLive ? (
            <div className="flex flex-row grow">
              <WatchLiveChat
                className="sidebar chat grow"
                video={video}
                currentTime={currentTime}
                modelValue={{ showTlChat: showTL, showYtChat: showLiveChat }}
                onVideoUpdate={(update) => {
                  if (!update?.status || !update?.start_actual) return;
                  setVideo((value: any) => ({
                    ...value,
                    live_viewers: update.live_viewers,
                    status: update.status,
                    start_actual: typeof update.start_actual === "string" ? update.start_actual : value.start_actual,
                  }));
                }}
              />
            </div>
          ) : null}
          {video.comments?.length ? (
            <div className="comment-scroller">
              {currentTab === TABS.MUSIC ? <CommentSongParser comments={video.comments} onSongSelected={selectSongCandidate} /> : null}
              <WatchComments key="comments" hideBuckets defaultExpanded comments={video.comments} video={video} limit={app.isMobile ? 5 : 0} onTimeJump={seekTo} />
            </div>
          ) : null}
        </div>
        <div className="related-videos pt-0 lg:col-span-8">
          {!app.userdata?.jwt ? <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-100" dangerouslySetInnerHTML={{ __html: t("views.editor.needlogin") }} /> : null}
          <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="icon" title={t("editor.exitMode")} onClick={() => router.back()}><Icon icon={icons.mdiArrowLeft} /></Button>
              <TabButton active={currentTab === TABS.TOPIC} disabled={video.type !== "stream"} onClick={() => setCurrentTab(TABS.TOPIC)}>{t("component.search.type.topic")}</TabButton>
              <TabButton active={currentTab === TABS.MUSIC} disabled={video.type !== "stream"} onClick={() => setCurrentTab(TABS.MUSIC)}>{t("component.mainNav.music")}</TabButton>
              <TabButton active={currentTab === TABS.MENTIONS} onClick={() => setCurrentTab(TABS.MENTIONS)}>{t("views.editor.channelMentions.title")}</TabButton>
              <button type="button" disabled className="rounded-xl px-3 py-2 text-sm text-[color:var(--color-muted-foreground)] opacity-50">{t("views.editor.sources.title")}</button>
            </div>

            <div className="p-1">
              <div style={{ display: currentTab === TABS.TOPIC ? undefined : "none" }}>
                <div className="mb-3 flex items-center gap-2 text-lg font-semibold text-[color:var(--color-foreground)]">
                  <Icon icon={icons.mdiAnimationPlay} />
                  <h5>{t("views.editor.changeTopic.title")}</h5>
                </div>
                <div className="space-y-3">
                  <p>{t("views.editor.changeTopic.info")}</p>
                  <select value={newTopic || ""} onChange={(e) => setNewTopic(e.target.value || null)} className="w-full rounded-xl border border-white/12 bg-slate-950/70 px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none">
                    <option value="">Topic (leave empty to unset)</option>
                    {topics.map((topic) => <option key={topic.value} value={topic.value}>{topic.text}</option>)}
                  </select>
                  <Button type="button" onClick={saveTopic}>{t("views.editor.changeTopic.button")}</Button>
                </div>
              </div>
              <div style={{ display: currentTab === TABS.MUSIC ? undefined : "none" }}>
                <VideoEditSongs id="musicEditor" ref={musicEditor} video={video} currentTime={currentTime} onTimeJump={seekTo} />
              </div>
              {currentTab === TABS.MENTIONS ? <VideoEditMentions video={video} /> : null}
            </div>
            <div className="mt-4"><WatchInfo key="info" video={video} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TabButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`rounded-xl px-3 py-2 text-sm transition ${active ? activeTabClass : inactiveTabClass}`} disabled={disabled} onClick={onClick}>{children}</button>;
}
