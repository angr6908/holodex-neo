"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as icons from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { dayjs, formatDuration } from "@/lib/time";

export function ChatMessage({
  source,
  hideAuthor = false,
}: {
  source: Record<string, any>;
  hideAuthor?: boolean;
}) {
  const app = useAppState();
  const t = useTranslations();
  const [showBlockChannelDialog, setShowBlockChannelDialog] = useState(false);
  const realTime = useMemo(() => dayjs(source.timestamp).format("LTS"), [source.timestamp]);
  const displayTime = useMemo(() => {
    if (!source.relativeMs) return null;
    return (
      (Math.sign(source.relativeMs) < 0 ? "-" : "") + formatDuration(Math.abs(source.relativeMs))
    );
  }, [source.relativeMs]);
  const blockedNames = new Set(app.settings.liveTlBlocked || []);

  function toggleBlockName(name: string) {
    const next = new Set(app.settings.liveTlBlocked || []);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    app.patchSettings({ liveTlBlocked: [...next] } as any);
  }

  return (
    <div
      className={`flex flex-row ${!hideAuthor && !source.shouldHideAuthor ? "mt-1 border-t pt-1" : ""}`}
    >
      {source.is_vtuber && source.channel_id ? (
        <div className="mr-2 min-w-7">
          {!hideAuthor && !source.shouldHideAuthor ? (
            <ChannelImg
              className="self-center"
              channel={{ id: source.channel_id, name: source.name }}
              size={28}
              rounded
              noLink
            />
          ) : null}
        </div>
      ) : null}
      <div className="basis-full">
        {!hideAuthor && !source.shouldHideAuthor ? (
          <div
            className={`text-[0.85em] text-muted-foreground ${source.is_owner || source.is_verified || source.is_moderator || source.is_vtuber ? "text-primary" : ""}`}
          >
            <Button
              type="button"
              variant="ghost"
              className="group/tl-name relative h-auto cursor-pointer justify-start border-0 bg-transparent p-0 text-left break-words hover:bg-transparent"
              onClick={() => setShowBlockChannelDialog(true)}
            >
              {source.is_vtuber ? <span>[{t("component.chatMessage.vtuberBadge")}]</span> : null}
              {source.is_moderator ? (
                <span>[{t("component.chatMessage.moderatorBadge")}]</span>
              ) : null}
              {source.name}
              <span>{source.is_verified ? <span className="font-extrabold"> ✓</span> : null}:</span>
              <icons.Settings className="size-3.5 absolute mt-[2px] w-[11px] opacity-0 group-hover/tl-name:opacity-100" />
            </Button>
          </div>
        ) : null}
        <a
          className="tl-message break-words [&_img]:h-[1.3em] [&_img]:w-auto [&_img]:align-middle"
          data-time={source.relativeMs / 1000}
        >
          {source.timestamp ? (
            <span className="mr-1 text-[0.85em] text-muted-foreground">
              {app.settings.liveTlShowLocalTime || !displayTime ? realTime : displayTime}
            </span>
          ) : null}
          {source.parsed ? (
            <span className="text-primary" dangerouslySetInnerHTML={{ __html: source.parsed }} />
          ) : (
            <span className="text-primary">{source.message}</span>
          )}
        </a>
      </div>
      {!hideAuthor && !source.shouldHideAuthor ? (
        <Dialog open={showBlockChannelDialog} onOpenChange={setShowBlockChannelDialog}>
          <DialogContent className="max-w-lg">
            <Card>
              <DialogTitle className="text-lg font-normal leading-7">{source.name}</DialogTitle>
              <div className="flex flex-wrap gap-2">
                {source.channel_id ? (
                  <Button
                    nativeButton={false}
                    render={
                      <a
                        href={`https://youtube.com/channel/${source.channel_id}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                    variant="destructive"
                    size="sm"
                  >
                    <icons.YoutubeIcon className="size-4" />
                    {t("component.chatMessage.openYouTube")}
                  </Button>
                ) : null}
                {source.channel_id && source.is_vtuber ? (
                  <Button
                    nativeButton={false}
                    render={
                      <a
                        href={`https://holodex.net/channel/${source.channel_id}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                    variant="secondary"
                    size="sm"
                  >
                    Holodex
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => toggleBlockName(source.name)}>
                  {!blockedNames.has(source.name)
                    ? t("component.chatMessage.blockChannel")
                    : t("component.chatMessage.unblock")}
                </Button>
              </div>
            </Card>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
