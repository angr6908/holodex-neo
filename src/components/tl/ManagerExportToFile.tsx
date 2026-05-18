"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { TL_LANGS } from "@/lib/consts";
import { useTranslations } from "next-intl";
import { useAppState } from "@/lib/store";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildTlAssExport, buildTlSrtExport, buildTlTtmlExport, downloadTextFile } from "@/lib/tl-format";
const defaultProfile = [{
  Name: "Default",
  Prefix: "",
  Suffix: "",
  useCC: false,
  CC: "#000000",
  useOC: false,
  OC: "#000000",
}];

export function ExportToFile({ videoData }: { videoData: any }) {
  const appStore = useAppState();
  const t = useTranslations();
  const [TLLang, setTLLang] = useState<any>(TL_LANGS[0]);
  const [entries, setEntries] = useState<any[]>([]);
  const [profile] = useState<any[]>(defaultProfile);
  const userdata = appStore.userdata;

  const reloadEntries = useCallback(() => {
    setEntries([]);
    if (!videoData) return;
    api.chatHistory(videoData.id, {
      custom_video_id: videoData.custom_video_id,
      lang: TLLang.value,
      verified: 0,
      moderator: 0,
      vtuber: 0,
      limit: 100000,
      mode: 1,
      creator_id: userdata.user?.id,
    }).then(({ status, data }: any) => {
      if (status === 200) {
        const fetchChat = videoData.start_actual
          ? data.filter((e: any) => (e.timestamp >= videoData.start_actual)).map((e: any) => {
            e.timestamp -= videoData.start_actual;
            return e;
          })
          : data.map((e: any) => {
            e.timestamp -= data?.[0]?.timestamp || 0;
            return e;
          });

        const nextEntries: any[] = [];
        for (let i = 0; i < fetchChat.length; i += 1) {
          const dt = {
            id: fetchChat[i].id,
            Time: fetchChat[i].timestamp,
            SText: fetchChat[i].message,
            Profile: 0,
          };

          if (fetchChat[i].duration) {
            nextEntries.push({
              ...dt,
              Duration: Number(fetchChat[i].duration),
            });
          } else if (i === fetchChat.length - 1) {
            nextEntries.push({
              ...dt,
              Duration: 3000,
            });
          } else {
            nextEntries.push({
              ...dt,
              Duration: fetchChat[i + 1].timestamp - fetchChat[i].timestamp,
            });
          }
        }
        setEntries(nextEntries);
      }
    }).catch((err: any) => {
      console.error(err);
    });
  }, [TLLang.value, userdata.user?.id, videoData]);

  useEffect(() => {
    reloadEntries();
  }, [reloadEntries]);

  function downloadFile(ext: string, content: string) {
    downloadTextFile(`${userdata.user?.username} - ${videoData.title}.${ext}`, content);
  }

  return (
    <div className="space-y-5 p-6">
	      <h2 className="text-center text-lg font-semibold">
        {t("views.tlManager.download")}
      </h2>
      <div className="space-y-2">
	        <Label htmlFor="tl-export-lang">{t("views.tlManager.langPick")}</Label>
        <Select
          value={TLLang.value}
          onValueChange={(value) => setTLLang(TL_LANGS.find((item) => item.value === value) || TL_LANGS[0])}
        >
          <SelectTrigger id="tl-export-lang" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
          {TL_LANGS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.text + " (" + item.value + ")"}
            </SelectItem>
          ))}
          </SelectContent>
        </Select>
      </div>
	      <p className="text-center text-sm text-muted-foreground">
        {t("editor.music.exportSummary", { entries: entries.length, profiles: profile.length })}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => downloadFile("srt", buildTlSrtExport(entries))}>
          .srt
        </Button>
        <Button type="button" onClick={() => downloadFile("ass", buildTlAssExport(entries, profile))}>
          .ass
        </Button>
        <Button type="button" onClick={() => downloadFile("ttml", buildTlTtmlExport(entries, profile))}>
          .ttml
        </Button>
      </div>
    </div>
  );
}
