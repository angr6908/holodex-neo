"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { WatchLiveChat } from "@/components/watch/WatchLiveChat";
import { CellControl } from "@/components/multiview/CellControl";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import * as icons from "@/lib/icons";

export function ChatCell({ item, cellWidth = 0, tl = false, onDelete }: { item: any; cellWidth?: number; tl?: boolean; onDelete?: (id: string) => void }) {
  const app = useAppState();
  const { t } = useI18n();
  const store = useMultiviewStore();
  const content = store.layoutContent[item.i];
  const [showTlChat, setShowTlChat] = useState(tl);
  const [showYtChat, setShowYtChat] = useState(!tl);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRoot = useRef<HTMLDivElement | null>(null);
  const activeVideos = store.activeVideos;
  const editMode = content?.editMode ?? false;
  const currentTab = content?.currentTab ?? 0;
  const currentVideo = !activeVideos.length || currentTab >= activeVideos.length ? null : (activeVideos[currentTab] || activeVideos[0]);
  const videoCellId = useMemo(() => Object.keys(store.layoutContent).find((key) => store.layoutContent[key]?.video === currentVideo), [store.layoutContent, currentVideo]);
  const currentTime = videoCellId ? (store.layoutContent[videoCellId]?.currentTime || 0) : 0;
  const channels = activeVideos.map((video: any, index: number) => ({ text: video.channel?.[app.settings.nameProperty] || video.channel?.name || video.id, value: index }));
  const currentChannelLabel = channels.find((channel) => channel.value === currentTab)?.text || "";
  const twitchChatLink = currentVideo?.id ? `https://www.twitch.tv/embed/${currentVideo.id}/chat?parent=${typeof window !== "undefined" ? window.location.hostname : "localhost"}${app.settings.darkMode ? "&darkpopout" : ""}` : "";

  useEffect(() => { store.setLayoutContentWithKey({ id: item.i, key: "editMode", value: false }); }, [item.i]);
  useEffect(() => {
    function handleWindowClick(event: MouseEvent) {
      if (selectorOpen && selectorRoot.current && !selectorRoot.current.contains(event.target as Node)) setSelectorOpen(false);
    }
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [selectorOpen]);

  function setCurrentTab(value: number) { store.setLayoutContentWithKey({ id: item.i, key: "currentTab", value }); }
  function selectChannel(value: number) { setCurrentTab(value); setSelectorOpen(false); }
  function toggleYtChat() { setShowYtChat((prev) => { if (prev) setShowTlChat(true); return !prev; }); }
  function toggleTlChat() { setShowTlChat((prev) => { if (prev) setShowYtChat(true); return !prev; }); }
  function handleVideoUpdate(update: any) {
    if (!videoCellId || !store.layoutContent[videoCellId]?.video) return;
    const v = store.layoutContent[videoCellId].video;
    if (v.id !== update.id || !update?.status || !update?.start_actual) return;
    if (v.status !== update.status || v.start_actual !== update.start_actual) store.setLayoutContentWithKey({ id: videoCellId, key: "video", value: { ...v, ...update } });
  }

  return (
    <div className="cell-content">
      <div ref={selectorRoot} className="flex items-center gap-1 border-b border-white/10 px-1 py-0.5">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg" disabled={currentTab <= 0} onClick={() => setCurrentTab(currentTab - 1)}><Icon icon={icons.mdiChevronLeft} size="sm" /></Button>
        <div className="relative min-w-0 flex-1">
          <Button type="button" variant="outline" className="tabbed-chat-select h-8 w-full justify-between rounded-xl border-white/10 bg-slate-950 px-3 text-sm text-white" onClick={() => setSelectorOpen(!selectorOpen)}>
            <span className="truncate">{currentChannelLabel}</span>
            <Icon icon={icons.mdiMenuDown} size="sm" className="text-slate-400" />
          </Button>
          {selectorOpen ? (
            <Card className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-slate-950/85 backdrop-blur-none">
              <div className="max-h-56 overflow-y-auto"><div className="grid gap-1">
                {channels.map((channel) => <button key={channel.value} type="button" className={`flex w-full items-center justify-between rounded-xl border border-transparent bg-slate-900 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-800 ${currentTab === channel.value ? "border-sky-400/40 bg-sky-400/12 text-white" : ""}`} onClick={() => selectChannel(channel.value)}><span className="truncate">{channel.text}</span>{currentTab === channel.value ? <span className="text-sky-300">✓</span> : null}</button>)}
              </div></div>
            </Card>
          ) : null}
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg" disabled={currentTab >= activeVideos.length - 1} onClick={() => setCurrentTab(currentTab + 1)}><Icon icon={icons.mdiChevronRight} size="sm" /></Button>
      </div>
      <div className="chat-stage min-h-0 flex-1">
        {currentVideo && currentTab >= 0 ? currentVideo.type === "twitch" ? <iframe src={twitchChatLink} className="h-full w-full" frameBorder={0} /> : <WatchLiveChat key={`wlc${currentVideo.id}`} modelValue={{ showTlChat, showYtChat }} video={currentVideo} fluid scale={1} currentTime={currentTime} useLocalSubtitleToggle onVideoUpdate={handleVideoUpdate} /> : <div className="h-full" />}
      </div>
      {!editMode ? (
        <div className="chat-btns flex shrink-0">
          <Button type="button" size="sm" variant="secondary" className="h-7 min-w-0 flex-1 rounded-none px-2 text-xs" onClick={() => store.setLayoutContentWithKey({ id: item.i, key: "editMode", value: true })}><Icon icon={icons.mdiPencil} size="sm" className="mr-1" />{cellWidth > 200 ? t("component.videoCard.edit") : null}</Button>
          <Button type="button" size="sm" variant={showYtChat ? "default" : "ghost"} className="h-7 w-1/4 rounded-none px-2 text-xs" onClick={toggleYtChat}><Icon icon={icons.ytChat} size="sm" className="mr-1" />{cellWidth > 200 ? "Chat" : null}</Button>
          <Button type="button" size="sm" variant={showTlChat ? "default" : "ghost"} className="h-7 w-1/4 rounded-none px-2 text-xs" onClick={toggleTlChat}><Icon icon={icons.tlChat} size="sm" className="mr-1" />{cellWidth > 200 ? "TL" : null}</Button>
        </div>
      ) : <CellControl playIcon={icons.mdiCheck} onPlaypause={() => store.setLayoutContentWithKey({ id: item.i, key: "editMode", value: false })} onBack={() => store.deleteLayoutContent(item.i)} onDelete={() => onDelete?.(item.i)} />}
    </div>
  );
}
