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

export function UploadScript({ videoData, onClose }: { videoData: any; onClose?: (p: { upload: boolean }) => void }) {
  const t = useTranslations();
  const app = useAppState();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [notif, setNotif] = useState("");
  const [TLLang, setTLLang] = useState<any>(TL_LANGS[0]);
  const user = app.userdata;

  const startTime = useMemo(() => {
    if (!videoData?.start_actual) return Date.parse(videoData?.available_at);
    if (Number.isNaN(Number(videoData.start_actual))) return Date.parse(videoData.start_actual);
    return videoData.start_actual;
  }, [videoData]);

  useEffect(() => {
    if (fileInput.current) fileInput.current.value = "";
    setParsed(false); setNotif(""); setEntries([]);
  }, [videoData]);

  const toEntries = (arr: any[], textKey: string) => arr.map((e: any) => ({
    message: e[textKey], timestamp: e.startTime, duration: e.duration,
  }));

  function fileChange(f: File | undefined) {
    setParsed(false); setEntries([]); setNotif("");
    if (!f) return;
    setNotif(t("views.watch.uploadPanel.notifTextParsing"));
    const reader = new FileReader();
    const ext = f.name.toLowerCase();
    const handle = (process: (data: string) => void) => { reader.onload = (res) => process((res.target as FileReader).result as string); reader.readAsText(f); };

    if (/\.ass$/.test(ext)) handle((data) => {
      const r = parseTlAssImport(data, { trimDialogueStyle: true, requireTimestampFraction: true });
      if (!r) return setNotif(t("views.watch.uploadPanel.notifTextErr"));
      const next = toEntries(r.entries, "text");
      setEntries(next);
      setNotif(`Parsed ASS file, ${r.profiles.length} profiles, ${next.length} Entries.`);
      setParsed(true);
    });
    else if (/\.srt$/.test(ext)) handle((data) => {
      const lines = data.split("\n");
      if (isSrtTimestampRange(lines[lines.length - 1])) return;
      const next = parseSrtCues(data).map((c) => ({ message: c.text, timestamp: c.startTime, duration: c.duration }));
      setEntries(next);
      setNotif(`Parsed SRT file, ${next.length} Entries.`);
      setParsed(true);
    });
    else if (/\.ttml$/.test(ext)) handle((data) => {
      const r = parseTlTtmlImport(data, { continueAfterUnknownProfile: true });
      if (!r) return setNotif(t("views.watch.uploadPanel.notifTextErr"));
      const next = toEntries(r.entries, "text");
      setEntries(next);
      setNotif(`Parsed TTML file, ${r.profiles.length} colour profiles, ${next.length} Entries.`);
      setParsed(true);
    });
    else setNotif(t("views.watch.uploadPanel.notifTextErrExt"));
  }

  async function sendData() {
    const existing = await api.chatHistory(videoData.id, {
      lang: TLLang.value, verified: 0, moderator: 0, vtuber: 0, limit: 100000, mode: 1, creator_id: user.user.id,
    });
    const processes: any[] = existing.data.map((e: any) => ({ type: "Delete", data: { id: e.id } }));
    entries.forEach((e, i) => processes.push({
      type: "Add",
      data: { tempid: `I${i}`, name: user.user.username, timestamp: Math.floor(startTime + e.timestamp), message: e.message, duration: Math.floor(e.duration) },
    }));
    api.postTLLog({ videoId: videoData.id, jwt: user.jwt!, body: processes, lang: TLLang.value })
      .then(({ status }: any) => { if (status === 200) onClose?.({ upload: true }); })
      .catch((err) => console.error("Upload error:", err));
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("views.watch.uploadPanel.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("views.watch.uploadPanel.usernameText") + " : " + user.user?.username + " "}
          <Button type="button" variant="link" className="h-auto p-0 align-baseline text-sm font-normal" onClick={openUserMenu}>
            {t("views.watch.uploadPanel.usernameChange")}
          </Button>
        </p>
      </div>
      <Field className="gap-2">
        <FieldLabel>{t("views.watch.uploadPanel.subtitleFile")}</FieldLabel>
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <FileText className="size-4 text-muted-foreground" />
          <Input ref={fileInput} accept=".ass,.TTML,.srt,.ttml" type="file"
            className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0"
            onChange={(e) => fileChange(e?.target?.files?.[0])} />
        </div>
      </Field>
      <p className="text-sm text-muted-foreground">{notif}</p>
      <Field className="gap-2">
        <FieldLabel>{t("views.tlManager.langPick")}</FieldLabel>
        <Select value={TLLang.value} onValueChange={(v) => setTLLang(TL_LANGS.find((i) => i.value === v) || TL_LANGS[0])}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TL_LANGS.map((i) => <SelectItem key={i.value} value={i.value}>{i.text + " (" + i.value + ")"}</SelectItem>)}
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
              {entries.map((e, i) => <TlEntryRow key={i} time={e.timestamp} duration={e.duration} stext={e.message} cc={e.cc || ""} oc={e.oc || ""} />)}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => onClose?.({ upload: false })}>{t("views.watch.uploadPanel.cancelBtn")}</Button>
        <Button variant="destructive" className="ml-auto" disabled={!parsed} onClick={sendData}>{t("views.scriptEditor.importFile.overwriteBtn")}</Button>
      </div>
    </div>
  );
}
