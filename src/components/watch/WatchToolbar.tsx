"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { mdiArrowLeft } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { VideoCardMenu } from "@/components/common/VideoCardMenu";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import * as icons from "@/lib/icons";

export function WatchToolbar({ video, noBackButton = false, children }: { video: Record<string, any>; noBackButton?: boolean; children?: React.ReactNode }) {
  const router = useRouter();
  const app = useAppState();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
  const hasSaved = app.playlist.some((item) => item.id === video.id);
  const menuPosition = useMemo(() => {
    if (typeof window === "undefined") return { left: `${menuAnchor.x}px`, top: `${menuAnchor.y}px` };
    const menuWidth = 224;
    const menuHeight = 420;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = menuAnchor.x - menuWidth;
    let y = menuAnchor.y + 8;
    if (x < 8) x = 8;
    if (x + menuWidth > vw - 8) x = vw - menuWidth - 8;
    if (y + menuHeight > vh - 8) y = menuAnchor.y - menuHeight - 8;
    if (y < 8) y = 8;
    return { left: `${x}px`, top: `${y}px` };
  }, [menuAnchor.x, menuAnchor.y]);
  function toggleSaved() { if (hasSaved) app.removeFromPlaylist(video.id); else app.addToPlaylist(video); }
  function toggleMenu(event: React.MouseEvent<HTMLElement>) {
    if (!menuOpen) {
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuAnchor({ x: rect.right, y: rect.bottom });
    }
    setMenuOpen((value) => !value);
  }
  function reloadVideo() {
    const curr = document.querySelector("[id^=\"youtube-player\"]") as HTMLIFrameElement | null;
    if (curr?.contentWindow) curr.contentWindow.location.replace(curr.src);
  }
  return (
    <div className="watch-toolbar relative z-[40] flex justify-between gap-2 border-b border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur-xl lg:px-4">
      {!noBackButton ? <Button type="button" size="icon" variant="ghost" onClick={() => router.back()}><Icon icon={mdiArrowLeft} /></Button> : null}
      <div className="watch-btn-group ml-auto flex items-center gap-2">
        {children}
        <Button type="button" size="icon" variant="ghost" title="Reload Video Frame" onClick={reloadVideo}><Icon icon={icons.mdiRefresh} /></Button>
        <Button type="button" size="icon" variant={hasSaved ? "default" : "ghost"} title={hasSaved ? t("views.watch.removeFromPlaylist") : t("views.watch.saveToPlaylist")} onClick={toggleSaved}><Icon icon={hasSaved ? icons.mdiCheck : icons.mdiPlusBox} /></Button>
        <div className="relative">
          <Button type="button" size="icon" variant="ghost" title="More actions" onClick={toggleMenu}><Icon icon={icons.mdiDotsVertical} /></Button>
        </div>
      </div>
      {menuOpen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[500]" onClick={() => setMenuOpen(false)}>
          <div className="absolute w-56 rounded-2xl border border-white/10 bg-slate-950/96 p-2 shadow-2xl shadow-slate-950/60 backdrop-blur-xl" style={menuPosition} onClick={(event) => event.stopPropagation()}>
            <VideoCardMenu video={video} close={() => setMenuOpen(false)} />
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
