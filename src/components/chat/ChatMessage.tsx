"use client";

import { useMemo, useState } from "react";
import { dayjs, formatDuration } from "@/lib/time";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { ChannelImg } from "@/components/channel/ChannelImg";
import * as icons from "@/lib/icons";

export function ChatMessage({ source, hideAuthor = false }: { source: Record<string, any>; index?: number; hideAuthor?: boolean }) {
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
    <div className={`flex flex-row ${!hideAuthor && !source.shouldHideAuthor ? "with-author" : ""}`}>
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
            className={`tl-caption ${source.is_owner ? "text-[color:var(--color-primary)]" : (!source.is_owner && (source.is_verified || source.is_moderator || source.is_vtuber) ? "text-[color:var(--color-accent)]" : "")}`}
          >
            <button type="button" className="tl-name relative text-left" onClick={() => setShowBlockChannelDialog(true)}>
              {source.is_vtuber ? <span>[Vtuber]</span> : null}
              {source.is_moderator ? <span>[Mod]</span> : null}
              {source.name}<span>{source.is_verified ? <span style={{ fontWeight: 800 }}> ✓</span> : null}:</span>
              <Icon icon={icons.mdiCog} size="xs" className="tl-name-icon absolute mt-[2px] w-[11px]" />
            </button>
          </div>
        ) : null}
        <a className="tl-message" data-time={source.relativeMs / 1000}>
          {source.timestamp ? (
            <span className="tl-caption mr-1">
              {app.settings.liveTlShowLocalTime || !displayTime ? realTime : displayTime}
            </span>
          ) : null}
          {source.parsed ? <span className="text-[color:var(--color-primary)]" dangerouslySetInnerHTML={{ __html: source.parsed }} /> : <span className="text-[color:var(--color-primary)]">{source.message}</span>}
        </a>
      </div>
      {!hideAuthor && !source.shouldHideAuthor ? (
        <Dialog open={showBlockChannelDialog} className="max-w-lg p-0" onOpenChange={setShowBlockChannelDialog}>
          <Card className="space-y-5 p-5">
            <div className="text-lg font-semibold text-white">
              {source.name}
            </div>
            <div className="flex flex-wrap gap-2">
              {source.channel_id ? (
                <Button as="a" href={`https://youtube.com/channel/${source.channel_id}`} target="_blank" rel="noreferrer" variant="destructive" size="sm">
                  <Icon icon={icons.mdiYoutube} size="sm" />
                  Youtube
                </Button>
              ) : null}
              {source.channel_id && source.is_vtuber ? (
                <Button as="a" href={`https://holodex.net/channel/${source.channel_id}`} target="_blank" rel="noreferrer" variant="secondary" size="sm">
                  Holodex
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => toggleBlockName(source.name)}>
                {!blockedNames.has(source.name) ? "Block Channel" : "Unblock"}
              </Button>
            </div>
          </Card>
        </Dialog>
      ) : null}
    </div>
  );
}
