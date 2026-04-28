"use client";

import { useRef, useState } from "react";
import { mdiTwitch } from "@mdi/js";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";
import { useMultiviewStore } from "@/lib/multiview-store";
import * as icons from "@/lib/icons";

export function ReorderLayout({ isActive = false }: { isActive?: boolean }) {
  const { t } = useI18n();
  const store = useMultiviewStore();
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const [draggableIconPos, setDraggableIconPos] = useState<{ left: string | number; top: string | number }>({ left: 0, top: 0 });
  const container = useRef<HTMLDivElement | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const size = { width: 2 * (isMobile ? 108 : 192), height: 2 * (isMobile ? 192 : 108) };
  const touchMoveContent = draggingIdx >= 0 ? store.layoutContent[store.layout[draggingIdx]?.i] : null;
  if (!isActive) return null;
  function getRelativePoint(touch: React.Touch) {
    const br = container.current!.getBoundingClientRect();
    return { x: touch.clientX - br.left, y: touch.clientY - br.top };
  }
  function onTouchStart(e: React.TouchEvent, idx: number) { e.preventDefault(); setDraggingIdx(idx); onTouchMove(e); }
  function onTouchMove(e: React.TouchEvent) { e.preventDefault(); const { x, y } = getRelativePoint(e.changedTouches[0]); setDraggableIconPos({ left: `${x}px`, top: `${y}px` }); }
  function onTouchEnd(e: React.TouchEvent, startIdx: number) {
    e.preventDefault();
    const { x, y } = getRelativePoint(e.changedTouches[0]);
    const unitX = x / (size.width / 24);
    const unitY = y / (size.height / 24);
    const dropCellIdx = store.layout.findIndex((item: any) => unitX >= item.x && unitX < item.x + item.w && unitY >= item.y && unitY < item.y + item.h);
    if (dropCellIdx !== undefined) store.swapGridPosition({ id1: startIdx, id2: dropCellIdx });
    setDraggingIdx(-1);
  }
  function onDragStart(e: React.DragEvent, idx: number) { e.dataTransfer.setData("index", String(idx)); setDraggingIdx(idx); }
  function onDrop(e: React.DragEvent, dropIdx: number) { e.preventDefault(); const startIdx = Number(e.dataTransfer.getData("index")); store.swapGridPosition({ id1: startIdx, id2: dropIdx }); setDraggingIdx(-1); }
  function getStyle(item: any) {
    const px = (num: number) => `${num * (100 / 24)}%`;
    return { top: px(item.y), left: px(item.x), width: px(item.w), height: px(item.h), backgroundColor: store.layoutContent[item.i]?.type === "chat" ? "rgba(245, 158, 11, 0.27)" : "rgba(14, 165, 233, 0.27)" };
  }
  function contentIcon(item: any) {
    const content = store.layoutContent[item.i];
    if (!content) return null;
    if (content.type === "chat") return <Icon icon={icons.ytChat} size="lg" />;
    if (content.video?.type === "twitch") return <Icon icon={mdiTwitch} size="lg" />;
    return content.type === "video" ? <ChannelImg channel={content.video?.channel} noLink rounded /> : null;
  }
  return (
    <div>
      <div className="text-sm font-semibold text-white">{t("views.multiview.reorderLayout")}</div>
      <div className="mt-2 text-xs text-slate-300">{t("views.multiview.reorderLayoutDetail")}</div>
      <div ref={container} className="layout-preview m-auto mt-3" style={{ width: size.width, height: size.height }}>
        {store.layout.map((item, idx) => <div key={item.i} className="layout-preview-cell" style={getStyle(item)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, idx)}>{store.layoutContent[item.i] ? <div draggable className="pa-3 grabbable" style={{ opacity: draggingIdx !== idx ? 1 : 0 }} onDragStart={(event) => onDragStart(event, idx)} onDragEnd={() => setDraggingIdx(-1)} onTouchStart={(event) => onTouchStart(event, idx)} onTouchEnd={(event) => onTouchEnd(event, idx)} onTouchMove={onTouchMove} onTouchCancel={() => setDraggingIdx(-1)}>{contentIcon(item)}</div> : null}</div>)}
        {draggingIdx >= 0 && touchMoveContent ? <div style={{ position: "absolute", touchAction: "none", ...draggableIconPos }}>{touchMoveContent.type === "chat" ? <Icon icon={icons.ytChat} size="lg" /> : touchMoveContent.type === "video" && touchMoveContent.video?.type === "twitch" ? <Icon icon={mdiTwitch} size="lg" /> : touchMoveContent.type === "video" ? <ChannelImg channel={touchMoveContent.video?.channel} noLink rounded /> : null}</div> : null}
      </div>
    </div>
  );
}
