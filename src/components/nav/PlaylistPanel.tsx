"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { downloadCsv, openUserMenu } from "@/lib/browser";
import { MAX_PLAYLIST_LENGTH } from "@/lib/consts";
import { getVideoThumbnails } from "@/lib/functions";
import * as icons from "@/lib/icons";
import {
  Check,
  FileSpreadsheet,
  ListPlus,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  XIcon,
} from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { dayjs } from "@/lib/time";
import { cn } from "@/lib/utils";

function playlistDisplayName(active: any, unnamed: string) {
  if (!active?.id && active?.name === "Unnamed Playlist") return unnamed;
  return active?.name || unnamed;
}

function formatPlaylistDate(ts: string) {
  try {
    return dayjs(ts).format("l");
  } catch {
    return "";
  }
}

// Where a dragged item lands, given the hovered item and which half of it the pointer is in.
function dropIndex(pos: "above" | "below", fromIdx: number, overIdx: number) {
  if (pos === "above") return fromIdx > overIdx ? overIdx : overIdx - 1;
  return fromIdx > overIdx ? overIdx + 1 : overIdx;
}

function PlaylistName({
  editing,
  name,
  value,
  onChange,
  onCommit,
  onEdit,
}: {
  editing: boolean;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations();
  if (editing)
    return (
      <Input
        value={value}
        autoFocus
        className="max-w-[10rem]"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit()}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLElement).blur();
        }}
      />
    );
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      tabIndex={-1}
      className="group/name justify-start text-left"
      title={t("component.playlist.menu.rename-playlist")}
      onClick={onEdit}
    >
      <span className="max-w-[10rem] truncate text-sm font-normal text-foreground">{name}</span>
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
    </Button>
  );
}

function PlaylistActions({
  saved,
  activeId,
  count,
  onSave,
  onCreate,
  onReset,
  onExportYoutube,
  onExportCsv,
  onDelete,
}: {
  saved: boolean;
  activeId?: string;
  count: number;
  onSave: () => void;
  onCreate: () => void;
  onReset: () => void;
  onExportYoutube: () => void;
  onExportCsv: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      {!saved ? (
        <Button
          type="button"
          size="icon-sm"
          title={t("views.scriptEditor.menu.save")}
          onClick={onSave}
        >
          <Save className="size-4" />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={t("component.playlist.menu.new-playlist")}
        onClick={onCreate}
      >
        <ListPlus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={t("component.playlist.menu.reset-unsaved")}
        disabled={saved || !activeId}
        onClick={onReset}
      >
        <RefreshCw className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={t("views.library.exportYtPlaylist")}
        disabled={!count}
        onClick={onExportYoutube}
      >
        <icons.YoutubeIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={t("views.library.exportCsv")}
        disabled={!count}
        onClick={onExportCsv}
      >
        <FileSpreadsheet className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={
          activeId
            ? t("component.playlist.menu.delete-playlist")
            : t("component.playlist.menu.clear-playlist")
        }
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

// The active playlist's videos; drag a row (pointer, not HTML5 drag) to reorder.
function PlaylistItems({ onNavigate }: { onNavigate: () => void }) {
  const app = useAppState();
  const t = useTranslations();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<"above" | "below">("below");
  const playlistId = app.playlistActive?.id || "local";

  function pointerDown(idx: number, e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    const container = (e.currentTarget as HTMLElement).parentElement;
    if (!container) return;
    const startY = e.clientY;
    const prevSelect = document.body.style.userSelect;
    let dragging = false,
      fromIdx: number | null = null,
      overIdx: number | null = null,
      pos: "above" | "below" = "below";

    const setOver = (i: number | null, p: "above" | "below" = "below") => {
      overIdx = i;
      pos = p;
      setDragOver(i);
      if (i !== null) setDragPos(p);
    };

    const move = (me: PointerEvent) => {
      if (!dragging) {
        if (Math.abs(me.clientY - startY) < 6) return;
        dragging = true;
        fromIdx = idx;
        setDragFrom(idx);
        document.body.style.userSelect = "none";
      }
      me.preventDefault();
      const items = [...container.querySelectorAll<HTMLElement>("[data-drag-item]")];
      const hit = items.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return me.clientY >= r.top && me.clientY <= r.bottom;
      });
      if (hit >= 0) {
        if (hit === fromIdx) setOver(null);
        else {
          const r = items[hit].getBoundingClientRect();
          setOver(hit, me.clientY < r.top + r.height / 2 ? "above" : "below");
        }
        return;
      }
      if (!items.length) return;
      const first = items[0].getBoundingClientRect(),
        last = items[items.length - 1].getBoundingClientRect();
      if (me.clientY < first.top + first.height / 2) setOver(0, "above");
      else if (me.clientY > last.top + last.height / 2) setOver(items.length - 1, "below");
    };

    const up = () => {
      if (dragging && fromIdx !== null && overIdx !== null) {
        const to = dropIndex(pos, fromIdx, overIdx);
        if (to >= 0 && to < app.playlist.length && to !== fromIdx)
          app.reorderPlaylist({ from: fromIdx, to });
        const end = Date.now();
        document.addEventListener(
          "click",
          (ce) => {
            if (Date.now() - end < 150) {
              ce.stopPropagation();
              ce.preventDefault();
            }
          },
          { capture: true, once: true },
        );
        document.body.style.userSelect = prevSelect;
      }
      setDragFrom(null);
      setDragOver(null);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="flex flex-col gap-0.5 p-1.5">
        {app.playlist.map((v: any, idx: number) => (
          <div
            key={v.id}
            data-drag-item
            className={cn(
              "group relative flex items-center gap-2.5 rounded-md p-1.5 transition-colors select-none hover:bg-muted",
              dragFrom === idx && "opacity-30",
              dragFrom !== null ? "cursor-grabbing" : "cursor-grab",
            )}
            onPointerDown={(e) => pointerDown(idx, e)}
            onDragStart={(e) => e.preventDefault()}
          >
            {dragOver === idx && dragFrom !== null && dragFrom !== idx ? (
              <div
                className={cn(
                  "pointer-events-none absolute left-2 right-2 h-0.5 rounded-full bg-primary",
                  dragPos === "above" ? "-top-px" : "-bottom-px",
                )}
              />
            ) : null}
            <Link
              href={`/watch/${v.id}?playlist=${playlistId}`}
              className="relative shrink-0 overflow-hidden rounded-md"
              onClick={onNavigate}
            >
              <img
                src={getVideoThumbnails(v.id, false).default}
                alt={v.title || v.id}
                className="h-[3.2rem] w-[5.7rem] object-cover"
                loading="lazy"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/watch/${v.id}?playlist=${playlistId}`}
                className="line-clamp-2 text-xs font-medium leading-snug text-foreground hover:underline"
                onClick={onNavigate}
              >
                {v.title || v.id}
              </Link>
              {v.channel?.name ? (
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {v.channel.english_name || v.channel.name}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="self-center opacity-0 group-hover:opacity-100"
              title={t("component.videoCard.removeFromPlaylist")}
              onClick={(e) => {
                e.stopPropagation();
                app.removeFromPlaylistByIndex(idx);
              }}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// The signed-in user's saved playlists; picking one makes it active.
function ServerPlaylists({
  playlists,
  onSwitch,
}: {
  playlists: any[];
  onSwitch: (playlist: any) => void;
}) {
  const app = useAppState();
  const t = useTranslations();
  const activeId = app.playlistActive?.id;
  return (
    <>
      <Separator />
      <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {t("views.playlist.page-heading")}
      </div>
      <ScrollArea className="max-h-[160px]">
        <ToggleGroup
          value={activeId ? [activeId] : []}
          onValueChange={(v) => {
            const pl = playlists.find((p) => p.id === v[0]);
            if (pl) onSwitch(pl);
          }}
          className="flex w-full flex-col items-stretch px-1 pb-1"
        >
          {playlists.map((pl) => (
            <ToggleGroupItem
              key={pl.id}
              value={pl.id}
              size="sm"
              className="h-auto w-full justify-start gap-2 px-2.5 py-2 text-left"
            >
              {pl.id === activeId ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <span className="h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px]">{pl.name}</span>
                  {pl.id === activeId && !app.playlistIsSaved ? (
                    <Badge variant="secondary">{t("views.playlist.playlist-is-modified")}</Badge>
                  ) : null}
                </div>
                <span className="block text-[10px] text-muted-foreground">
                  {t("component.playlist.video-count", {
                    count: (pl.video_ids || pl.videos || []).length,
                  })}
                  {pl.updated_at ? ` · ${formatPlaylistDate(pl.updated_at)}` : ""}
                </span>
              </div>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </ScrollArea>
    </>
  );
}

function YoutubeExportDialog({
  open,
  onOpenChange,
  count,
  onExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onExport: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90%] md:max-w-[60vw]">
        <DialogTitle>{t("views.library.exportYTHeading")}</DialogTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="text-sm text-muted-foreground">
            <p dangerouslySetInnerHTML={{ __html: t.raw("views.library.exportYTExplanation") }} />
            <br />
            <p dangerouslySetInnerHTML={{ __html: t.raw("views.library.exportYTInstructions") }} />
            <DialogFooter className="mt-4 flex-row flex-wrap justify-start gap-2 sm:justify-start">
              <Button type="button" onClick={onExport}>
                {t("views.library.createYtPlaylistButton", { arg0: count })}
              </Button>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("views.library.deleteConfirmationCancel")}
              </Button>
            </DialogFooter>
          </div>
          <img src="/img/playlist-instruction.jpg" alt="" className="max-w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PlaylistPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const app = useAppState();
  const t = useTranslations();
  const [editName, setEditName] = useState(false);
  const [loginWarn, setLoginWarn] = useState(false);
  const [ytDialog, setYtDialog] = useState(false);
  const [serverPls, setServerPls] = useState<any[]>([]);
  // Guards against overlapping list requests; only read by handlers.
  const serverLoading = useRef(false);
  const unnamed = t("component.playlist.unnamed-playlist");
  const activeName = playlistDisplayName(app.playlistActive, unnamed);
  const [nameInput, setNameInput] = useState(activeName);
  // Reset the name field when the active playlist's name changes, and the transient UI each
  // time the panel opens (adjusted during render rather than in effects).
  const [syncedName, setSyncedName] = useState(activeName);
  if (syncedName !== activeName) {
    setSyncedName(activeName);
    setNameInput(activeName);
  }
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setEditName(false);
      setLoginWarn(false);
    }
  }
  const count = app.playlist.length;

  const refreshServerPlaylists = useEffectEvent(() => {
    void fetchServer();
  });
  useEffect(() => {
    if (open) refreshServerPlaylists();
  }, [open]);

  async function fetchServer() {
    if (!app.userdata?.jwt || serverLoading.current) return;
    serverLoading.current = true;
    try {
      const { data } = await api.getPlaylistList(app.userdata.jwt);
      setServerPls(data || []);
    } catch {
      setServerPls([]);
    } finally {
      serverLoading.current = false;
    }
  }

  const closePanel = () => onOpenChange(false);
  const commitName = (v = nameInput) => {
    if (v) app.setPlaylistName(v);
    setEditName(false);
  };

  async function saveActive() {
    if (!app.userdata?.jwt) {
      setLoginWarn(true);
      return;
    }
    setLoginWarn(false);
    await app.saveActivePlaylist();
    await fetchServer();
  }

  function createNew() {
    if (!app.userdata?.jwt) {
      openUserMenu();
      closePanel();
      return;
    }
    if (app.playlistIsSaved || confirm(t("views.playlist.change-loss-warning"))) {
      app.resetPlaylist();
      app.markPlaylistModified();
    }
  }

  async function switchPl(pl: any) {
    if (pl.id === app.playlistActive?.id) return;
    if (app.playlistIsSaved || confirm(t("views.playlist.change-loss-warning"))) {
      await app.setActivePlaylistByID(pl.id);
      await fetchServer();
    }
  }

  async function deleteActive() {
    await app.deleteActivePlaylist();
    await fetchServer();
  }

  async function downloadCSV() {
    if (!app.playlist.length) return;
    const ts = new Date().toISOString().replace("T", "_").slice(0, 19);
    await downloadCsv(
      app.playlist as any[],
      `holodexPlaylist_${app.playlistActive?.name || "playlist"}_${ts}.csv`,
    );
  }

  function exportYT() {
    if (!app.playlist.length) return;
    window.open(
      `https://www.youtube.com/watch_videos?video_ids=${app.playlist.map((x: any) => x.id).join(",")}`,
      "_blank",
      "noopener",
    );
    setYtDialog(false);
  }

  return (
    <>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex max-h-[min(80dvh,40rem)] w-[min(92vw,24rem)] flex-col overflow-hidden p-0"
        onPointerDown={(e) => {
          if (editName && !(e.target as HTMLElement).closest("input")) commitName();
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="flex min-w-0 shrink flex-col gap-1.5">
            <PlaylistName
              editing={editName}
              name={activeName}
              value={nameInput}
              onChange={setNameInput}
              onCommit={() => commitName()}
              onEdit={() => setEditName(true)}
            />
            <div className="flex items-center gap-1.5 px-1 text-xs leading-none text-muted-foreground">
              {!app.playlistIsSaved ? (
                <Badge variant="secondary">{t("views.playlist.playlist-is-modified")}</Badge>
              ) : null}
              <span className="leading-none">
                {count}/{MAX_PLAYLIST_LENGTH}
              </span>
            </div>
          </div>
          <PlaylistActions
            saved={app.playlistIsSaved}
            activeId={app.playlistActive?.id}
            count={count}
            onSave={saveActive}
            onCreate={createNew}
            onReset={() =>
              app.playlistActive?.id && app.setActivePlaylistByID(app.playlistActive.id)
            }
            onExportYoutube={() => {
              setYtDialog(true);
              closePanel();
            }}
            onExportCsv={() => void downloadCSV()}
            onDelete={() => void deleteActive()}
          />
        </div>
        <Separator />
        {loginWarn ? (
          <Alert className="mx-3 mt-2">
            <AlertDescription>{t("component.playlist.save-error-not-logged-in")}</AlertDescription>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                openUserMenu();
                setLoginWarn(false);
                closePanel();
              }}
            >
              {t("component.mainNav.login")}
            </Button>
          </Alert>
        ) : null}
        {count ? (
          <PlaylistItems onNavigate={closePanel} />
        ) : (
          <Empty className="flex-none px-3 py-8">
            <EmptyDescription>{t("views.playlist.page-instruction")}</EmptyDescription>
          </Empty>
        )}
        {serverPls.length > 0 ? (
          <ServerPlaylists playlists={serverPls} onSwitch={(pl) => void switchPl(pl)} />
        ) : null}
      </PopoverContent>
      <YoutubeExportDialog
        open={ytDialog}
        onOpenChange={setYtDialog}
        count={count}
        onExport={exportYT}
      />
    </>
  );
}
