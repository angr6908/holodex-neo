"use client";

import { useEffect, useRef, useState } from "react";
import { mdiFileDocument } from "@mdi/js";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Entrytr } from "@/components/tlscriptmanager/Entrytr";

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

  function assTime(raw: string) {
    const timeSplit = raw.trim().split(":");
    let msShift = (timeSplit[2] || "0.0").split(".")[1] || "0";
    if (msShift.length === 2) msShift += "0";
    else if (msShift.length === 1) msShift += "00";
    return Number.parseInt(timeSplit[0], 10) * 60 * 60 * 1000 + Number.parseInt(timeSplit[1], 10) * 60 * 1000 + Number.parseInt(timeSplit[2].split(".")[0], 10) * 1000 + Number.parseInt(msShift, 10);
  }

  function parseAss(dataFeed: string) {
    const res = dataFeed.split("\n");
    let fail = true;
    let lineSplit: string[] = [];
    let locationIndex: number[] = [];
    let dataLength = 0;
    const nextProfile: any[] = [];
    const nextEntries: any[] = [];

    for (let index = 0; index < res.length; index += 1) {
      if (res[index].search(/\[V4\+ Styles\]/gi) !== -1) {
        index += 1;
        if (res[index]?.search(/^Format/gi) !== -1) {
          lineSplit = res[index].split(":")[1].split(",").map((e) => e.trim());
          locationIndex = [];
          dataLength = lineSplit.length;
          if (lineSplit.indexOf("Name") !== -1) locationIndex.push(lineSplit.indexOf("Name"));
          if (lineSplit.indexOf("PrimaryColour") !== -1) locationIndex.push(lineSplit.indexOf("PrimaryColour"));
          if (lineSplit.indexOf("OutlineColour") !== -1) locationIndex.push(lineSplit.indexOf("OutlineColour"));
          if (locationIndex.length === 3) {
            fail = false;
            for (index += 1; index < res.length; index += 1) {
              if (res[index].search(/^Style/gi) !== -1) {
                lineSplit = res[index].split(":")[1].split(",").map((e) => e.trim());
                if (lineSplit.length === dataLength && lineSplit[locationIndex[1]].length === 10 && lineSplit[locationIndex[2]].length === 10) {
                  nextProfile.push({
                    Name: lineSplit[locationIndex[0]].trim(),
                    useCC: true,
                    CC: lineSplit[locationIndex[1]].trim().slice(8, 10) + lineSplit[locationIndex[1]].trim().slice(6, 8) + lineSplit[locationIndex[1]].trim().slice(4, 6),
                    useOC: true,
                    OC: lineSplit[locationIndex[2]].trim().slice(8, 10) + lineSplit[locationIndex[2]].trim().slice(6, 8) + lineSplit[locationIndex[2]].trim().slice(4, 6),
                  });
                } else { fail = true; index = res.length; }
              } else index = res.length;
            }
          } else index = res.length;
        } else index = res.length;
      }
    }
    if (fail) { setNotifText(t("views.watch.uploadPanel.notifTextErr")); return; }
    fail = true;

    for (let index = 0; index < res.length; index += 1) {
      if (res[index].search(/\[Events\]/gi) !== -1) {
        index += 1;
        if (res[index]?.search(/^Format/gi) !== -1) {
          lineSplit = res[index].split(":")[1].split(",").map((e) => e.trim());
          locationIndex = [];
          dataLength = lineSplit.length;
          if (lineSplit.indexOf("Start") !== -1) locationIndex.push(lineSplit.indexOf("Start"));
          if (lineSplit.indexOf("End") !== -1) locationIndex.push(lineSplit.indexOf("End"));
          if (lineSplit.indexOf("Style") !== -1) locationIndex.push(lineSplit.indexOf("Style"));
          if (lineSplit.indexOf("Text") !== -1) locationIndex.push(lineSplit.indexOf("Text"));
          if (locationIndex.length === 4) {
            fail = false;
            for (index += 1; index < res.length; index += 1) {
              if (res[index].search(/^Dialogue/gi) !== -1) {
                lineSplit = res[index].split("Dialogue:")[1].split(",");
                if (lineSplit.length >= dataLength) {
                  const profileIndex = nextProfile.findIndex((p) => p.Name === lineSplit[locationIndex[2]]);
                  if (profileIndex >= 0) {
                    let textSend = lineSplit[locationIndex[3]];
                    for (let z = locationIndex[3] + 1; z < lineSplit.length; z += 1) textSend += `,${lineSplit[z]}`;
                    const startTime = assTime(lineSplit[locationIndex[0]].trim());
                    const endTime = assTime(lineSplit[locationIndex[1]].trim());
                    nextEntries.push({ SText: textSend, Time: startTime, Duration: endTime - startTime, Profile: profileIndex });
                  }
                } else index = res.length;
              } else index = res.length;
            }
          } else index = res.length;
        } else index = res.length;
      }
    }
    if (fail) setNotifText(t("views.watch.uploadPanel.notifTextErr"));
    else {
      setProfile(nextProfile);
      setEntries(nextEntries);
      setNotifText(`Parsed ASS file, ${nextProfile.length} profiles, ${nextEntries.length} Entries.`);
      setParsed(true);
    }
  }

  function parseTtml(dataFeed: string) {
    let fail = true;
    const nextProfile: any[] = [];
    const nextEntries: any[] = [];
    if ((dataFeed.indexOf("<head>") !== -1) && (dataFeed.indexOf("</head>") !== -1)) {
      const startIndex = dataFeed.indexOf("<head>");
      const endIndex = dataFeed.indexOf("</head>");
      fail = false;
      for (let penStart = dataFeed.indexOf("<pen", startIndex); penStart < endIndex; penStart = dataFeed.indexOf("<pen", penStart)) {
        if (penStart === -1) break;
        const penEnd = dataFeed.indexOf(">", penStart);
        if ((penEnd > endIndex) || (penEnd === -1)) { fail = true; break; }
        const idTarget = dataFeed.indexOf("id=\"", penStart);
        if ((idTarget > penEnd) || (idTarget === -1)) { fail = true; break; }
        const idEnd = dataFeed.indexOf("\"", idTarget + 4);
        const tempProfileContainer: any = { Name: dataFeed.substring(idTarget + 4, idEnd), useCC: true, CC: "", useOC: true, OC: "" };
        const fcTarget = dataFeed.indexOf("fc=\"", penStart);
        if (fcTarget !== -1 && fcTarget < penEnd) tempProfileContainer.CC = dataFeed.substring(fcTarget + 5, dataFeed.indexOf("\"", fcTarget + 5));
        const ecTarget = dataFeed.indexOf("ec=\"", penStart);
        if (ecTarget !== -1 && ecTarget < penEnd) tempProfileContainer.OC = dataFeed.substring(ecTarget + 5, dataFeed.indexOf("\"", ecTarget + 5));
        nextProfile.push(tempProfileContainer);
        penStart = penEnd;
      }
    }
    if (fail) { setNotifText(t("views.watch.uploadPanel.notifTextErr")); return; }
    fail = true;
    const bodyStart = dataFeed.indexOf("<body>");
    const bodyEnd = dataFeed.indexOf("</body>");
    if (bodyStart !== -1 && bodyEnd !== -1) {
      fail = false;
      const entryContainer = { SText: "", Time: 0, Duration: 0, Profile: 0 };
      for (let pStart = dataFeed.indexOf("<p", bodyStart); pStart < bodyEnd; pStart = dataFeed.indexOf("<p", pStart)) {
        if (pStart === -1) break;
        const pEnd = dataFeed.indexOf("</p>", pStart);
        if ((pEnd > bodyEnd) || (pEnd === -1)) { fail = true; break; }
        const tagEnd = dataFeed.indexOf(">", pStart);
        const tTarget = dataFeed.indexOf("t=\"", pStart);
        const dTarget = dataFeed.indexOf("d=\"", pStart);
        if (tTarget === -1 || dTarget === -1 || tTarget > tagEnd || dTarget > tagEnd) { fail = true; break; }
        const Time = Number.parseInt(dataFeed.substring(tTarget + 3, dataFeed.indexOf("\"", tTarget + 3)), 10);
        const endOrDuration = Number.parseInt(dataFeed.substring(dTarget + 3, dataFeed.indexOf("\"", dTarget + 3)), 10);
        if (Number.isNaN(Time) || Number.isNaN(endOrDuration)) { fail = true; break; }
        if (entryContainer.Time !== Time) {
          entryContainer.Time = Time;
          entryContainer.Duration = endOrDuration - entryContainer.Time;
          for (let sStart = dataFeed.indexOf("<s", tagEnd); sStart < pEnd; sStart = dataFeed.indexOf("<s", sStart)) {
            if (sStart === -1) break;
            const sTagEnd = dataFeed.indexOf(">", sStart);
            const spanEnd = dataFeed.indexOf("</s>", sTagEnd);
            if ((sTagEnd === -1) || (sTagEnd > pEnd) || (spanEnd === -1) || (spanEnd > pEnd)) { fail = true; break; }
            const body = dataFeed.substring(sTagEnd + 1, spanEnd).trim();
            if (body.length > 1) {
              entryContainer.SText = body;
              const pTarget = dataFeed.indexOf("p=\"", sStart);
              const profileIndex = nextProfile.findIndex((p) => p.Name === dataFeed.substring(pTarget + 3, dataFeed.indexOf("\"", pTarget + 3)));
              if (profileIndex >= 0) {
                entryContainer.Profile = profileIndex;
                nextEntries.push({ SText: entryContainer.SText, Time: entryContainer.Time, Duration: entryContainer.Duration, Profile: entryContainer.Profile });
              }
              break;
            }
            sStart = sTagEnd;
          }
          if (fail) break;
        }
        pStart = pEnd;
      }
    }
    if (fail) setNotifText(t("views.watch.uploadPanel.notifTextErr"));
    else {
      setProfile(nextProfile);
      setEntries(nextEntries);
      setNotifText(`Parsed TTML file, ${nextProfile.length} colour profiles, ${nextEntries.length} Entries.`);
      setParsed(true);
    }
  }

  function checkTimeString(testString: string) {
    let timeSplit = testString.split(":");
    if (timeSplit.length !== 3) return false;
    if (Number.isNaN(Number.parseInt(timeSplit[0], 10))) return false;
    if (Number.isNaN(Number.parseInt(timeSplit[1], 10)) || Number.parseInt(timeSplit[1], 10) > 60) return false;
    timeSplit = timeSplit[2].split(",");
    if (timeSplit.length !== 2) return false;
    if (Number.isNaN(Number.parseInt(timeSplit[0], 10)) || Number.parseInt(timeSplit[0], 10) > 60) return false;
    if (Number.isNaN(Number.parseInt(timeSplit[1], 10)) || Number.parseInt(timeSplit[1], 10) > 1000) return false;
    return true;
  }
  function srtTimeCheck(timeString: string) {
    return timeString.split("-->").length === 2 && checkTimeString(timeString.split("-->")[0].trim()) && checkTimeString(timeString.split("-->")[1].trim());
  }
  function parseTimeString(targetString: string) {
    let res = 0;
    let timeSplit = targetString.split(":");
    res = res + Number.parseInt(timeSplit[0], 10) * 3600000 + Number.parseInt(timeSplit[1], 10) * 60000;
    timeSplit = timeSplit[2].split(",");
    res += Number.parseInt(timeSplit[0], 10) * 1000 + Number.parseInt(timeSplit[1], 10);
    return res;
  }
  function parseSrt(dataFeed: string) {
    const res = dataFeed.split("\n");
    let write = false;
    const nextProfile = [{ Name: "Profile1", Prefix: "", Suffix: "", useCC: false, CC: "#000000", useOC: false, OC: "#000000" }];
    const nextEntries: any[] = [];
    for (let index = 0; index < res.length; index += 1) {
      if (srtTimeCheck(res[index])) {
        const startTime = parseTimeString(res[index].split("-->")[0].trim());
        const endTime = parseTimeString(res[index].split("-->")[1].trim());
        let text = "";
        write = true;
        for (index += 1; index < res.length; index += 1) {
          if (srtTimeCheck(res[index])) { index -= 1; write = false; nextEntries.push({ SText: text, Time: startTime, Duration: endTime - startTime, Profile: 0 }); break; }
          else if (res[index] === "") { write = false; nextEntries.push({ SText: text, Time: startTime, Duration: endTime - startTime, Profile: 0 }); break; }
          else if (index === res.length - 1) { if (res[index].trim() !== "") text += res[index]; write = false; nextEntries.push({ SText: text, Time: startTime, Duration: endTime - startTime, Profile: 0 }); break; }
          else if (res[index].trim() !== "") { if (write) { if (text !== "") text = `${text} `; text += res[index]; } }
          else write = false;
        }
      }
    }
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
                <tbody>{entries.map((entry, index) => <Entrytr key={index} time={entry.Time} duration={entry.Duration} stext={entry.SText} cc={profile[entry.Profile].useCC ? profile[entry.Profile].CC : ""} oc={profile[entry.Profile].useOC ? profile[entry.Profile].OC : ""} />)}</tbody>
              </table>
            </div>
          ) : null}
          <div className="flex items-center gap-3"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("views.tlClient.cancelBtn")}</Button><Button type="button" variant="destructive" className="ml-auto" disabled={!parsed} onClick={clickOk}>{t("views.scriptEditor.importFile.overwriteBtn")}</Button></div>
        </div>
      </Card>
    </Dialog>
  );
}
