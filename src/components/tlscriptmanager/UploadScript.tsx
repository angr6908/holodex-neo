"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mdiFileDocument } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TlEntryRow } from "@/components/tlscript/TlEntryRow";
import { api } from "@/lib/api";
import { TL_LANGS } from "@/lib/consts";
import { useI18n } from "@/lib/i18n";
import { openUserMenu } from "@/lib/navigation-events";
import { useAppState } from "@/lib/store";
import { isSrtTimestampRange, parseSrtCues, parseTlAssImport, parseTlTtmlImport } from "@/lib/tl-format";

export function UploadScript({ videoData, onClose }: { videoData: any; onClose?: (payload: { upload: boolean }) => void }) {
  const { t } = useI18n();
  const appStore = useAppState();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [notifText, setNotifText] = useState("");
  const [TLLang, setTLLang] = useState<any>(TL_LANGS[0]);
  const userdata = appStore.userdata;

  const startTime = useMemo(() => {
    if (!videoData?.start_actual) {
      return Date.parse(videoData?.available_at);
    }
    if (Number.isNaN(Number(videoData.start_actual))) {
      return Date.parse(videoData.start_actual);
    }
    return videoData.start_actual;
  }, [videoData]);

  useEffect(() => {
    if (fileInput.current) {
      fileInput.current.value = "";
    }
    setParsed(false);
    setNotifText("");
    setEntries([]);
  }, [videoData]);

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    fileChange(event?.target?.files?.[0]);
  }

  function fileChange(e: File | undefined) {
    setParsed(false);
    setEntries([]);
    setNotifText("");
    if (!e) {
      return;
    }
    setNotifText(t("views.watch.uploadPanel.notifTextParsing"));
    const reader = new FileReader();

    if ((/\.ass$/i).test(e.name)) {
      reader.onload = (res) => {
        parseAss((res.target as FileReader).result as string);
      };
      reader.readAsText(e);
    } else if ((/\.srt$/i).test(e.name)) {
      reader.onload = (res) => {
        parseSrt((res.target as FileReader).result as string);
      };
      reader.readAsText(e);
    } else if ((/\.ttml$/i).test(e.name)) {
      reader.onload = (res) => {
        parseTtml((res.target as FileReader).result as string);
      };
      reader.readAsText(e);
    } else {
      setNotifText(t("views.watch.uploadPanel.notifTextErrExt"));
    }
  }

  function parseAss(dataFeed: string) {
    const parsedAss = parseTlAssImport(dataFeed, { trimDialogueStyle: true, requireTimestampFraction: true });
    if (!parsedAss) {
      setNotifText(t("views.watch.uploadPanel.notifTextErr"));
      return;
    }

    const nextEntries = parsedAss.entries.map((entry) => ({
      message: entry.text,
      timestamp: entry.startTime,
      duration: entry.duration,
    }));

    setEntries(nextEntries);
    setNotifText(`Parsed ASS file, ${parsedAss.profiles.length} profiles, ${nextEntries.length} Entries.`);
    setParsed(true);
  }

  function parseTtml(dataFeed: string) {
    const parsedTtml = parseTlTtmlImport(dataFeed, { continueAfterUnknownProfile: true });
    if (!parsedTtml) {
      setNotifText(t("views.watch.uploadPanel.notifTextErr"));
      return;
    }

    const nextEntries = parsedTtml.entries.map((entry) => ({
      message: entry.text,
      timestamp: entry.startTime,
      duration: entry.duration,
    }));

    setEntries(nextEntries);
    setNotifText(`Parsed TTML file, ${parsedTtml.profiles.length} colour profiles, ${nextEntries.length} Entries.`);
    setParsed(true);
  }

  function parseSrt(dataFeed: string) {
    const res = dataFeed.split("\n");
    if (isSrtTimestampRange(res[res.length - 1])) {
      return;
    }

    const nextEntries = parseSrtCues(dataFeed).map((cue) => ({
      message: cue.text,
      timestamp: cue.startTime,
      duration: cue.duration,
    }));

    setEntries(nextEntries);
    setNotifText(`Parsed SRT file, ${nextEntries.length} Entries.`);
    setParsed(true);
  }

  async function sendData() {
    const processes = await (await api.chatHistory(videoData.id, {
      lang: TLLang.value,
      verified: 0,
      moderator: 0,
      vtuber: 0,
      limit: 100000,
      mode: 1,
      creator_id: userdata.user.id,
    })).data.map((e: any) => ({
      type: "Delete",
      data: {
        id: e.id,
      },
    }));

    for (let idx = 0; idx < entries.length; idx += 1) {
      processes.push({
        type: "Add",
        data: {
          tempid: `I${idx}`,
          name: userdata.user.username,
          timestamp: Math.floor(startTime + entries[idx].timestamp),
          message: entries[idx].message,
          duration: Math.floor(entries[idx].duration),
        },
      });
    }

    api.postTLLog({
      videoId: videoData.id,
      jwt: userdata.jwt!,
      body: processes,
      lang: TLLang.value,
    }).then(({ status }: any) => {
      if (status === 200) {
        onClose?.({ upload: true });
      }
    }).catch((err: any) => {
      console.error("Upload error:", err);
    });
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {t("views.watch.uploadPanel.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {t("views.watch.uploadPanel.usernameText") + " : " + userdata.user?.username + " "}
          <a className="underline underline-offset-4 hover:text-sky-300" onClick={openUserMenu}>{t("views.watch.uploadPanel.usernameChange")}</a>
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Subtitle file</label>
        <div className="flex items-center gap-3 rounded-[calc(var(--radius)+6px)] border border-white/10 bg-white/4 px-4 py-3">
          <Icon icon={mdiFileDocument} size="sm" className="text-slate-400" />
          <input
            ref={fileInput}
            accept=".ass,.TTML,.srt,.ttml"
            type="file"
            className="w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
            onChange={handleFileInput}
          />
        </div>
      </div>

      <p className="text-sm text-slate-400">
        {notifText}
      </p>

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

      {entries.length > 0 ? (
        <div className="overflow-hidden rounded-[calc(var(--radius)+6px)] border border-white/10">
          <div className="max-h-[40vh] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
                <tr className="border-b border-white/10 text-left text-slate-300">
                  <th className="px-4 py-3 font-medium">
                    {t("views.watch.uploadPanel.headerStart")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("views.watch.uploadPanel.headerEnd")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("views.watch.uploadPanel.headerText")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <TlEntryRow
                    key={index}
                    time={entry.timestamp}
                    duration={entry.duration}
                    stext={entry.message}
                    cc={entry.cc || ""}
                    oc={entry.oc || ""}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => onClose?.({ upload: false })}>
          {t("views.watch.uploadPanel.cancelBtn")}
        </Button>

        <Button
          variant="destructive"
          className="ml-auto"
          disabled={!parsed}
          onClick={sendData}
        >
          {t("views.scriptEditor.importFile.overwriteBtn")}
        </Button>
      </div>
    </div>
  );
}
