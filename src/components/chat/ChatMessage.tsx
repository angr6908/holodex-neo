"use client";

import { useMemo, useState } from "react";
import { dayjs, formatDuration } from "@/lib/time";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { ChannelImg } from "@/components/channel/ChannelImg";
import * as icons from "@/lib/icons";

export function ChatMessage({ source, hideAuthor = false }: { source: Record<string, any>; hideAuthor?: boolean }) {
  const app = useAppState();
  const [showBlockChannelDialog, setShowBlockChannelDialog] = useState(false);
  const realTime = useMemo(() => dayjs(source.timestamp).format("LTS"), [source.timestamp]);
  const displayTime = useMemo(() => {
    if (!source.relativeMs) return null;
    return (Math.sign(source.relativeMs) < 0 ? "-" : "") + formatDuration(Math.abs(source.relativeMs));
  }, [source.relativeMs]);
  const blockedNames = new Set(app.settings.liveTlBlocked || []);

  function toggleBlockName(name: string) {
    const next = new Set(app.settings.liveTlBlocked || []);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    app.patchSettings({ liveTlBlocked: [...next] } as any);
  }

  return (
    <div className={`flex flex-row ${!hideAuthor && !source.shouldHideAuthor ? "mt-1 border-t border-white/8 pt-1" : ""}`}>
      {source.is_vtuber && source.channel_id ? (
        <div style={{ minWidth: 28 }} className="mr-2">
          {!hideAuthor && !source.shouldHideAuthor ? (
            <ChannelImg className="self-center" channel={{ id: source.channel_id, name: source.name }} size={28} rounded noLink />
          ) : null}
        </div>
      ) : null}
      <div className="basis-full">
        {!hideAuthor && !source.shouldHideAuthor ? (
          <div
            className={`text-[0.85em] tracking-[0.033em] text-[hsla(0,0%,70%,0.7)] ${source.is_owner ? "text-[color:var(--color-primary)]" : ((source.is_verified || source.is_moderator || source.is_vtuber) ? "text-[color:var(--color-accent)]" : "")}`}
          >
            <Button type="button" variant="ghost" className="group/tl-name relative h-auto cursor-pointer justify-start border-0 bg-transparent p-0 text-left break-words hover:bg-transparent" onClick={() => setShowBlockChannelDialog(true)}>
              {source.is_vtuber ? <span>[Vtuber]</span> : null}
              {source.is_moderator ? <span>[Mod]</span> : null}
              {source.name}<span>{source.is_verified ? <span style={{ fontWeight: 800 }}> ✓</span> : null}:</span>
              <icons.Settings className="size-3.5 absolute mt-[2px] w-[11px] opacity-0 group-hover/tl-name:opacity-100" />
            </Button>
          </div>
        ) : null}
        <a className="tl-message break-words [&_img]:h-[1.3em] [&_img]:w-auto [&_img]:align-middle" data-time={source.relativeMs / 1000}>
          {source.timestamp ? (
            <span className="mr-1 text-[0.85em] tracking-[0.033em] text-[hsla(0,0%,70%,0.7)]">
              {app.settings.liveTlShowLocalTime || !displayTime ? realTime : displayTime}
            </span>
          ) : null}
          {source.parsed ? <span className="text-[color:var(--color-primary)]" dangerouslySetInnerHTML={{ __html: source.parsed }} /> : <span className="text-[color:var(--color-primary)]">{source.message}</span>}
        </a>
      </div>
      {!hideAuthor && !source.shouldHideAuthor ? (
        <Dialog open={showBlockChannelDialog} onOpenChange={setShowBlockChannelDialog}>
          <DialogContent className="max-w-lg p-0">
          <Card className="space-y-5 p-5">
            <DialogTitle className="text-lg font-semibold leading-7 text-white">
              {source.name}
            </DialogTitle>
            <div className="flex flex-wrap gap-2">
              {source.channel_id ? (
                <Button nativeButton={false}
                  render={<a href={`https://youtube.com/channel/${source.channel_id}`} target="_blank" rel="noreferrer" />}
                  variant="destructive"
                  size="sm"
                >
                  <icons.YoutubeIcon className="size-4" />
                  Youtube
                </Button>
              ) : null}
              {source.channel_id && source.is_vtuber ? (
                <Button nativeButton={false}
                  render={<a href={`https://holodex.net/channel/${source.channel_id}`} target="_blank" rel="noreferrer" />}
                  variant="secondary"
                  size="sm"
                >
                  Holodex
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => toggleBlockName(source.name)}>
                {!blockedNames.has(source.name) ? "Block Channel" : "Unblock"}
              </Button>
            </div>
          </Card>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
