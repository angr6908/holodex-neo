"use client";

import { useEffect, useState } from "react";
import { mdiSelectionEllipseArrowInside } from "@mdi/js";
import { getVideoIDFromUrl } from "@/lib/functions";
import { TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";
import { Icon } from "@/components/ui/Icon";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";

export function CellContainer({ item, editMode: editModeProp, onSetContent, children }: { item: Record<string, any>; editMode?: boolean; onSetContent?: (id: string, content: any) => void; children: React.ReactNode }) {
  const store = useOptionalMultiviewStore();
  const [showDropOverlay, setShowDropOverlay] = useState(false);
  const [enterTarget, setEnterTarget] = useState<EventTarget | null>(null);
  const editMode = editModeProp ?? store?.layoutContent[item.i]?.editMode ?? true;
  const freezeLayoutItem = store?.freezeLayoutItem;
  const unfreezeLayoutItem = store?.unfreezeLayoutItem;

  useEffect(() => {
    if (editMode) unfreezeLayoutItem?.(item.i);
    else freezeLayoutItem?.(item.i);
  }, [editMode, item.i, freezeLayoutItem, unfreezeLayoutItem]);

  const setContent = (content: any) => { if (store) { store.setLayoutContentById({ id: item.i, content }); store.fetchVideoData(); } onSetContent?.(item.i, content); };
  const dragEnter = (ev: React.DragEvent) => { setEnterTarget(ev.target); setShowDropOverlay(true); };
  const dragLeave = (ev: React.DragEvent) => { if (enterTarget === ev.target) setShowDropOverlay(false); };
  const allowDrop = (ev: React.DragEvent) => ev.preventDefault();
  function drop(ev: React.DragEvent) {
    ev.preventDefault();
    setShowDropOverlay(false);
    const json = ev.dataTransfer.getData("application/json");
    if (json) {
      const video = JSON.parse(json);
      if (video.id?.length === 11 && video.channel?.name) {
        let v = video;
        if (video.type === "placeholder") {
          const twitchChannel = video.link?.match(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
          if (!twitchChannel) return;
          v = { ...video, id: twitchChannel, type: "twitch" };
        }
        setContent({ type: "video", id: v.id, video: v });
      }
      return;
    }
    const text = ev.dataTransfer.getData("text");
    const video = getVideoIDFromUrl(text) as any;
    if (!video || !video.id) return;
    setContent({ id: video.id, type: "video", video });
  }
  return (
    <div className={`mv-cell relative ${editMode ? "edit-mode" : ""}`} onDrop={drop} onDragOver={allowDrop} onDragLeave={dragLeave} onDragEnter={dragEnter}>
      {showDropOverlay ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/72 backdrop-blur-sm"><Icon icon={mdiSelectionEllipseArrowInside} size="xl" className="text-sky-200" /></div> : null}
      {children}
    </div>
  );
}
