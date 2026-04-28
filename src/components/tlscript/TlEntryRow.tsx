"use client";

import { formatTlTimestamp, getTlTextStyle } from "@/lib/tl-format";
import { dayjs } from "@/lib/time";

type TlEntryRowProps = {
  variant?: "preview" | "editor";
  time?: number;
  duration?: number;
  profileName?: string;
  stext?: string;
  cc?: string;
  oc?: string;
  realTime?: number;
  useRealTime?: boolean;
  onClick?: () => void;
};

export function TlEntryRow({
  variant = "preview",
  time = 0,
  duration = 0,
  profileName = "",
  stext = "",
  cc = "",
  oc = "",
  realTime = 0,
  useRealTime = false,
  onClick,
}: TlEntryRowProps) {
  const isEditor = variant === "editor";
  const start = useRealTime ? dayjs(realTime).format("h:mm:ss.SSS A") : formatTlTimestamp(time);
  const end = useRealTime ? dayjs(realTime + duration).format("h:mm:ss.SSS A") : formatTlTimestamp(time + duration);
  const textStyle = { ...getTlTextStyle(cc, oc, isEditor ? "1px" : "0.001em"), fontWeight: "bold" };

  return (
    <tr onClick={onClick}>
      <td style={{ whiteSpace: isEditor ? "nowrap" : undefined }}>{start}</td>
      <td style={{ whiteSpace: isEditor ? "nowrap" : undefined }}>{end}</td>
      {isEditor ? <td>{profileName}</td> : null}
      <td className="EntryContainer" style={textStyle} colSpan={2}>
        <span style={{ wordWrap: "break-word" }}>{stext}</span>
      </td>
    </tr>
  );
}
