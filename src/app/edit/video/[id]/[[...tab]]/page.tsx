"use client";

import { useParams, useSearchParams } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import * as icons from "@/lib/icons";
import { readWatchControlsState, writeWatchControlsState } from "@/lib/browser";

const TABS = Object.freeze({ TOPIC: "topic", MUSIC: "music", MENTIONS: "mentions", SOURCES_CLIPS: "sources" });
type TabKey = (typeof TABS)[keyof typeof TABS];

const playerClass = "relative aspect-video h-auto w-full overflow-hidden rounded-lg bg-background [&>div]:absolute [&>div]:inset-0 [&>div]:h-full [&>div]:w-full [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full";

export default function EditVideoPage() {
  const params = useParams<{ id?: string; tab?: string[] }>();
  const search = useSearchParams();
  const t = useTranslations();
  const app = useAppState();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [video, setVideo] = useState<any>(null);
  const [currentTab, setCurrentTab] = useState<TabKey>(TABS.TOPIC);
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
  const isStream = video?.type === "stream";
  const showChat = isLive && (showTL || showLiveChat);
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
    const tab = params.tab?.[0]?.toLowerCase();
    const known = Object.values(TABS) as string[];
    setCurrentTab((tab && known.includes(tab) ? tab : TABS.TOPIC) as TabKey);
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
    <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl items-center justify-center px-3 pb-10 pt-[var(--nav-total-height,120px)] sm:px-5">
      {isLoading && !hasError ? (
        <Card className="inline-flex flex-row items-center gap-3 px-4 py-3">
          <Spinner />
        </Card>
      ) : null}
      {hasError ? <ApiErrorMessage /> : null}
    </div>
  );

  return (
    <section className="mx-auto min-h-screen w-full max-w-screen-2xl px-3 pb-10 pt-[var(--nav-total-height,120px)] sm:px-5">
      {!app.userdata?.jwt ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription dangerouslySetInnerHTML={{ __html: t.raw("views.editor.needlogin") }} />
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          {video.id ? (
            <YoutubePlayer
              ref={player}
              className={playerClass}
              videoId={video.id}
              start={timeOffset}
              autoplay
              lang={getLang}
              onReady={(p) => { player.current = p; setTimer(); }}
            />
          ) : null}

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

          {showChat ? (
            <Card className="h-[480px] overflow-hidden p-0">
              <WatchLiveChat
                className="h-full"
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
            </Card>
          ) : null}

          <WatchInfo video={video} onTimeJump={seekTo} />
        </div>

        <div className="lg:col-span-7">
          <Card className="gap-4 p-4">
            <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as TabKey)}>
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value={TABS.TOPIC} disabled={!isStream}>{t("component.search.type.topic")}</TabsTrigger>
                <TabsTrigger value={TABS.MUSIC} disabled={!isStream}>{t("component.mainNav.music")}</TabsTrigger>
                <TabsTrigger value={TABS.MENTIONS}>{t("views.editor.channelMentions.title")}</TabsTrigger>
                <TabsTrigger value={TABS.SOURCES_CLIPS} disabled>{t("views.editor.sources.title")}</TabsTrigger>
              </TabsList>

              <TabsContent value={TABS.TOPIC} className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <icons.CirclePlay className="size-5" />
                  <h2>{t("views.editor.changeTopic.title")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{t("views.editor.changeTopic.info")}</p>
                <div className="space-y-2">
                  <Label htmlFor="edit-topic-select">{t("component.search.type.topic")}</Label>
                  <Select value={newTopic || "__unset__"} onValueChange={(value) => setNewTopic(value === "__unset__" ? null : value)}>
                    <SelectTrigger id="edit-topic-select" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">{t("component.search.unset")}</SelectItem>
                      {topics.map((topic) => <SelectItem key={topic.value} value={topic.value}>{topic.text}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={saveTopic}>{t("views.editor.changeTopic.button")}</Button>
              </TabsContent>

              <TabsContent value={TABS.MUSIC} keepMounted className="space-y-4">
                {video.comments?.length ? (
                  <CommentSongParser comments={video.comments} onSongSelected={selectSongCandidate} />
                ) : null}
                <VideoEditSongs id="musicEditor" ref={musicEditor} video={video} currentTime={currentTime} onTimeJump={seekTo} />
              </TabsContent>

              <TabsContent value={TABS.MENTIONS}>
                <VideoEditMentions video={video} />
              </TabsContent>

              <TabsContent value={TABS.SOURCES_CLIPS}>
                <p className="text-sm text-muted-foreground">{t("views.editor.sources.title")}</p>
              </TabsContent>
            </Tabs>
          </Card>

          {video.comments?.length ? (
            <Card className="mt-4 max-h-[60vh] gap-0 overflow-y-auto overflow-x-hidden p-4">
              <WatchComments hideBuckets defaultExpanded comments={video.comments} video={video} limit={app.isMobile ? 5 : 0} onTimeJump={seekTo} />
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
}
