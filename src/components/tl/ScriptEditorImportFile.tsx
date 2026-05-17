"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TlEntryRow } from "@/components/tl/ScriptEditorParts";
import { useTranslations } from "next-intl";
import { parseSrtCues, parseTlAssImport, parseTlTtmlImport } from "@/lib/tl-format";
function mapProfiles(profiles: any[]) {
  return profiles.map(({ Name, CC, OC }) => ({ Name, useCC: true, CC, useOC: true, OC }));
}
function mapEntries(entries: any[]) {
  return entries.map(({ text: SText, startTime: Time, duration: Duration, profileIndex: Profile }) => ({ SText, Time, Duration, Profile }));
}

export function ImportFile({ show, onOpenChange, onBounceDataBack }: { show: boolean; onOpenChange: (value: boolean) => void; onBounceDataBack: (payload: { entriesData: any[]; profileData: any[] }) => void }) {
  const t = useTranslations();
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
    <Dialog open={show} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[500px] max-w-[80%] p-0">
        <Card className="border-0 p-0 shadow-none">
          <CardContent className="space-y-4 p-4">
            <DialogHeader className="items-center text-center sm:text-center">
              <DialogTitle className="text-center text-xl leading-7 font-semibold text-[color:var(--color-foreground)]">
                {t("views.scriptEditor.menu.importFile")}
              </DialogTitle>
            </DialogHeader>
            <Label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/14 bg-white/4 px-4 py-3 text-sm leading-5 font-normal text-[color:var(--color-muted-foreground)] transition hover:border-sky-300/40 hover:bg-white/6">
              <FileText className="h-5 w-5 text-[color:var(--color-primary)]" />
              <span className="truncate">{selectedFileName || ".ass, .ttml, .srt"}</span>
              <Input ref={fileInput} accept=".ass,.TTML,.srt" type="file" className="hidden" onChange={handleFileInput} />
            </Label>
            <p className="text-sm text-[color:var(--color-muted-foreground)]">{notifText}</p>
            {entries.length > 0 ? (
              <div className="max-h-[40vh] overflow-auto rounded-xl border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>{t("views.watch.uploadPanel.headerStart")}</TableHead>
                      <TableHead>{t("views.watch.uploadPanel.headerEnd")}</TableHead>
                      <TableHead>{t("views.watch.uploadPanel.headerText")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{entries.map((entry, index) => <TlEntryRow key={index} time={entry.Time} duration={entry.Duration} stext={entry.SText} cc={profile[entry.Profile].useCC ? profile[entry.Profile].CC : ""} oc={profile[entry.Profile].useOC ? profile[entry.Profile].OC : ""} />)}</TableBody>
                </Table>
              </div>
            ) : null}
            <DialogFooter className="flex-row items-center justify-start gap-3 sm:justify-start">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("views.tlClient.cancelBtn")}
              </Button>
              <Button type="button" variant="destructive" className="ml-auto" disabled={!parsed} onClick={clickOk}>
                {t("views.scriptEditor.importFile.overwriteBtn")}
              </Button>
            </DialogFooter>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
