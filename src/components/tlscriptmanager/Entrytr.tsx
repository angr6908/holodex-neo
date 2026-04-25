"use client";

function formatTs(raw: number): string {
  let timeRaw = raw;
  let s = "";
  const hh = Math.floor(timeRaw / 3600000); timeRaw -= hh * 3600000;
  s += (hh < 10 ? "0" : "") + hh + ":";
  const mm = Math.floor(timeRaw / 60000); timeRaw -= mm * 60000;
  s += (mm < 10 ? "0" : "") + mm + ":";
  const ss = Math.floor(timeRaw / 1000); timeRaw -= ss * 1000;
  s += (ss < 10 ? "0" : "") + ss + ".";
  s += timeRaw > 100 ? String(timeRaw).slice(0, 2) : timeRaw > 10 ? "0" + String(timeRaw).slice(0, 1) : "00";
  return s;
}

export function Entrytr({ time = 0, duration = 0, stext = "", cc = "", oc = "" }: { time?: number; duration?: number; stext?: string; cc?: string; oc?: string }) {
  const textStyle = { WebkitTextFillColor: cc === "" ? "unset" : cc, WebkitTextStrokeColor: oc === "" ? "unset" : oc, WebkitTextStrokeWidth: oc === "" ? "0px" : "0.001em", fontWeight: "bold" } as React.CSSProperties;
  return <tr><td>{formatTs(time)}</td><td>{formatTs(time + duration)}</td><td className="EntryContainer" style={textStyle} colSpan={2}><span style={{ wordWrap: "break-word" }}>{stext}</span></td></tr>;
}
