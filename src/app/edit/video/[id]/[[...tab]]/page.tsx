"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { decodeHTMLEntities, getYTLangFromState } from "@/lib/functions";
import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { YoutubePlayer, type YoutubePlayerHandle } from "@/components/player/YoutubePlayer";
import { WatchInfo } from "@/components/watch/WatchInfo";
import { WatchToolbar } from "@/components/watch/WatchToolbar";
import { WatchLiveChat } from "@/components/watch/WatchLiveChat";
import { WatchComments } from "@/components/watch/WatchComments";
import { VideoEditSongs, type VideoEditSongsHandle } from "@/components/edit/VideoEditSongs";
import { VideoEditMentions } from "@/components/edit/VideoEditMentions";
import { CommentSongParser } from "@/components/media/CommentSongParser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import * as icons from "@/lib/icons";
import { readWatchControlsState, writeWatchControlsState } from "@/lib/browser";
const TABS = Object.freeze({ TOPIC: 0, MUSIC: 1, MENTIONS: 2, SOURCES_CLIPS: 3 });

export default function EditVideoPage() {
  const params = useParams<{ id?: string; tab?: string[] }>();
  const search = useSearchParams();
  const router = useRouter();
  const t = useTranslations();
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

  function seekTo(time: number, playNow?: boolean, updateStartTime?: boolean) {
    if (!player.current) return;
    player.current.seekTo(time);
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

  if (isLoading || hasError || !video) return (
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
    <section className="app-page video-editor">
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
                <Toggle pressed={showTL} aria-label={showTL ? t("views.watch.chat.hideTLBtn") : t("views.watch.chat.showTLBtn")} onPressedChange={setShowTL}>
                  <icons.TlChatIcon className="size-5" />
                </Toggle>
              ) : null}
              {isLive ? (
                <Toggle pressed={showLiveChat} aria-label={t("views.watch.chat.ytChatLabel")} onPressedChange={setShowLiveChat}>
                  <icons.YtChatIcon className="size-5" />
                </Toggle>
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
            <div className="h-[60vh] overflow-y-auto overflow-x-hidden">
              {currentTab === TABS.MUSIC ? <CommentSongParser comments={video.comments} onSongSelected={selectSongCandidate} /> : null}
              <WatchComments key="comments" hideBuckets defaultExpanded comments={video.comments} video={video} limit={app.isMobile ? 5 : 0} onTimeJump={seekTo} />
            </div>
          ) : null}
        </div>
        <div className="related-videos pt-0 lg:col-span-8">
          {!app.userdata?.jwt ? (
            <Alert variant="destructive" className="mb-4 rounded-xl border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-100">
              <AlertDescription className="text-red-100" dangerouslySetInnerHTML={{ __html: t.raw("views.editor.needlogin") }} />
            </Alert>
          ) : null}
          <Card className="gap-0 rounded-2xl border-white/10 bg-white/4 p-4 shadow-none">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="icon" title={t("editor.exitMode")} onClick={() => router.back()}><icons.ArrowLeft className="size-5" /></Button>
              <ToggleGroup
                value={[String(currentTab)]}
                onValueChange={(value) => value[0] && setCurrentTab(Number(value[0]))}
                className="flex-wrap justify-start"
              >
                <ToggleGroupItem value={String(TABS.TOPIC)} disabled={video.type !== "stream"}>{t("component.search.type.topic")}</ToggleGroupItem>
                <ToggleGroupItem value={String(TABS.MUSIC)} disabled={video.type !== "stream"}>{t("component.mainNav.music")}</ToggleGroupItem>
                <ToggleGroupItem value={String(TABS.MENTIONS)}>{t("views.editor.channelMentions.title")}</ToggleGroupItem>
                <ToggleGroupItem value={String(TABS.SOURCES_CLIPS)} disabled>{t("views.editor.sources.title")}</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="p-1">
              <div style={{ display: currentTab === TABS.TOPIC ? undefined : "none" }}>
                <div className="mb-3 flex items-center gap-2 text-lg font-semibold text-[color:var(--color-foreground)]">
                  <icons.CirclePlay className="size-5" />
                  <h5>{t("views.editor.changeTopic.title")}</h5>
                </div>
                <div className="space-y-3">
                  <p>{t("views.editor.changeTopic.info")}</p>
                  <Select value={newTopic || "__unset__"} onValueChange={(value) => setNewTopic(value === "__unset__" ? null : value)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">{t("component.search.unset")}</SelectItem>
                      {topics.map((topic) => <SelectItem key={topic.value} value={topic.value}>{topic.text}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={saveTopic}>{t("views.editor.changeTopic.button")}</Button>
                </div>
              </div>
              <div style={{ display: currentTab === TABS.MUSIC ? undefined : "none" }}>
                <VideoEditSongs id="musicEditor" ref={musicEditor} video={video} currentTime={currentTime} onTimeJump={seekTo} />
              </div>
              {currentTab === TABS.MENTIONS ? <VideoEditMentions video={video} /> : null}
            </div>
            <div className="mt-4"><WatchInfo key="info" video={video} /></div>
          </Card>
        </div>
      </div>
    </section>
  );
}
