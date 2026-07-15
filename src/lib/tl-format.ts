export function downloadTextFile(filename: string, contents: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contents], { type: "text/plain" }));
  a.download = filename;
  a.click();
  a.remove();
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const splitHMS = (ms: number) => [
  Math.floor(ms / 3600000),
  Math.floor(ms / 60000) % 60,
  Math.floor(ms / 1000) % 60,
  ms % 1000,
];

export function formatTlTimestamp(raw: number) {
  const [h, m, s, ms] = splitHMS(Math.max(0, Math.floor(raw || 0)));
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad2(Math.floor(ms / 10))}`;
}

// Compact ruler label: formatTlTimestamp with leading zero units and centiseconds trimmed ("1:30").
export function formatTlRulerTimestamp(sec: number) {
  let stamp = formatTlTimestamp(sec * 1000);
  for (let i = 0; i < 3 && stamp.slice(0, 2) === "00"; i++) stamp = stamp.slice(3);
  if (stamp[0] === "0") stamp = stamp.slice(1);
  return stamp.slice(0, -3);
}

const stringifyTlExportTime = (t: number, srt: boolean) => {
  const [h, m, s, ms] = splitHMS(t);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}${srt ? "," : "."}${ms}`;
};

const isSrtTimestamp = (s: string) => {
  const [hStr, mStr, smStr] = s.split(":");
  const [secStr, msStr] = (smStr || "").split(",");
  if (!msStr) return false;
  const nums = [hStr, mStr, secStr, msStr].map((v) => parseInt(v, 10));
  return !nums.some(Number.isNaN) && nums[1] <= 60 && nums[2] <= 60 && nums[3] <= 1000;
};

export const isSrtTimestampRange = (t: string) => {
  const parts = t.split("-->");
  return parts.length === 2 && isSrtTimestamp(parts[0].trim()) && isSrtTimestamp(parts[1].trim());
};

type Profile = { Name: string; CC: string; OC: string };
type Entry = { text: string; startTime: number; duration: number; profileIndex: number };
type ParseResult = { profiles: Profile[]; entries: Entry[] };
type AssOpts = { trimDialogueStyle?: boolean; requireTimestampFraction?: boolean };
type TtmlOpts = { continueAfterUnknownProfile?: boolean };

const splitFormat = (line?: string) => {
  if (!line || !/^Format/i.test(line)) return null;
  const f = line.split(":")[1];
  return f === undefined ? null : f.split(",").map((s) => s.trim());
};

const parseColour = (raw: string) => {
  const c = raw.trim();
  return c.length === 10 ? c.slice(8, 10) + c.slice(6, 8) + c.slice(4, 6) : null;
};

function parseAssTimestamp(raw: string, opts: AssOpts) {
  const t = raw.trim().split(":");
  if (t.length !== 3) return null;
  const sec = t[2].split(".");
  if (opts.requireTimestampFraction && sec.length !== 2) return null;
  const nums = [t[0], t[1], sec[0], (sec[1] || "0").padEnd(3, "0")].map((v) => parseInt(v, 10));
  return nums.some(Number.isNaN)
    ? null
    : nums[0] * 3600000 + nums[1] * 60000 + nums[2] * 1000 + nums[3];
}

function parseAssProfiles(lines: string[]): Profile[] | null {
  const sIdx = lines.findIndex((l) => /\[V4\+ Styles\]/i.test(l));
  if (sIdx === -1) return null;
  const fmt = splitFormat(lines[sIdx + 1]);
  if (!fmt) return null;
  const nameI = fmt.indexOf("Name"),
    pcI = fmt.indexOf("PrimaryColour"),
    ocI = fmt.indexOf("OutlineColour");
  if (nameI === -1 || pcI === -1 || ocI === -1) return null;
  const profiles: Profile[] = [];
  for (let i = sIdx + 2; i < lines.length && /^Style/i.test(lines[i]); i++) {
    const v = lines[i]
      .split(":")[1]
      ?.split(",")
      .map((s) => s.trim());
    if (!v || v.length !== fmt.length) return null;
    const CC = parseColour(v[pcI]),
      OC = parseColour(v[ocI]);
    if (CC === null || OC === null) return null;
    profiles.push({ Name: v[nameI].trim(), CC, OC });
  }
  return profiles;
}

function parseAssEntries(lines: string[], profiles: Profile[], opts: AssOpts): Entry[] | null {
  const eIdx = lines.findIndex((l) => /\[Events\]/i.test(l));
  if (eIdx === -1) return null;
  const fmt = splitFormat(lines[eIdx + 1]);
  if (!fmt) return null;
  const startI = fmt.indexOf("Start"),
    endI = fmt.indexOf("End"),
    styleI = fmt.indexOf("Style"),
    textI = fmt.indexOf("Text");
  if (startI === -1 || endI === -1 || styleI === -1 || textI === -1) return null;
  const entries: Entry[] = [];
  for (let i = eIdx + 2; i < lines.length && /^Dialogue/i.test(lines[i]); i++) {
    const v = lines[i].split("Dialogue:")[1]?.split(",");
    if (!v) return null;
    if (v.length < fmt.length) break;
    const name = opts.trimDialogueStyle ? v[styleI].trim() : v[styleI];
    const profileIndex = profiles.findIndex((p) => p.Name === name);
    if (profileIndex === -1) continue;
    const startTime = parseAssTimestamp(v[startI].trim(), opts);
    const endTime = parseAssTimestamp(v[endI].trim(), opts);
    if (startTime === null || endTime === null) return null;
    entries.push({
      text: v.slice(textI).join(","),
      startTime,
      duration: endTime - startTime,
      profileIndex,
    });
  }
  return entries;
}

export function parseTlAssImport(data: string, opts: AssOpts = {}): ParseResult | null {
  const lines = data.split("\n");
  const profiles = parseAssProfiles(lines);
  const entries = profiles && parseAssEntries(lines, profiles, opts);
  return profiles && entries ? { profiles, entries } : null;
}

function readAttr(data: string, tagStart: number, tagEnd: number, name: string) {
  const t = data.indexOf(`${name}="`, tagStart);
  if (t === -1 || t > tagEnd) return null;
  const valStart = t + name.length + 2;
  const valEnd = data.indexOf('"', valStart);
  return valEnd === -1 || valEnd > tagEnd ? null : data.substring(valStart, valEnd);
}

function readPenColour(data: string, tagStart: number, tagEnd: number, name: string) {
  const t = data.indexOf(`${name}="`, tagStart);
  if (t === -1 || t > tagEnd) return "";
  const valStart = t + 5;
  const valEnd = data.indexOf('"', valStart);
  return valEnd === -1 || valEnd > tagEnd ? null : data.substring(valStart, valEnd);
}

function parseTtmlProfiles(data: string): Profile[] | null {
  const s = data.indexOf("<head>"),
    e = data.indexOf("</head>");
  if (s === -1 || e === -1) return null;
  const profiles: Profile[] = [];
  for (let p = data.indexOf("<pen", s); p !== -1 && p < e; p = data.indexOf("<pen", p)) {
    const pe = data.indexOf(">", p);
    if (pe === -1 || pe > e) return null;
    const Name = readAttr(data, p, pe, "id"),
      CC = readPenColour(data, p, pe, "fc"),
      OC = readPenColour(data, p, pe, "ec");
    if (Name === null || CC === null || OC === null) return null;
    profiles.push({ Name, CC, OC });
    p = pe;
  }
  return profiles;
}

function parseTtmlSpan(
  data: string,
  profiles: Profile[],
  pEnd: number,
  sStart: number,
  startTime: number,
  duration: number,
  opts: TtmlOpts,
): Entry | null {
  const sTagEnd = data.indexOf(">", sStart),
    spanEnd = data.indexOf("</s>", sTagEnd);
  if (sTagEnd === -1 || sTagEnd > pEnd || spanEnd === -1 || spanEnd > pEnd) return null;
  const text = data.substring(sTagEnd + 1, spanEnd).trim();
  if (text.length <= 1) return { text: "", startTime, duration, profileIndex: -1 };
  const name = readAttr(data, sStart, sTagEnd, "p");
  if (name === null)
    return opts.continueAfterUnknownProfile
      ? null
      : { text, startTime, duration, profileIndex: -1 };
  return { text, startTime, duration, profileIndex: profiles.findIndex((p) => p.Name === name) };
}

function parseTtmlEntries(data: string, profiles: Profile[], opts: TtmlOpts): Entry[] | null {
  const bS = data.indexOf("<body>"),
    bE = data.indexOf("</body>");
  if (bS === -1 || bE === -1) return null;
  let prev = 0;
  const entries: Entry[] = [];
  for (
    let pStart = data.indexOf("<p", bS);
    pStart !== -1 && pStart < bE;
    pStart = data.indexOf("<p", pStart)
  ) {
    const pEnd = data.indexOf("</p>", pStart);
    if (pEnd === -1 || pEnd > bE) return null;
    const tagEnd = data.indexOf(">", pStart);
    if (tagEnd === -1 || tagEnd > pEnd) return null;
    const rs = readAttr(data, pStart, tagEnd, "t"),
      re = readAttr(data, pStart, tagEnd, "d");
    if (rs === null || re === null) return null;
    const st = parseInt(rs, 10),
      et = parseInt(re, 10);
    if (Number.isNaN(st) || Number.isNaN(et)) return null;
    if (prev !== st) {
      prev = st;
      const dur = et - st;
      for (
        let sStart = data.indexOf("<s", tagEnd);
        sStart !== -1 && sStart < pEnd;
        sStart = data.indexOf("<s", sStart)
      ) {
        const e = parseTtmlSpan(data, profiles, pEnd, sStart, st, dur, opts);
        if (e === null) return null;
        if (e.profileIndex >= 0) {
          entries.push(e);
          break;
        }
        if (!opts.continueAfterUnknownProfile && e.text.length > 1) break;
        sStart = data.indexOf(">", sStart);
      }
    }
    pStart = pEnd;
  }
  return entries;
}

export function parseTlTtmlImport(data: string, opts: TtmlOpts = {}): ParseResult | null {
  const profiles = parseTtmlProfiles(data);
  const entries = profiles && parseTtmlEntries(data, profiles, opts);
  return profiles && entries ? { profiles, entries } : null;
}

const parseSrtTimestamp = (s: string) => {
  const [hhmm, ms] = s.split(",");
  const [h, m, sec] = hhmm.split(":").map(Number);
  return h * 3600000 + m * 60000 + sec * 1000 + Number(ms);
};

export function parseSrtCues(data: string) {
  const lines = data.split("\n");
  const cues: { text: string; startTime: number; duration: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isSrtTimestampRange(lines[i])) continue;
    const [t0, t1] = lines[i].split("-->");
    const startTime = parseSrtTimestamp(t0.trim()),
      endTime = parseSrtTimestamp(t1.trim());
    const push = (text: string) => cues.push({ text, startTime, duration: endTime - startTime });
    let text = "",
      write = true;
    for (i++; i < lines.length; i++) {
      if (isSrtTimestampRange(lines[i])) {
        i--;
        push(text);
        break;
      }
      if (lines[i] === "") {
        push(text);
        break;
      }
      if (i === lines.length - 1) {
        if (lines[i].trim()) text += lines[i];
        push(text);
        break;
      }
      if (lines[i].trim()) {
        if (write) text += (text ? " " : "") + lines[i];
      } else write = false;
    }
  }
  return cues;
}

const bgrHex = (hex: string, use: boolean, fallback: string) =>
  use ? hex.substring(5, 7) + hex.substring(3, 5) + hex.substring(1, 3) : fallback;

export function buildTlAssExport(entries: any[], profile: any[]) {
  const styles = profile
    .map(
      (p) =>
        `Style: ${p.Name},Arial,20,&H00${bgrHex(p.CC, p.useCC, "FFFFFF")},&H00000000,&H00${bgrHex(p.OC, p.useOC, "000000")},&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1`,
    )
    .join("\n");
  const dialogues = entries
    .map((e, i) => {
      const end = i === entries.length - 1 ? e.Time + 3000 : e.Time + entries[0].Duration;
      return `Dialogue: 0,${stringifyTlExportTime(e.Time, false)},${stringifyTlExportTime(end, false)},${profile[e.Profile].Name},,0,0,0,,${e.SText}`;
    })
    .join("\n");
  return `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n${styles}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${dialogues}\n`;
}

export function buildTlTtmlExport(entries: any[], profile: any[]) {
  const pens = profile
    .flatMap((p, i) =>
      [4, 3].map(
        (et, j) =>
          `\t\t<pen id="${i * 2 + 2 + j}" sz="100" fc="${p.useCC ? p.CC : "#FFFFFF"}" fo="254" et="${et}" ec="${p.useOC ? p.OC : "#000000"}" />`,
      ),
    )
    .join("\n");
  const body = entries
    .flatMap((e, i) => {
      const d = i === entries.length - 1 ? e.Time + 3001 : e.Time + 1 + e.Duration;
      return [2, 3].map(
        (off) =>
          `\t\t<p t="${e.Time + 1}" d="${d}" wp="1" ws="1"><s p="1"></s><s p="${e.Profile * 2 + off}"> ${e.SText} </s><s p="1"></s></p>`,
      );
    })
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?><timedtext format="3">\n\t<head>\n\t\t<wp id="0" ap="7" ah="0" av="0" />\n\t\t<wp id="1" ap="7" ah="50" av="100" />\n\t\t<ws id="0" ju="2" pd="0" sd="0" />\n\t\t<ws id="1" ju="2" pd="0" sd="0" />\n\n\t\t<pen id="0" sz="100" fc="#000000" fo="0" bo="0" />\n\t\t<pen id="1" sz="0" fc="#A0AAB4" fo="0" bo="0" />\n${pens}\n\t</head>\n\n\t<body>\n${body}\n\t</body>\n</timedtext>`;
}

export function buildTlSrtExport(entries: any[]) {
  return entries
    .map((e, i) => {
      const end = i === entries.length - 1 ? e.Time + 3000 : e.Time + e.Duration;
      return `${i + 1}\n${stringifyTlExportTime(e.Time, true)} --> ${stringifyTlExportTime(end, true)}\n${e.SText}\n\n`;
    })
    .join("");
}
