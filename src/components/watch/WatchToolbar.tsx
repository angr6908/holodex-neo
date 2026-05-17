"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VideoCardMenu } from "@/components/common/VideoCardMenu";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";

export function WatchToolbar({ video, children }: { video: Record<string, any>; children?: React.ReactNode }) {
  const router = useRouter();
  const app = useAppState();
  const t = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasSaved = app.playlist.some((item) => item.id === video.id);
  const saveLabel = hasSaved ? t("views.watch.removeFromPlaylist") : t("views.watch.saveToPlaylist");
  function toggleSaved() { if (hasSaved) app.removeFromPlaylist(video.id); else app.addToPlaylist(video); }
  const reloadVideo = () => { const curr = document.querySelector("[id^=\"youtube-player\"]") as HTMLIFrameElement | null; if (curr?.contentWindow) curr.contentWindow.location.replace(curr.src); };
  return (
    <div className="watch-toolbar sticky top-[var(--nav-h)] z-[40] flex justify-between gap-2 border-b border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur-xl max-[959px]:top-[calc(var(--nav-h)+var(--pad-y))] lg:px-4">
      <Button type="button" size="icon" variant="ghost" onClick={() => router.back()}><ArrowLeft className="size-5" /></Button>
      <TooltipProvider>
        <div className="watch-btn-group ml-auto flex items-center gap-2">
          {children}
          <Tooltip>
            <TooltipTrigger
              render={<Button type="button" size="icon" variant="ghost" aria-label={t("views.watch.reloadVideoFrame")} onClick={reloadVideo} />}
            >
              <icons.RefreshCw className="size-5" />
            </TooltipTrigger>
            <TooltipContent>{t("views.watch.reloadVideoFrame")}</TooltipContent>
	          </Tooltip>
	          <Tooltip>
	            <TooltipTrigger
                render={<Toggle pressed={hasSaved} aria-label={saveLabel} onPressedChange={toggleSaved} />}
              >
	              {hasSaved ? <icons.Check className="size-5" /> : <icons.SquarePlus className="size-5" />}
	            </TooltipTrigger>
	            <TooltipContent>{saveLabel}</TooltipContent>
	          </Tooltip>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <PopoverTrigger render={<Button type="button" size="icon" variant="ghost" aria-label={t("component.common.moreActions")} />} />
                }
              >
                <icons.MoreVertical className="size-5" />
              </TooltipTrigger>
              <TooltipContent>{t("component.common.moreActions")}</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" sideOffset={8} className="z-[500] w-56 rounded-2xl border-white/10 bg-slate-950/96 p-2 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
              <VideoCardMenu video={video} close={() => setMenuOpen(false)} />
            </PopoverContent>
          </Popover>
        </div>
      </TooltipProvider>
    </div>
  );
}
