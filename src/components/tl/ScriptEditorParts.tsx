"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { dayjs } from "@/lib/time";
import { buildTlAssExport, buildTlSrtExport, buildTlTtmlExport, downloadTextFile, formatTlTimestamp } from "@/lib/tl-format";
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
  realTime = 0,
  useRealTime = false,
  onClick,
}: TlEntryRowProps) {
  const isEditor = variant === "editor";
  const start = useRealTime ? dayjs(realTime).format("h:mm:ss.SSS A") : formatTlTimestamp(time);
  const end = useRealTime ? dayjs(realTime + duration).format("h:mm:ss.SSS A") : formatTlTimestamp(time + duration);

  return (
    <TableRow onClick={onClick}>
      <TableCell className={isEditor ? "whitespace-nowrap" : undefined}>{start}</TableCell>
      <TableCell className={isEditor ? "whitespace-nowrap" : undefined}>{end}</TableCell>
      {isEditor ? <TableCell>{profileName}</TableCell> : null}
      <TableCell className="font-bold" colSpan={2}>
        <span className="break-words">{stext}</span>
      </TableCell>
    </TableRow>
  );
}

type TlExportButtonsProps = {
  onExportSrt: () => void;
  onExportAss: () => void;
  onExportTtml: () => void;
};

function TlExportButtons({ onExportSrt, onExportAss, onExportTtml }: TlExportButtonsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Button type="button" onClick={onExportSrt}>.srt</Button>
      <Button type="button" onClick={onExportAss}>.ass</Button>
      <Button type="button" onClick={onExportTtml}>.ttml</Button>
    </div>
  );
}

export function ScriptEditorExportToFile({ entries = [], profile = [], title = "Holodex" }: { entries?: any[]; profile?: any[]; title?: string }) {
  const t = useTranslations();
  return <div className="space-y-4 p-4"><h2 className="text-center text-xl font-semibold text-foreground">{t("views.scriptEditor.menu.exportFile")}</h2><h4 className="text-center text-sm text-muted-foreground">{t("editor.music.exportSummary", { entries: entries.length, profiles: profile.length })}</h4><TlExportButtons onExportSrt={() => downloadTextFile(`${title}.srt`, buildTlSrtExport(entries))} onExportAss={() => downloadTextFile(`${title}.ass`, buildTlAssExport(entries, profile))} onExportTtml={() => downloadTextFile(`${title}.ttml`, buildTlTtmlExport(entries, profile))} /></div>;
}
