"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { TlEntryRow } from "@/components/tl/ScriptEditorParts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText } from "@/lib/icons";
import { parseSrtCues, parseTlAssImport, parseTlTtmlImport } from "@/lib/tl-format";

function mapProfiles(profiles: any[]) {
  return profiles.map(({ Name, CC, OC }) => ({ Name, useCC: true, CC, useOC: true, OC }));
}
// Imported entries are identified by their position in the file.
function mapEntries(entries: any[]) {
  return entries.map(
    ({ text: SText, startTime: Time, duration: Duration, profileIndex: Profile }, i) => ({
      id: `I${i}`,
      SText,
      Time,
      Duration,
      Profile,
    }),
  );
}

type ImportPayload = { entriesData: any[]; profileData: any[] };

export function ImportFile({
  show,
  onOpenChange,
  onBounceDataBack,
}: {
  show: boolean;
  onOpenChange: (value: boolean) => void;
  onBounceDataBack: (payload: ImportPayload) => void;
}) {
  return (
    <Dialog open={show} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[500px] max-w-[80%]">
        <ImportFileForm
          onCancel={() => onOpenChange(false)}
          onImport={(payload) => {
            onBounceDataBack(payload);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// Rendered inside the dialog content, which unmounts when the dialog closes, so every opening
// starts with an empty form.
function ImportFileForm({
  onCancel,
  onImport,
}: {
  onCancel: () => void;
  onImport: (payload: ImportPayload) => void;
}) {
  const t = useTranslations();
  const [parsed, setParsed] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [profile, setProfile] = useState<any[]>([]);
  const [notifText, setNotifText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

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
      if (/\.ass$/i.test(e.name)) parseAss(text);
      else if (/\.srt$/i.test(e.name)) parseSrt(text);
      else if (/\.ttml$/i.test(e.name)) parseTtml(text);
      else setNotifText(t("views.watch.uploadPanel.notifTextErrExt"));
    };
    if (/\.(ass|srt|ttml)$/i.test(e.name)) reader.readAsText(e);
    else setNotifText(t("views.watch.uploadPanel.notifTextErrExt"));
  }

  function parseAss(dataFeed: string) {
    const parsed = parseTlAssImport(dataFeed);
    if (!parsed) {
      setNotifText(t("views.watch.uploadPanel.notifTextErr"));
      return;
    }
    const nextProfile = mapProfiles(parsed.profiles);
    const nextEntries = mapEntries(parsed.entries);
    setProfile(nextProfile);
    setEntries(nextEntries);
    setNotifText(`Parsed ASS file, ${nextProfile.length} profiles, ${nextEntries.length} Entries.`);
    setParsed(true);
  }

  function parseTtml(dataFeed: string) {
    const parsed = parseTlTtmlImport(dataFeed);
    if (!parsed) {
      setNotifText(t("views.watch.uploadPanel.notifTextErr"));
      return;
    }
    const nextProfile = mapProfiles(parsed.profiles);
    const nextEntries = mapEntries(parsed.entries);
    setProfile(nextProfile);
    setEntries(nextEntries);
    setNotifText(
      `Parsed TTML file, ${nextProfile.length} colour profiles, ${nextEntries.length} Entries.`,
    );
    setParsed(true);
  }
  function parseSrt(dataFeed: string) {
    const nextProfile = [
      {
        Name: "Profile1",
        Prefix: "",
        Suffix: "",
        useCC: false,
        CC: "#000000",
        useOC: false,
        OC: "#000000",
      },
    ];
    const nextEntries = parseSrtCues(dataFeed).map(
      ({ text: SText, startTime: Time, duration: Duration }, i) => ({
        id: `I${i}`,
        SText,
        Time,
        Duration,
        Profile: 0,
      }),
    );
    setProfile(nextProfile);
    setEntries(nextEntries);
    setNotifText(`Parsed SRT file, ${nextEntries.length} Entries.`);
    setParsed(true);
  }
  function clickOk() {
    onImport({ entriesData: entries, profileData: profile });
  }

  return (
    <div className="space-y-4">
      <DialogHeader className="items-center text-center sm:text-center">
        <DialogTitle>{t("views.scriptEditor.menu.importFile")}</DialogTitle>
      </DialogHeader>
      <Label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm leading-5 font-normal text-muted-foreground">
        <FileText className="h-5 w-5" />
        <span className="truncate">{selectedFileName || ".ass, .ttml, .srt"}</span>
        <Input accept=".ass,.TTML,.srt" type="file" className="hidden" onChange={handleFileInput} />
      </Label>
      <p className="text-sm text-muted-foreground">{notifText}</p>
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
            <TableBody>
              {entries.map((entry) => (
                <TlEntryRow
                  key={entry.id}
                  time={entry.Time}
                  duration={entry.Duration}
                  stext={entry.SText}
                  cc={profile[entry.Profile].useCC ? profile[entry.Profile].CC : ""}
                  oc={profile[entry.Profile].useOC ? profile[entry.Profile].OC : ""}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <DialogFooter className="flex-row items-center justify-start gap-3 sm:justify-start">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("views.tlClient.cancelBtn")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="ml-auto"
          disabled={!parsed}
          onClick={clickOk}
        >
          {t("views.scriptEditor.importFile.overwriteBtn")}
        </Button>
      </DialogFooter>
    </div>
  );
}
