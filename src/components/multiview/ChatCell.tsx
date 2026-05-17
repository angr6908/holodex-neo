"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WatchLiveChat } from "@/components/watch/WatchLiveChat";
import { CellControl } from "@/components/multiview/CellControl";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useAppState } from "@/lib/store";
import { channelDisplayName } from "@/lib/video-format";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";

export function ChatCell({ item, cellWidth = 0, tl = false, onDelete }: { item: any; cellWidth?: number; tl?: boolean; onDelete?: (id: string) => void }) {
  const app = useAppState();
  const t = useTranslations();
  const store = useMultiviewStore();
  const content = store.layoutContent[item.i];
  const [showTlChat, setShowTlChat] = useState(tl);
  const [showYtChat, setShowYtChat] = useState(!tl);
  const activeVideos = store.activeVideos;
  const editMode = content?.editMode ?? false;
  const currentTab = content?.currentTab ?? 0;
  const currentVideo = !activeVideos.length || currentTab >= activeVideos.length ? null : (activeVideos[currentTab] || activeVideos[0]);
  const videoCellId = useMemo(() => Object.keys(store.layoutContent).find((key) => store.layoutContent[key]?.video === currentVideo), [store.layoutContent, currentVideo]);
  const currentTime = videoCellId ? (store.layoutContent[videoCellId]?.currentTime || 0) : 0;
  const channels = activeVideos.map((video: any, index: number) => ({ text: channelDisplayName(video.channel, app.settings.useEnglishName) || video.id, value: index }));
  const twitchChatLink = currentVideo?.id ? `https://www.twitch.tv/embed/${currentVideo.id}/chat?parent=${typeof window !== "undefined" ? window.location.hostname : "localhost"}${app.settings.darkMode ? "&darkpopout" : ""}` : "";
  const chatModes = [showYtChat ? "yt" : "", showTlChat ? "tl" : ""].filter(Boolean);

  useEffect(() => { store.setLayoutContentWithKey({ id: item.i, key: "editMode", value: false }); }, [item.i]);

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
      <div className="flex items-center gap-1 border-b border-white/10 px-1 py-0.5">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg" disabled={currentTab <= 0} onClick={() => setCurrentTab(currentTab - 1)}><icons.ChevronLeft className="size-4" /></Button>
        <Select value={String(currentTab)} onValueChange={(value) => selectChannel(Number(value))}>
          <SelectTrigger size="sm" className="h-8 min-w-0 flex-1 rounded-xl border-white/10 bg-slate-950 px-3 text-sm text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-20 border-white/10 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/85">
            {channels.map((channel) => <SelectItem key={channel.value} value={String(channel.value)}>{channel.text}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg" disabled={currentTab >= activeVideos.length - 1} onClick={() => setCurrentTab(currentTab + 1)}><icons.ChevronRight className="size-4" /></Button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {currentVideo && currentTab >= 0 ? currentVideo.type === "twitch" ? <iframe src={twitchChatLink} className="h-full w-full" frameBorder={0} /> : <WatchLiveChat key={`wlc${currentVideo.id}`} modelValue={{ showTlChat, showYtChat }} video={currentVideo} fluid scale={1} currentTime={currentTime} useLocalSubtitleToggle onVideoUpdate={handleVideoUpdate} /> : <div className="h-full" />}
      </div>
      {!editMode ? (
        <div className="flex min-h-[26px] w-full shrink-0">
          <Button type="button" size="sm" variant="secondary" className="h-7 min-w-0 flex-1 px-2 text-xs" onClick={() => store.setLayoutContentWithKey({ id: item.i, key: "editMode", value: true })}><icons.Pencil className="size-4 mr-1" />{cellWidth > 200 ? t("component.videoCard.edit") : null}</Button>
          <ToggleGroup multiple value={chatModes} onValueChange={setChatModes} className="w-1/2 gap-0 rounded-none">
            <ToggleGroupItem value="yt" size="sm" className="h-7 min-w-0 flex-1 rounded-none px-2 text-xs"><icons.YtChatIcon className="size-4 mr-1" />{cellWidth > 200 ? t("component.common.chat") : null}</ToggleGroupItem>
            <ToggleGroupItem value="tl" size="sm" className="h-7 min-w-0 flex-1 rounded-none px-2 text-xs"><icons.TlChatIcon className="size-4 mr-1" />{cellWidth > 200 ? "TL" : null}</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : <CellControl playIcon={icons.Check} onPlaypause={() => store.setLayoutContentWithKey({ id: item.i, key: "editMode", value: false })} onBack={() => store.deleteLayoutContent(item.i)} onDelete={() => onDelete?.(item.i)} />}
    </div>
  );
}
