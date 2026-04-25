"use client";

import { useEffect, useMemo, useState } from "react";
import { mdiFileTable } from "@mdi/js";
import { json2csv } from "json-2-csv";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { VideoCardList } from "@/components/video/VideoCardList";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import * as icons from "@/lib/icons";

const SORT_OPTIONS = [
  { cat: "added_at", asc: -1 },
  { cat: "added_at", asc: 1 },
  { cat: "available_at", asc: -1 },
  { cat: "available_at", asc: 1 },
];

export function LibraryPage() {
  const app = useAppState();
  const { t } = useI18n();
  const [savedVideos, setSavedVideos] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [instructionsDialog, setInstructionsDialog] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [sortModel, setSortModel] = useState(0);
  useEffect(() => { document.title = `${t("component.mainNav.library")} - Holodex`; }, [t]);
  const sortby = [
    { label: t("views.library.sort.dateaddedLatestFirst"), value: 0 },
    { label: t("views.library.sort.dateaddedEarliestFirst"), value: 1 },
    { label: t("views.library.sort.dateuploadedLatestFirst"), value: 2 },
    { label: t("views.library.sort.dateuploadedEarliestFirst"), value: 3 },
  ];
  const savedVideosList = useMemo(() => {
    const sortStyle = SORT_OPTIONS[sortModel];
    return Object.values(savedVideos).sort((a: any, b: any) => {
      const dateA = new Date(a[sortStyle.cat]).getTime();
      const dateB = new Date(b[sortStyle.cat]).getTime();
      return dateA > dateB ? 1 * sortStyle.asc : -1 * sortStyle.asc;
    });
  }, [savedVideos, sortModel]);
  const showReset = selected.length !== 0;
  function selectAll() { setSelected(savedVideosList.map((v: any) => v.id)); }
  function select(n: number) { setSelected(savedVideosList.slice(0, n).map((v: any) => v.id)); }
  function reset() { setSelected([]); }
  function deleteSelected() { setSavedVideos((current) => { const next = { ...current }; selected.forEach((id) => { delete next[id]; }); return next; }); reset(); }
  function exportSelected() { if (!selected.length) return; window.open(`https://www.youtube.com/watch_videos?video_ids=${selected.join(",")}`, "_blank", "noopener"); reset(); }
  async function downloadAsCSV() {
    const selectedSet = new Set(selected);
    const csvString = await json2csv(savedVideosList.filter((v: any) => selectedSet.has(v.id)) as any[]);
    const a = document.createElement("a");
    const timestamp = new Date().toISOString().replace("T", "_").slice(0, 19);
    a.href = `data:attachment/csv,${encodeURIComponent(csvString)}`;
    a.target = "_blank";
    a.download = `holodexPlaylist_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
  }
  function toggleSelected(id: string, checked: boolean) { setSelected((cur) => checked ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)); }
  function getLoadFn() {
    return async (offset: number, limit: number) => ({
      total: savedVideosList.length,
      items: savedVideosList.slice(offset, offset + limit),
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <div className="mb-2 text-xl font-semibold text-[color:var(--color-foreground)]">{t("views.library.savedVideosTitle")}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => showReset ? reset() : selectAll()}>{showReset ? t("views.library.selectionReset") : t("views.library.selectionSelectAll")}</Button>
          {!showReset ? <Button type="button" variant="secondary" onClick={() => select(50)}>{t("views.library.selectionSelect50")}</Button> : null}
          <div className="relative">
            <Button type="button" onClick={() => setExportMenuOpen((v) => !v)}>{t("views.library.exportSelected", [selected.length])}</Button>
            {exportMenuOpen ? <div className="absolute left-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-xl border border-white/10 bg-slate-950/96 shadow-2xl shadow-slate-950/40">
              <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[color:var(--color-foreground)] hover:bg-white/6" onClick={() => { setInstructionsDialog(true); setExportMenuOpen(false); }}><Icon icon={icons.mdiYoutube} className="h-4 w-4" />{t("views.library.exportYtPlaylist")}</button>
              <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[color:var(--color-foreground)] hover:bg-white/6" onClick={() => { void downloadAsCSV(); setExportMenuOpen(false); }}><Icon icon={mdiFileTable} className="h-4 w-4" />{t("views.library.exportCsv")}</button>
            </div> : null}
          </div>
          <Button type="button" variant="destructive" onClick={() => setDeleteDialog(true)}>{t("views.library.deleteFromLibraryButton", [selected.length])}</Button>
          <Dialog open={deleteDialog} className="max-w-[290px]" onOpenChange={setDeleteDialog}>
            <Card className="space-y-4 p-4">
              <div className="text-base font-semibold text-[color:var(--color-foreground)]">{t("views.library.deleteConfirmation", [selected.length])}</div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDeleteDialog(false)}>{t("views.library.deleteConfirmationCancel")}</Button>
                <Button type="button" variant="destructive" onClick={() => { setDeleteDialog(false); deleteSelected(); }}>{t("views.library.deleteConfirmationOK")}</Button>
              </div>
            </Card>
          </Dialog>
          <Select value={sortModel} options={sortby} className="rounded-xl border border-white/12 bg-slate-950/70 text-sm" onChange={(v) => setSortModel(Number(v))} />
        </div>
      </div>
      {savedVideosList.length > 0 ? <GenericListLoader key={`vl-home-${sortModel}=${savedVideosList.length}`} paginate perPage={50} loadFn={getLoadFn()}>{({ data }) => <VideoCardList videos={data} horizontal includeChannel dense renderAction={(video: any) => <input checked={selected.includes(video.id)} onChange={(e) => toggleSelected(video.id, e.target.checked)} type="checkbox" value={video.id} className="h-4 w-4 rounded border-white/20 bg-slate-950/80" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} />} />}</GenericListLoader> : <div className="text-center">{t("views.library.emptyLibrary")}</div>}
      <Dialog open={instructionsDialog} className={app.isMobile ? "max-w-[90%]" : "max-w-[60vw]"} onOpenChange={setInstructionsDialog}>
        <Card className="space-y-4 p-4">
          <div className="text-lg font-semibold text-[color:var(--color-foreground)]">{t("views.library.exportYTHeading")}</div>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div>
              <p dangerouslySetInnerHTML={{ __html: t("views.library.exportYTExplanation") }} />
              <br />
              <br />
              <p dangerouslySetInnerHTML={{ __html: t("views.library.exportYTInstructions") }} />
              <Button type="button" className="mt-2 mr-2" onClick={exportSelected}>{t("views.library.createYtPlaylistButton", [selected.length])}</Button>
              <Button type="button" variant="ghost" className="mt-2" onClick={() => setInstructionsDialog(false)}>{t("views.library.deleteConfirmationCancel")}</Button>
            </div>
            <div><img src="/img/playlist-instruction.jpg" alt="" /></div>
          </div>
        </Card>
      </Dialog>
    </section>
  );
}
