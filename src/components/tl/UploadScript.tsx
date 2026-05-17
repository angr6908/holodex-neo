"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TlEntryRow } from "@/components/tl/ScriptEditorParts";
import { api } from "@/lib/api";
import { TL_LANGS } from "@/lib/consts";
import { useTranslations } from "next-intl";
import { openUserMenu } from "@/lib/browser";
import { useAppState } from "@/lib/store";
import { isSrtTimestampRange, parseSrtCues, parseTlAssImport, parseTlTtmlImport } from "@/lib/tl-format";
export function UploadScript({ videoData, onClose }: { videoData: any; onClose?: (payload: { upload: boolean }) => void }) {
  const t = useTranslations();
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
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 align-baseline text-sm font-normal text-slate-400 underline underline-offset-4 hover:text-sky-300"
            onClick={openUserMenu}
          >
            {t("views.watch.uploadPanel.usernameChange")}
          </Button>
        </p>
      </div>

      <Field className="gap-2">
        <FieldLabel className="text-slate-300">{t("views.watch.uploadPanel.subtitleFile")}</FieldLabel>
        <div className="flex items-center gap-3 rounded-[calc(var(--radius)+6px)] border border-white/10 bg-white/4 px-4 py-3">
          <FileText className="size-4 text-slate-400" />
          <Input
            ref={fileInput}
            accept=".ass,.TTML,.srt,.ttml"
            type="file"
            className="h-auto border-0 bg-transparent p-0 text-sm text-slate-300 shadow-none file:mr-4 file:h-auto file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15 focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
            onChange={handleFileInput}
          />
        </div>
      </Field>

      <p className="text-sm text-slate-400">
        {notifText}
      </p>

      <Field className="gap-2">
        <FieldLabel className="text-slate-300">{t("views.tlManager.langPick")}</FieldLabel>
        <Select
          value={TLLang.value}
          onValueChange={(value) => setTLLang(TL_LANGS.find((item) => item.value === value) || TL_LANGS[0])}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
          {TL_LANGS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.text + " (" + item.value + ")"}
            </SelectItem>
          ))}
          </SelectContent>
        </Select>
      </Field>

      {entries.length > 0 ? (
        <div className="max-h-[40vh] overflow-auto rounded-[calc(var(--radius)+6px)] border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t("views.watch.uploadPanel.headerStart")}</TableHead>
                <TableHead>{t("views.watch.uploadPanel.headerEnd")}</TableHead>
                <TableHead>{t("views.watch.uploadPanel.headerText")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
            </TableBody>
          </Table>
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
