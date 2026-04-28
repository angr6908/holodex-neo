"use client";

import { useEffect, useRef, useState } from "react";
import { mdiFileDocument } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { TlEntryRow } from "@/components/tlscript/TlEntryRow";
import { useI18n } from "@/lib/i18n";
import { parseSrtCues, parseTlAssImport, parseTlTtmlImport } from "@/lib/tl-format";

function mapProfiles(profiles: any[]) {
  return profiles.map(({ Name, CC, OC }) => ({ Name, useCC: true, CC, useOC: true, OC }));
}
function mapEntries(entries: any[]) {
  return entries.map(({ text: SText, startTime: Time, duration: Duration, profileIndex: Profile }) => ({ SText, Time, Duration, Profile }));
}

export function ImportFile({ show, onOpenChange, onBounceDataBack }: { show: boolean; onOpenChange: (value: boolean) => void; onBounceDataBack: (payload: { entriesData: any[]; profileData: any[] }) => void }) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [profile, setProfile] = useState<any[]>([]);
  const [notifText, setNotifText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  useEffect(() => {
    if (!show) {
      if (fileInput.current) fileInput.current.value = "";
      setParsed(false);
      setNotifText("");
      setEntries([]);
      setProfile([]);
      setSelectedFileName("");
    }
  }, [show]);

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event?.target?.files?.[0];
    setSelectedFileName(file?.name || "");
    fileChange(file);
  }

  function fileChange(e: File | undefined) {
    setParsed(false);
    setEntries([]);
    setProfile([]);
    setNotifText("");
    if (!e) return;
    setNotifText(t("views.watch.uploadPanel.notifTextParsing"));
    const reader = new FileReader();
    reader.onload = (res) => {
      const text = res.target!.result as string;
      if ((/\.ass$/i).test(e.name)) parseAss(text);
      else if ((/\.srt$/i).test(e.name)) parseSrt(text);
      else if ((/\.ttml$/i).test(e.name)) parseTtml(text);
      else setNotifText(t("views.watch.uploadPanel.notifTextErrExt"));
    };
    if ((/\.(ass|srt|ttml)$/i).test(e.name)) reader.readAsText(e);
    else setNotifText(t("views.watch.uploadPanel.notifTextErrExt"));
  }

  function parseAss(dataFeed: string) {
    const parsed = parseTlAssImport(dataFeed);
    if (!parsed) { setNotifText(t("views.watch.uploadPanel.notifTextErr")); return; }
    const nextProfile = mapProfiles(parsed.profiles);
    const nextEntries = mapEntries(parsed.entries);
    setProfile(nextProfile);
    setEntries(nextEntries);
    setNotifText(`Parsed ASS file, ${nextProfile.length} profiles, ${nextEntries.length} Entries.`);
    setParsed(true);
  }

  function parseTtml(dataFeed: string) {
    const parsed = parseTlTtmlImport(dataFeed);
    if (!parsed) { setNotifText(t("views.watch.uploadPanel.notifTextErr")); return; }
    const nextProfile = mapProfiles(parsed.profiles);
    const nextEntries = mapEntries(parsed.entries);
    setProfile(nextProfile);
    setEntries(nextEntries);
    setNotifText(`Parsed TTML file, ${nextProfile.length} colour profiles, ${nextEntries.length} Entries.`);
    setParsed(true);
  }
  function parseSrt(dataFeed: string) {
    const nextProfile = [{ Name: "Profile1", Prefix: "", Suffix: "", useCC: false, CC: "#000000", useOC: false, OC: "#000000" }];
    const nextEntries = parseSrtCues(dataFeed).map(({ text: SText, startTime: Time, duration: Duration }) => ({ SText, Time, Duration, Profile: 0 }));
    setProfile(nextProfile);
    setEntries(nextEntries);
    setNotifText(`Parsed SRT file, ${nextEntries.length} Entries.`);
    setParsed(true);
  }
  function clickOk() {
    onBounceDataBack({ entriesData: entries, profileData: profile });
    onOpenChange(false);
  }

  return (
    <Dialog open={show} className="max-h-[500px] max-w-[80%]" onOpenChange={onOpenChange}>
      <Card className="border-0 p-0 shadow-none">
        <div className="space-y-4 p-4">
          <h2 className="text-center text-xl font-semibold text-[color:var(--color-foreground)]">{t("views.scriptEditor.menu.importFile")}</h2>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/14 bg-white/4 px-4 py-3 text-sm text-[color:var(--color-muted-foreground)] transition hover:border-sky-300/40 hover:bg-white/6">
            <Icon icon={mdiFileDocument} className="h-5 w-5 text-[color:var(--color-primary)]" />
            <span className="truncate">{selectedFileName || ".ass, .ttml, .srt"}</span>
            <input ref={fileInput} accept=".ass,.TTML,.srt" type="file" className="hidden" onChange={handleFileInput} />
          </label>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">{notifText}</p>
          {entries.length > 0 ? (
            <div className="max-h-[40vh] overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-950/90 text-left text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]"><tr><th className="px-3 py-2">{t("views.watch.uploadPanel.headerStart")}</th><th className="px-3 py-2">{t("views.watch.uploadPanel.headerEnd")}</th><th className="px-3 py-2">{t("views.watch.uploadPanel.headerText")}</th></tr></thead>
                <tbody>{entries.map((entry, index) => <TlEntryRow key={index} time={entry.Time} duration={entry.Duration} stext={entry.SText} cc={profile[entry.Profile].useCC ? profile[entry.Profile].CC : ""} oc={profile[entry.Profile].useOC ? profile[entry.Profile].OC : ""} />)}</tbody>
              </table>
            </div>
          ) : null}
          <div className="flex items-center gap-3"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("views.tlClient.cancelBtn")}</Button><Button type="button" variant="destructive" className="ml-auto" disabled={!parsed} onClick={clickOk}>{t("views.scriptEditor.importFile.overwriteBtn")}</Button></div>
        </div>
      </Card>
    </Dialog>
  );
}
