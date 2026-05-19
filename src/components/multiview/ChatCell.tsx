"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Languages, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WatchLiveChat } from "@/components/watch/WatchLiveChat";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useAppState } from "@/lib/store";
import { channelDisplayName } from "@/lib/video-format";
import { useTranslations } from "next-intl";

export function ChatCell({ item, cellWidth = 0, tl = false, onDelete }: { item: any; cellWidth?: number; tl?: boolean; onDelete?: (id: string) => void }) {
  const app = useAppState();
  const t = useTranslations();
  const store = useMultiviewStore();
  const content = store.layoutContent[item.i];
  const [showTlChat, setShowTlChat] = useState(tl);
  const [showYtChat, setShowYtChat] = useState(!tl);
  const activeVideos = store.activeVideos;
  const deleteLabel = t("views.multiview.deleteCell");
  const currentTab = content?.currentTab ?? 0;
  const selectedTab = activeVideos.length ? Math.min(currentTab, activeVideos.length - 1) : -1;
  const currentVideo = selectedTab >= 0 ? activeVideos[selectedTab] : null;
  const videoCellId = useMemo(() => Object.keys(store.layoutContent).find((key) => store.layoutContent[key]?.video === currentVideo), [store.layoutContent, currentVideo]);
  const currentTime = videoCellId ? (store.layoutContent[videoCellId]?.currentTime || 0) : 0;
  const channels = activeVideos.map((video: any, index: number) => ({ text: channelDisplayName(video.channel, app.settings.useEnglishName) || video.id, value: index }));
  const selectValue = selectedTab >= 0 ? String(selectedTab) : "";
  const twitchChatLink = currentVideo?.id ? `https://www.twitch.tv/embed/${currentVideo.id}/chat?parent=${typeof window !== "undefined" ? window.location.hostname : "localhost"}${app.settings.darkMode ? "&darkpopout" : ""}` : "";
  const chatModes = [showYtChat ? "yt" : "", showTlChat ? "tl" : ""].filter(Boolean);

  function setCurrentTab(value: number) { store.setLayoutContentWithKey({ id: item.i, key: "currentTab", value }); }
  function selectChannel(value: number) { setCurrentTab(value); }
  function setChatModes(values: string[]) {
    if (values.length === 0) return;
    setShowYtChat(values.includes("yt"));
    setShowTlChat(values.includes("tl"));
  }
  function handleVideoUpdate(update: any) {
    if (!videoCellId || !store.layoutContent[videoCellId]?.video) return;
    const v = store.layoutContent[videoCellId].video;
    if (v.id !== update.id || !update?.status || !update?.start_actual) return;
    if (v.status !== update.status || v.start_actual !== update.start_actual) store.setLayoutContentWithKey({ id: videoCellId, key: "video", value: { ...v, ...update } });
  }

  return (
    <div className="flex h-full max-h-full min-h-0 w-full grow basis-full shrink flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b px-1 py-0.5">
        <Button type="button" variant="ghost" size="icon" disabled={selectedTab <= 0} onClick={() => setCurrentTab(selectedTab - 1)}>
          <ChevronLeft />
        </Button>
        <Select value={selectValue} onValueChange={(value) => { if (value) selectChannel(Number(value)); }}>
          <SelectTrigger size="sm" className="min-w-0 flex-1" disabled={!channels.length}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channels.map((channel) => <SelectItem key={channel.value} value={String(channel.value)}>{channel.text}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" disabled={selectedTab < 0 || selectedTab >= activeVideos.length - 1} onClick={() => setCurrentTab(selectedTab + 1)}>
          <ChevronRight />
        </Button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {currentVideo ? currentVideo.type === "twitch" ? <iframe src={twitchChatLink} className="h-full w-full" frameBorder={0} /> : <WatchLiveChat key={`wlc${currentVideo.id}`} modelValue={{ showTlChat, showYtChat }} video={currentVideo} fluid scale={1} currentTime={currentTime} useLocalSubtitleToggle onVideoUpdate={handleVideoUpdate} /> : <div className="h-full" />}
      </div>
      <div className="flex min-h-[26px] w-full shrink-0 items-center gap-1 px-1 py-0.5">
        <ToggleGroup multiple variant="outline" size="sm" value={chatModes} onValueChange={setChatModes} className="min-w-0 flex-1">
          <ToggleGroupItem value="yt"><MessageCircle />{cellWidth > 200 ? t("component.common.chat") : null}</ToggleGroupItem>
          <ToggleGroupItem value="tl"><Languages />{cellWidth > 200 ? "TL" : null}</ToggleGroupItem>
        </ToggleGroup>
        <Button type="button" variant="ghost" size="icon" className="ml-auto shrink-0" aria-label={deleteLabel} title={deleteLabel} onClick={() => onDelete?.(item.i)}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
