"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { VideoCardList } from "@/components/video/VideoCardList";
import { downloadCsv } from "@/lib/browser";
import * as icons from "@/lib/icons";
import { Table } from "@/lib/icons";
import { useAppState } from "@/lib/store";

const SORT_OPTIONS = [
  { cat: "added_at", asc: -1 },
  { cat: "added_at", asc: 1 },
  { cat: "available_at", asc: -1 },
  { cat: "available_at", asc: 1 },
];

export default function LibraryPage() {
  const app = useAppState();
  const t = useTranslations();
  const [savedVideos, setSavedVideos] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [instructionsDialog, setInstructionsDialog] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [sortModel, setSortModel] = useState(0);
  useEffect(() => {
    document.title = `${t("component.mainNav.library")} - Holodex`;
  }, [t]);
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
  const showReset = selected.length > 0;
  function selectAll() {
    setSelected(savedVideosList.map((v: any) => v.id));
  }
  function select(n: number) {
    setSelected(savedVideosList.slice(0, n).map((v: any) => v.id));
  }
  function reset() {
    setSelected([]);
  }
  function deleteSelected() {
    setSavedVideos((current) => {
      const next = { ...current };
      selected.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    reset();
  }
  function exportSelected() {
    if (!selected.length) return;
    window.open(
      `https://www.youtube.com/watch_videos?video_ids=${selected.join(",")}`,
      "_blank",
      "noopener",
    );
    reset();
  }
  async function downloadAsCSV() {
    const selectedSet = new Set(selected);
    const timestamp = new Date().toISOString().replace("T", "_").slice(0, 19);
    await downloadCsv(
      savedVideosList.filter((v: any) => selectedSet.has(v.id)) as any[],
      `holodexPlaylist_${timestamp}.csv`,
    );
  }
  function toggleSelected(id: string, checked: boolean) {
    setSelected((cur) => (checked ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)));
  }
  const loadFn = useCallback(
    async (offset: number, limit: number) => ({
      total: savedVideosList.length,
      items: savedVideosList.slice(offset, offset + limit),
    }),
    [savedVideosList],
  );

  return (
    <section className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-10 pt-[var(--nav-total-height,120px)] sm:px-5 space-y-4">
      <div>
        <div className="mb-2 text-xl font-normal text-foreground">
          {t("views.library.savedVideosTitle")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => (showReset ? reset() : selectAll())}
          >
            {showReset ? t("views.library.selectionReset") : t("views.library.selectionSelectAll")}
          </Button>
          {!showReset ? (
            <Button type="button" variant="secondary" onClick={() => select(50)}>
              {t("views.library.selectionSelect50")}
            </Button>
          ) : null}
          <DropdownMenu open={exportMenuOpen} onOpenChange={setExportMenuOpen}>
            <DropdownMenuTrigger render={<Button type="button" />}>
              {t("views.library.exportSelected", { arg0: selected.length })}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => setInstructionsDialog(true)}>
                <icons.YoutubeIcon className="h-4 w-4" />
                {t("views.library.exportYtPlaylist")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void downloadAsCSV()}>
                <Table className="h-4 w-4" />
                {t("views.library.exportCsv")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant="destructive" onClick={() => setDeleteDialog(true)}>
            {t("views.library.deleteFromLibraryButton", { arg0: selected.length })}
          </Button>
          <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
            <AlertDialogContent className="max-w-[290px] p-4 sm:max-w-[290px]">
              <AlertDialogHeader className="place-items-start text-left">
                <AlertDialogTitle className="text-base text-foreground">
                  {t("views.library.deleteConfirmation", { arg0: selected.length })}
                </AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row justify-end">
                <AlertDialogCancel variant="ghost">
                  {t("views.library.deleteConfirmationCancel")}
                </AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={deleteSelected}>
                  {t("views.library.deleteConfirmationOK")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Select value={String(sortModel)} onValueChange={(value) => setSortModel(Number(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortby.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {savedVideosList.length > 0 ? (
        <GenericListLoader
          cacheKey={`vl-home-${sortModel}-${savedVideosList.length}`}
          paginate
          perPage={50}
          loadFn={loadFn}
        >
          {({ data }) => (
            <VideoCardList
              videos={data}
              horizontal
              includeChannel
              dense
              renderAction={(video: any) => (
                <Checkbox
                  checked={selected.includes(video.id)}
                  onCheckedChange={(checked) => toggleSelected(video.id, checked === true)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            />
          )}
        </GenericListLoader>
      ) : (
        <Empty className="flex-none gap-0 p-0 md:p-0">{t("views.library.emptyLibrary")}</Empty>
      )}
      <Dialog open={instructionsDialog} onOpenChange={setInstructionsDialog}>
        <DialogContent className={`${app.isMobile ? "max-w-[90%]" : "max-w-[60vw]"} p-4`}>
          <DialogTitle className="text-lg leading-7 text-foreground">
            {t("views.library.exportYTHeading")}
          </DialogTitle>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div>
              <p dangerouslySetInnerHTML={{ __html: t.raw("views.library.exportYTExplanation") }} />
              <br />
              <br />
              <p
                dangerouslySetInnerHTML={{ __html: t.raw("views.library.exportYTInstructions") }}
              />
              <Button type="button" className="mt-2 mr-2" onClick={exportSelected}>
                {t("views.library.createYtPlaylistButton", { arg0: selected.length })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="mt-2"
                onClick={() => setInstructionsDialog(false)}
              >
                {t("views.library.deleteConfirmationCancel")}
              </Button>
            </div>
            <div>
              <img src="/img/playlist-instruction.jpg" alt="" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
