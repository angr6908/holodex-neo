"use client";

import { TlExportButtons } from "@/components/tlscript/TlExportButtons";
import { useI18n } from "@/lib/i18n";
import { buildTlAssExport, buildTlSrtExport, buildTlTtmlExport, downloadTextFile } from "@/lib/tl-format";

export function ScriptEditorExportToFile({ entries = [], profile = [], title = "Holodex" }: { entries?: any[]; profile?: any[]; title?: string }) {
  const { t } = useI18n();
  return <div className="space-y-4 p-4"><h2 className="text-center text-xl font-semibold text-[color:var(--color-foreground)]">{t("views.scriptEditor.menu.exportFile")}</h2><h4 className="text-center text-sm text-[color:var(--color-muted-foreground)]">{entries.length + " entries, " + profile.length + " profile."}</h4><TlExportButtons onExportSrt={() => downloadTextFile(`${title}.srt`, buildTlSrtExport(entries))} onExportAss={() => downloadTextFile(`${title}.ass`, buildTlAssExport(entries, profile))} onExportTtml={() => downloadTextFile(`${title}.ttml`, buildTlTtmlExport(entries, profile))} /></div>;
}
