import type { CSSProperties } from "react";

export function getTlTextStyle(cc = "", oc = "", strokeWidth = "1px"): CSSProperties {
  return {
    WebkitTextFillColor: cc === "" ? "unset" : cc,
    WebkitTextStrokeColor: oc === "" ? "unset" : oc,
    WebkitTextStrokeWidth: oc === "" ? "0px" : strokeWidth,
  };
}

export function downloadTextFile(filename: string, contents: string): void {
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([contents], { type: "text/plain" })), download: filename });
  link.click();
  link.remove();
}

export function formatTlTimestamp(raw: number): string {
  let ms = Math.max(0, Math.floor(raw || 0));
  const hh = Math.floor(ms / 3600000); ms -= hh * 3600000;
  const mm = Math.floor(ms / 60000); ms -= mm * 60000;
  const ss = Math.floor(ms / 1000); ms -= ss * 1000;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}.${p(Math.floor(ms / 10))}`;
}

function isSrtTimestamp(testString: string): boolean {
  const [hStr, mStr, smStr] = testString.split(":");
  if (!smStr) return false;
  const hrs = Number.parseInt(hStr, 10), mins = Number.parseInt(mStr, 10);
  if (Number.isNaN(hrs) || Number.isNaN(mins) || mins > 60) return false;
  const [secStr, msStr] = smStr.split(",");
  if (!msStr) return false;
  const secs = Number.parseInt(secStr, 10), ms = Number.parseInt(msStr, 10);
  return !Number.isNaN(secs) && secs <= 60 && !Number.isNaN(ms) && ms <= 1000;
}

export function isSrtTimestampRange(timeString: string): boolean {
  const timeSplit = timeString.split("-->");
  return timeSplit.length === 2 && isSrtTimestamp(timeSplit[0].trim()) && isSrtTimestamp(timeSplit[1].trim());
}

type SrtCue = {
  text: string;
  startTime: number;
  duration: number;
};

export type TlImportProfile = {
  Name: string;
  CC: string;
  OC: string;
};

export type TlImportEntry = {
  text: string;
  startTime: number;
  duration: number;
  profileIndex: number;
};

export type TlImportParseResult = {
  profiles: TlImportProfile[];
  entries: TlImportEntry[];
};

type ParseTlAssImportOptions = {
  trimDialogueStyle?: boolean;
  requireTimestampFraction?: boolean;
};

type AssStyleFormat = {
  nameIndex: number;
  primaryColourIndex: number;
  outlineColourIndex: number;
  dataLength: number;
};

type AssEventFormat = {
  startIndex: number;
  endIndex: number;
  styleIndex: number;
  textIndex: number;
  dataLength: number;
};

function splitAssFormatLine(line: string | undefined): string[] | null {
  if (!line || line.search(/^Format/gi) === -1) return null;
  const format = line.split(":")[1];
  if (format === undefined) return null;
  return format.split(",").map((item) => item.trim());
}

function readAssStyleFormat(line: string | undefined): AssStyleFormat | null {
  const lineSplit = splitAssFormatLine(line);
  if (!lineSplit) {
    return null;
  }

  const nameIndex = lineSplit.indexOf("Name");
  const primaryColourIndex = lineSplit.indexOf("PrimaryColour");
  const outlineColourIndex = lineSplit.indexOf("OutlineColour");
  if (nameIndex === -1 || primaryColourIndex === -1 || outlineColourIndex === -1) {
    return null;
  }

  return {
    nameIndex,
    primaryColourIndex,
    outlineColourIndex,
    dataLength: lineSplit.length,
  };
}

function readAssEventFormat(line: string | undefined): AssEventFormat | null {
  const lineSplit = splitAssFormatLine(line);
  if (!lineSplit) return null;
  const startIndex = lineSplit.indexOf("Start");
  const endIndex = lineSplit.indexOf("End");
  const styleIndex = lineSplit.indexOf("Style");
  const textIndex = lineSplit.indexOf("Text");
  if (startIndex === -1 || endIndex === -1 || styleIndex === -1 || textIndex === -1) return null;
  return { startIndex, endIndex, styleIndex, textIndex, dataLength: lineSplit.length };
}

function parseAssStyleColour(raw: string): string | null {
  const colour = raw.trim();
  if (colour.length !== 10) return null;
  return colour.slice(8, 10) + colour.slice(6, 8) + colour.slice(4, 6);
}

function parseAssTimestamp(raw: string, options: ParseTlAssImportOptions): number | null {
  const timeSplit = raw.trim().split(":");
  if (timeSplit.length !== 3) return null;
  const secondSplit = timeSplit[2].split(".");
  if (options.requireTimestampFraction && secondSplit.length !== 2) return null;
  let msShift = secondSplit[1] || "0";
  if (msShift.length === 2) msShift += "0";
  else if (msShift.length === 1) msShift += "00";
  const hours = Number.parseInt(timeSplit[0], 10);
  const minutes = Number.parseInt(timeSplit[1], 10);
  const seconds = Number.parseInt(secondSplit[0], 10);
  const milliseconds = Number.parseInt(msShift, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds) || Number.isNaN(milliseconds)) return null;
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
}

function parseAssProfiles(lines: string[]): TlImportProfile[] | null {
  const sIdx = lines.findIndex((l) => l.search(/\[V4\+ Styles\]/gi) !== -1);
  if (sIdx === -1) return null;
  const styleFormat = readAssStyleFormat(lines[sIdx + 1]);
  if (!styleFormat) return null;
  const profiles: TlImportProfile[] = [];
  for (let i = sIdx + 2; i < lines.length; i++) {
    if (lines[i].search(/^Style/gi) === -1) break;
    const styleValues = lines[i].split(":")[1]?.split(",").map((item) => item.trim());
    if (!styleValues || styleValues.length !== styleFormat.dataLength) return null;
    const CC = parseAssStyleColour(styleValues[styleFormat.primaryColourIndex]);
    const OC = parseAssStyleColour(styleValues[styleFormat.outlineColourIndex]);
    if (CC === null || OC === null) return null;
    profiles.push({ Name: styleValues[styleFormat.nameIndex].trim(), CC, OC });
  }
  return profiles;
}

function parseAssEntries(lines: string[], profiles: TlImportProfile[], options: ParseTlAssImportOptions): TlImportEntry[] | null {
  const eIdx = lines.findIndex((l) => l.search(/\[Events\]/gi) !== -1);
  if (eIdx === -1) return null;
  const eventFormat = readAssEventFormat(lines[eIdx + 1]);
  if (!eventFormat) return null;
  const entries: TlImportEntry[] = [];
  for (let i = eIdx + 2; i < lines.length; i++) {
    if (lines[i].search(/^Dialogue/gi) === -1) break;
    const dialogueValues = lines[i].split("Dialogue:")[1]?.split(",");
    if (!dialogueValues) return null;
    if (dialogueValues.length < eventFormat.dataLength) break;
    const profileName = options.trimDialogueStyle ? dialogueValues[eventFormat.styleIndex].trim() : dialogueValues[eventFormat.styleIndex];
    const profileIndex = profiles.findIndex((profile) => profile.Name === profileName);
    if (profileIndex === -1) continue;
    const text = dialogueValues.slice(eventFormat.textIndex).join(",");
    const startTime = parseAssTimestamp(dialogueValues[eventFormat.startIndex].trim(), options);
    const endTime = parseAssTimestamp(dialogueValues[eventFormat.endIndex].trim(), options);
    if (startTime === null || endTime === null) return null;
    entries.push({ text, startTime, duration: endTime - startTime, profileIndex });
  }
  return entries;
}

export function parseTlAssImport(dataFeed: string, options: ParseTlAssImportOptions = {}): TlImportParseResult | null {
  const lines = dataFeed.split("\n");
  const profiles = parseAssProfiles(lines);
  if (!profiles) return null;
  const entries = parseAssEntries(lines, profiles, options);
  if (!entries) return null;
  return { profiles, entries };
}

function readTagAttribute(dataFeed: string, tagStart: number, tagEnd: number, name: string): string | null {
  const target = dataFeed.indexOf(`${name}="`, tagStart);
  if (target === -1 || target > tagEnd) return null;
  const valueStart = target + name.length + 2;
  const valueEnd = dataFeed.indexOf('"', valueStart);
  if (valueEnd === -1 || valueEnd > tagEnd) return null;
  return dataFeed.substring(valueStart, valueEnd);
}

function readOptionalTtmlPenColour(dataFeed: string, tagStart: number, tagEnd: number, name: string): string | null {
  const target = dataFeed.indexOf(`${name}="`, tagStart);
  if (target === -1 || target > tagEnd) return "";
  const valueStart = target + 5;
  const valueEnd = dataFeed.indexOf('"', valueStart);
  if (valueEnd === -1 || valueEnd > tagEnd) return null;
  return dataFeed.substring(valueStart, valueEnd);
}

function parseTtmlProfiles(dataFeed: string): TlImportProfile[] | null {
  const startIndex = dataFeed.indexOf("<head>");
  const endIndex = dataFeed.indexOf("</head>");
  if (startIndex === -1 || endIndex === -1) return null;
  const profiles: TlImportProfile[] = [];
  for (let penStart = dataFeed.indexOf("<pen", startIndex); penStart !== -1 && penStart < endIndex; penStart = dataFeed.indexOf("<pen", penStart)) {
    const penEnd = dataFeed.indexOf(">", penStart);
    if (penEnd === -1 || penEnd > endIndex) return null;
    const Name = readTagAttribute(dataFeed, penStart, penEnd, "id");
    const CC = readOptionalTtmlPenColour(dataFeed, penStart, penEnd, "fc");
    const OC = readOptionalTtmlPenColour(dataFeed, penStart, penEnd, "ec");
    if (Name === null || CC === null || OC === null) return null;
    profiles.push({ Name, CC, OC });
    penStart = penEnd;
  }
  return profiles;
}

type ParseTlTtmlImportOptions = {
  continueAfterUnknownProfile?: boolean;
};

function parseTtmlSpanEntry(dataFeed: string, profiles: TlImportProfile[], pEnd: number, sStart: number, startTime: number, duration: number, options: ParseTlTtmlImportOptions): TlImportEntry | null {
  const sTagEnd = dataFeed.indexOf(">", sStart);
  const spanEnd = dataFeed.indexOf("</s>", sTagEnd);
  if (sTagEnd === -1 || sTagEnd > pEnd || spanEnd === -1 || spanEnd > pEnd) return null;
  const text = dataFeed.substring(sTagEnd + 1, spanEnd).trim();
  if (text.length <= 1) return { text: "", startTime, duration, profileIndex: -1 };
  const profileName = readTagAttribute(dataFeed, sStart, sTagEnd, "p");
  if (profileName === null) return options.continueAfterUnknownProfile ? null : { text, startTime, duration, profileIndex: -1 };
  return { text, startTime, duration, profileIndex: profiles.findIndex((p) => p.Name === profileName) };
}

function parseTtmlEntries(dataFeed: string, profiles: TlImportProfile[], options: ParseTlTtmlImportOptions): TlImportEntry[] | null {
  const bodyStart = dataFeed.indexOf("<body>");
  const bodyEnd = dataFeed.indexOf("</body>");
  if (bodyStart === -1 || bodyEnd === -1) return null;
  let previousTimestamp = 0;
  const entries: TlImportEntry[] = [];
  for (let pStart = dataFeed.indexOf("<p", bodyStart); pStart !== -1 && pStart < bodyEnd; pStart = dataFeed.indexOf("<p", pStart)) {
    const pEnd = dataFeed.indexOf("</p>", pStart);
    if (pEnd === -1 || pEnd > bodyEnd) return null;
    const tagEnd = dataFeed.indexOf(">", pStart);
    if (tagEnd === -1 || tagEnd > pEnd) return null;
    const rawStartTime = readTagAttribute(dataFeed, pStart, tagEnd, "t");
    const rawEndTime = readTagAttribute(dataFeed, pStart, tagEnd, "d");
    if (rawStartTime === null || rawEndTime === null) return null;
    const startTime = Number.parseInt(rawStartTime, 10);
    const endTime = Number.parseInt(rawEndTime, 10);
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) return null;
    if (previousTimestamp !== startTime) {
      previousTimestamp = startTime;
      const duration = endTime - startTime;
      for (let sStart = dataFeed.indexOf("<s", tagEnd); sStart !== -1 && sStart < pEnd; sStart = dataFeed.indexOf("<s", sStart)) {
        const entry = parseTtmlSpanEntry(dataFeed, profiles, pEnd, sStart, startTime, duration, options);
        if (entry === null) return null;
        if (entry.profileIndex >= 0) { entries.push(entry); break; }
        if (!options.continueAfterUnknownProfile && entry.text.length > 1) break;
        sStart = dataFeed.indexOf(">", sStart);
      }
    }
    pStart = pEnd;
  }
  return entries;
}

export function parseTlTtmlImport(dataFeed: string, options: ParseTlTtmlImportOptions = {}): TlImportParseResult | null {
  const profiles = parseTtmlProfiles(dataFeed);
  if (!profiles) return null;
  const entries = parseTtmlEntries(dataFeed, profiles, options);
  if (!entries) return null;
  return { profiles, entries };
}

export function parseSrtCues(dataFeed: string): SrtCue[] {
  const lines = dataFeed.split("\n");
  const cues: SrtCue[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isSrtTimestampRange(lines[i])) continue;
    const [t0, t1] = lines[i].split("-->");
    const startTime = parseSrtTimestamp(t0.trim());
    const endTime = parseSrtTimestamp(t1.trim());
    const push = (text: string) => cues.push({ text, startTime, duration: endTime - startTime });
    let text = "", shouldWriteText = true;
    for (i++; i < lines.length; i++) {
      if (isSrtTimestampRange(lines[i])) { i--; push(text); break; }
      if (lines[i] === "") { push(text); break; }
      if (i === lines.length - 1) { if (lines[i].trim()) text += lines[i]; push(text); break; }
      if (lines[i].trim()) { if (shouldWriteText) { if (text) text += " "; text += lines[i]; } }
      else shouldWriteText = false;
    }
  }
  return cues;
}

export function parseSrtTimestamp(targetString: string): number {
  const [hhmm, ms] = targetString.split(",");
  const [h, m, s] = hhmm.split(":").map(Number);
  return h * 3600000 + m * 60000 + s * 1000 + Number(ms);
}

export function stringifyTlExportTime(time: number, mode: boolean): string {
  const h = Math.floor(time / 3600000);
  const m = Math.floor((time % 3600000) / 60000);
  const s = Math.floor((time % 60000) / 1000);
  const ms = time % 1000;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${mode ? "," : "."}${ms}`;
}

export function buildTlAssExport(entries: any[], profile: any[]): string {
  const bgrHex = (hex: string, use: boolean, fallback: string) =>
    use ? hex.substring(5, 7) + hex.substring(3, 5) + hex.substring(1, 3) : fallback;
  const styleLines = profile.map((p) =>
    `Style: ${p.Name},Arial,20,&H00${bgrHex(p.CC, p.useCC, "FFFFFF")},&H00000000,&H00${bgrHex(p.OC, p.useOC, "000000")},&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1`
  ).join("\n");
  const dialogueLines = entries.map((entry, i) => {
    const endTime = i === entries.length - 1 ? entry.Time + 3000 : entry.Time + entries[0].Duration;
    return `Dialogue: 0,${stringifyTlExportTime(entry.Time, false)},${stringifyTlExportTime(endTime, false)},${profile[entry.Profile].Name},,0,0,0,,${entry.SText}`;
  }).join("\n");
  return `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n${styleLines}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${dialogueLines}\n`;
}

export function buildTlTtmlExport(entries: any[], profile: any[]): string {
  const penLines = profile.flatMap((p, i) =>
    [4, 3].map((et, j) =>
      `\t\t<pen id="${i * 2 + 2 + j}" sz="100" fc="${p.useCC ? p.CC : "#FFFFFF"}" fo="254" et="${et}" ec="${p.useOC ? p.OC : "#000000"}" />`
    )
  ).join("\n");
  const bodyLines = entries.flatMap((entry, i) => {
    const d = i === entries.length - 1 ? entry.Time + 3001 : entry.Time + 1 + entry.Duration;
    return [2, 3].map((penOffset) =>
      `\t\t<p t="${entry.Time + 1}" d="${d}" wp="1" ws="1"><s p="1"></s><s p="${entry.Profile * 2 + penOffset}"> ${entry.SText} </s><s p="1"></s></p>`
    );
  }).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?><timedtext format="3">\n\t<head>\n\t\t<wp id="0" ap="7" ah="0" av="0" />\n\t\t<wp id="1" ap="7" ah="50" av="100" />\n\t\t<ws id="0" ju="2" pd="0" sd="0" />\n\t\t<ws id="1" ju="2" pd="0" sd="0" />\n\n\t\t<pen id="0" sz="100" fc="#000000" fo="0" bo="0" />\n\t\t<pen id="1" sz="0" fc="#A0AAB4" fo="0" bo="0" />\n${penLines}\n\t</head>\n\n\t<body>\n${bodyLines}\n\t</body>\n</timedtext>`;
}

export function buildTlSrtExport(entries: any[]): string {
  return entries.map((entry, i) => {
    const endTime = i === entries.length - 1 ? entry.Time + 3000 : entry.Time + entry.Duration;
    return `${i + 1}\n${stringifyTlExportTime(entry.Time, true)} --> ${stringifyTlExportTime(endTime, true)}\n${entry.SText}\n\n`;
  }).join("");
}
