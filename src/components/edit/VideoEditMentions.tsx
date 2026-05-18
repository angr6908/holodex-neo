"use client";

import { useEffect, useState } from "react";
import { AtSign } from "@/lib/icons";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChannelAutocomplete } from "@/components/channel/ChannelAutocomplete";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelInfo } from "@/components/channel/ChannelInfo";
import { channelDisplayName } from "@/lib/video-format";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";

export function VideoEditMentions({ video }: { video: any }) {
  const app = useAppState();
  const t = useTranslations();
  const [mentions, setMentions] = useState<any[]>([]);
  const [alert, setAlert] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const { useEnglishName } = app.settings;

  useEffect(() => { updateMentions(); }, [video.id]);

  function flashAlert(kind: "success" | "error", message: string) {
    setAlert({ kind, message });
    setTimeout(() => setAlert((current) => (current?.message === message ? null : current)), 4000);
  }
  function updateMentions() {
    api.getMentions(video.id).then(({ data }: any) => setMentions(data)).catch(console.error);
  }
  function handleApiError(e: any) {
    flashAlert("error", e.response?.data?.message || e.message || t("component.form.error"));
  }
  function deleteMention(channelId: string) {
    api.deleteMentions(video.id, [channelId], app.userdata.jwt)
      .then(({ data }: any) => {
        if (!data) return;
        flashAlert("success", t("views.editor.channelMentions.deleteSuccess"));
        updateMentions();
      })
      .catch(handleApiError);
  }
  function addMention(channelId: string) {
    api.addMention(video.id, channelId, app.userdata.jwt)
      .then(({ data }: any) => {
        if (!data) return;
        flashAlert("success", t("views.editor.channelMentions.addSuccess", { channel: channelDisplayName(selectedChannel, useEnglishName) }));
        updateMentions();
      })
      .catch(handleApiError);
  }

  return (
    <div>
      <div className="text-lg font-semibold">
        <AtSign className="size-4" /> {t("views.editor.channelMentions.tagsTitle")}
      </div>
      {alert ? (
	        <Alert variant={alert.kind === "error" ? "destructive" : "default"} className="mb-3">
	          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="my-2 flex flex-col gap-2">
        <ChannelAutocomplete value={selectedChannel} onChange={setSelectedChannel} />
        <Button disabled={!selectedChannel?.id} onClick={() => addMention(selectedChannel.id)}>
          {t("editor.music.add")}
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        {mentions.map((channel, index) => (
          <div key={`${channel.id || "channel"}-${index}`}>
            {index > 0 ? <Separator /> : null}
	            <div className="flex items-start gap-3 px-4 py-3 no-underline">
              <div className="shrink-0"><ChannelImg channel={channel} size={55} /></div>
              <ChannelInfo channel={channel} includeVideoCount={false} />
              <Button
                className="h-10 w-10"
                variant="destructive"
                size="icon"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  e.preventDefault();
                  deleteMention(channel.id);
                }}
              >
                <icons.Trash2 className="size-6" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
