"use client";

import { useCallback, useEffect, useState } from "react";
import { TlExportButtons } from "@/components/tlscript/TlExportButtons";
import { api } from "@/lib/api";
import { TL_LANGS } from "@/lib/consts";
import { useI18n } from "@/lib/i18n";
import { useAppState } from "@/lib/store";
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
  const { t } = useI18n();
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
      <h2 className="text-center text-lg font-semibold text-white">
        {t("views.tlManager.download")}
      </h2>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-300">{t("views.tlManager.langPick")}</span>
        <select
          value={TLLang.value}
          className="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
          onChange={(event) => setTLLang(TL_LANGS.find((item) => item.value === event.target.value) || TL_LANGS[0])}
        >
          {TL_LANGS.map((item) => (
            <option key={item.value} value={item.value} className="bg-slate-950">
              {item.text + " (" + item.value + ")"}
            </option>
          ))}
        </select>
      </label>
      <p className="text-center text-sm text-slate-400">
        {entries.length + " entries, " + profile.length + " profile."}
      </p>
      <TlExportButtons onExportSrt={() => downloadFile("srt", buildTlSrtExport(entries))} onExportAss={() => downloadFile("ass", buildTlAssExport(entries, profile))} onExportTtml={() => downloadFile("ttml", buildTlTtmlExport(entries, profile))} />
    </div>
  );
}
