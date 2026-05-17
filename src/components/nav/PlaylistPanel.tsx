"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, XIcon, Save, Trash2, FileSpreadsheet, Pencil, ListPlus, RefreshCw, type AnyIcon } from "@/lib/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTranslations } from "next-intl";
import { useAppState } from "@/lib/store";
import { api } from "@/lib/api";
import { MAX_PLAYLIST_LENGTH } from "@/lib/consts";
import { getVideoThumbnails } from "@/lib/functions";
import { dayjs } from "@/lib/time";
import { cn } from "@/lib/utils";
import { downloadCsv, openUserMenu } from "@/lib/browser";
import * as icons from "@/lib/icons";

function HdrBtn({ icon, title, onClick, disabled = false, danger = false }: { icon: AnyIcon; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" disabled={disabled}
      className={cn("size-7 text-[color:var(--color-muted-foreground)]",
        danger ? "hover:bg-rose-500/15 hover:text-rose-400 dark:hover:bg-rose-500/15" : "hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)] dark:hover:bg-[color:var(--surface-soft)]",
        disabled && "disabled:opacity-40")}
      title={title} onClick={onClick}>
      {(() => { const C = icon; return <C className="size-4"  />; })()}
    </Button>
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
  const [playlistEditName, setPlaylistEditName] = useState(false);
  const [playlistLoginWarning, setPlaylistLoginWarning] = useState(false);
  const [playlistYTDialog, setPlaylistYTDialog] = useState(false);
  const [serverPlaylists, setServerPlaylists] = useState<any[]>([]);
  const [serverPlaylistsLoading, setServerPlaylistsLoading] = useState(false);
  const unnamedPlaylistLabel = t("component.playlist.unnamed-playlist");
  const activePlaylistDisplayName = !app.playlistActive?.id && app.playlistActive?.name === "Unnamed Playlist"
    ? unnamedPlaylistLabel
    : app.playlistActive?.name || unnamedPlaylistLabel;
  const [nameInput, setNameInput] = useState(activePlaylistDisplayName);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"above" | "below">(
    "below",
  );
  const playlistCount = app.playlist.length;

  useEffect(() => {
    setNameInput(activePlaylistDisplayName);
  }, [activePlaylistDisplayName]);
  useEffect(() => {
    if (!open) return;
    setPlaylistEditName(false);
    setPlaylistLoginWarning(false);
    void fetchServerPlaylists();
  }, [open]);

  async function fetchServerPlaylists() {
    if (!app.userdata?.jwt || serverPlaylistsLoading) return;
    setServerPlaylistsLoading(true);
    try {
      const { data } = await api.getPlaylistList(app.userdata.jwt);
      setServerPlaylists(data || []);
    } catch {
      setServerPlaylists([]);
    } finally {
      setServerPlaylistsLoading(false);
    }
  }
  function closePanel() {
    onOpenChange(false);
  }
  function commitName(value = nameInput) {
    if (value) app.setPlaylistName(value);
    setPlaylistEditName(false);
  }
  async function saveActivePlaylist() {
    if (!app.userdata?.jwt) {
      setPlaylistLoginWarning(true);
      return;
    }
    setPlaylistLoginWarning(false);
    await app.saveActivePlaylist();
    await fetchServerPlaylists();
  }
  function createNewPlaylist() {
    if (!app.userdata?.jwt) {
      openUserMenu();
      closePanel();
      return;
    }
    if (
      app.playlistIsSaved ||
      confirm(t("views.playlist.change-loss-warning"))
    ) {
      app.resetPlaylist();
      app.markPlaylistModified();
    }
  }
  async function switchPlaylist(playlist: any) {
    if (playlist.id === app.playlistActive?.id) return;
    if (
      app.playlistIsSaved ||
      confirm(t("views.playlist.change-loss-warning"))
    ) {
      await app.setActivePlaylistByID(playlist.id);
      await fetchServerPlaylists();
    }
  }
  async function deleteActivePlaylist() {
    await app.deleteActivePlaylist();
    await fetchServerPlaylists();
  }
  async function downloadPlaylistCSV() {
    if (!app.playlist.length) return;
    const timestamp = new Date().toISOString().replace("T", "_").slice(0, 19);
    await downloadCsv(app.playlist as any[], `holodexPlaylist_${app.playlistActive?.name || "playlist"}_${timestamp}.csv`);
  }
  function exportPlaylistToYT() {
    if (!app.playlist.length) return;
    window.open(
      `https://www.youtube.com/watch_videos?video_ids=${app.playlist.map((x: any) => x.id).join(",")}`,
      "_blank",
      "noopener",
    );
    setPlaylistYTDialog(false);
  }
  const formatPlaylistTime = (ts: string) => { try { return dayjs(ts).format("l"); } catch { return ""; } };

  function handlePointerDown(idx: number, e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    const container = (e.currentTarget as HTMLElement).parentElement;
    if (!container) return;
    const startY = e.clientY;
    const prevUserSelect = document.body.style.userSelect;
    let isDragging = false;
    let fromIdx: number | null = null;
    let overIdx: number | null = null;
    let overPosition: "above" | "below" = "below";

    const setOver = (i: number | null, pos: "above" | "below" = "below") => {
      overIdx = i; overPosition = pos;
      setDragOverIdx(i);
      if (i !== null) setDragOverPosition(pos);
    };

    const onPointerMove = (moveE: PointerEvent) => {
      if (!isDragging) {
        if (Math.abs(moveE.clientY - startY) < 6) return;
        isDragging = true;
        fromIdx = idx;
        setDragFromIdx(idx);
        document.body.style.userSelect = "none";
      }
      moveE.preventDefault();
      const items = Array.from(container.querySelectorAll<HTMLElement>("[data-drag-item]"));
      const hit = items.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return moveE.clientY >= r.top && moveE.clientY <= r.bottom;
      });
      if (hit >= 0) {
        if (hit === fromIdx) setOver(null);
        else {
          const r = items[hit].getBoundingClientRect();
          setOver(hit, moveE.clientY < r.top + r.height / 2 ? "above" : "below");
        }
        return;
      }
      if (!items.length) return;
      const first = items[0].getBoundingClientRect();
      const last = items[items.length - 1].getBoundingClientRect();
      if (moveE.clientY < first.top + first.height / 2) setOver(0, "above");
      else if (moveE.clientY > last.top + last.height / 2) setOver(items.length - 1, "below");
    };

    const onPointerUp = () => {
      if (isDragging && fromIdx !== null && overIdx !== null) {
        const to = overPosition === "above"
          ? (fromIdx > overIdx ? overIdx : overIdx - 1)
          : (fromIdx > overIdx ? overIdx + 1 : overIdx);
        if (to >= 0 && to < app.playlist.length && to !== fromIdx) app.reorderPlaylist({ from: fromIdx, to });
        const endTime = Date.now();
        document.addEventListener("click", (ce) => {
          if (Date.now() - endTime < 150) { ce.stopPropagation(); ce.preventDefault(); }
        }, { capture: true, once: true });
        document.body.style.userSelect = prevUserSelect;
      }
      setDragFromIdx(null);
      setDragOverIdx(null);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  return (
    <>
      <PopoverContent
          align="end"
          sideOffset={8}
          className="z-[160] flex max-h-[min(80vh,640px)] w-[24rem] flex-col overflow-hidden rounded-2xl border-[color:var(--color-border)] bg-[color:var(--surface-nav-solid)] p-0 shadow-2xl"
          onPointerDown={(event) => {
            if (
              playlistEditName &&
              !(event.target as HTMLElement).closest("input")
            )
              commitName();
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="flex min-w-0 shrink flex-col gap-1.5">
              {playlistEditName ? (
                <Input
                  value={nameInput}
                  autoFocus
                  className="h-7 max-w-[10rem] rounded-md border-[color:var(--color-border)] bg-[color:var(--surface-soft)] px-1 py-0 text-sm font-semibold focus:shadow-[none]"
                  onChange={(event) => setNameInput(event.target.value)}
                  onBlur={() => commitName()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Escape")
                      (event.target as HTMLElement).blur();
                  }}
                />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  tabIndex={-1}
                  className="group/name h-7 justify-start gap-1 rounded-md px-1 text-left hover:bg-[color:var(--surface-soft)] dark:hover:bg-[color:var(--surface-soft)]"
                  title={t("component.playlist.menu.rename-playlist")}
                  onClick={() => setPlaylistEditName(true)}
                >
                  <span className="max-w-[10rem] truncate text-sm font-semibold text-[color:var(--color-foreground)]">
                    {activePlaylistDisplayName}
                  </span>
                  <Pencil className="h-3 w-3 shrink-0 text-[color:var(--color-muted-foreground)] opacity-0 transition-opacity group-hover/name:opacity-100" />
                </Button>
              )}
              <div className="flex items-center gap-1.5 px-1 text-xs leading-none text-[color:var(--color-muted-foreground)]">
                {!app.playlistIsSaved ? (
                  <Badge className="inline-flex items-center rounded-full border-amber-400/30 bg-amber-400/15 px-1.5 py-0.5 text-[10px] leading-none text-amber-200">
	                    {t("views.playlist.playlist-is-modified")}
                  </Badge>
                ) : null}
                <span className="leading-none">
                  {playlistCount}/{MAX_PLAYLIST_LENGTH}
                </span>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {!app.playlistIsSaved ? (
                <Button type="button" size="icon-sm" className="size-7 bg-emerald-600 text-white hover:bg-emerald-500" title={t("views.scriptEditor.menu.save")} onClick={saveActivePlaylist}>
                  <Save className="size-4" />
                </Button>
              ) : null}
              <HdrBtn icon={ListPlus} title={t("component.playlist.menu.new-playlist")} onClick={createNewPlaylist} />
              <HdrBtn icon={RefreshCw} title={t("component.playlist.menu.reset-unsaved")} disabled={app.playlistIsSaved || !app.playlistActive?.id} onClick={() => app.playlistActive?.id && app.setActivePlaylistByID(app.playlistActive.id)} />
              <HdrBtn icon={icons.YoutubeIcon} title={t("views.library.exportYtPlaylist")} disabled={!playlistCount} onClick={() => { setPlaylistYTDialog(true); closePanel(); }} />
              <HdrBtn icon={FileSpreadsheet} title={t("views.library.exportCsv")} disabled={!playlistCount} onClick={() => void downloadPlaylistCSV()} />
              <HdrBtn icon={Trash2} title={app.playlistActive?.id ? t("component.playlist.menu.delete-playlist") : t("component.playlist.menu.clear-playlist")} danger onClick={() => void deleteActivePlaylist()} />
            </div>
          </div>
          <Separator className="bg-[color:var(--color-border)]" />
          {playlistLoginWarning ? (
            <Alert className="mx-3 mt-2 flex items-center gap-3 border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <AlertDescription className="block flex-1 text-xs leading-normal text-amber-100">
                {t("component.playlist.save-error-not-logged-in")}
              </AlertDescription>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  openUserMenu();
                  setPlaylistLoginWarning(false);
                  closePanel();
                }}
              >
                {t("component.mainNav.login")}
              </Button>
            </Alert>
          ) : null}
          {playlistCount ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-0.5 p-1.5">
                {app.playlist.map((video: any, idx: number) => (
                  <div
                    key={`${video.id || "video"}-${idx}`}
                    data-drag-item
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md p-1.5 transition-colors select-none hover:bg-[color:var(--surface-soft)]",
                      dragFromIdx === idx && "opacity-30",
                      dragFromIdx !== null ? "cursor-grabbing" : "cursor-grab",
                    )}
                    onPointerDown={(event) => handlePointerDown(idx, event)}
                    onDragStart={(event) => event.preventDefault()}
                  >
                    {dragOverIdx === idx &&
                    dragFromIdx !== null &&
                    dragFromIdx !== idx ? (
                      <div
                        className={cn(
                          "pointer-events-none absolute left-2 right-2 h-0.5 rounded-full bg-[color:var(--color-primary)]",
                          dragOverPosition === "above"
                            ? "-top-px"
                            : "-bottom-px",
                        )}
                      />
                    ) : null}
                    <Link
                      href={`/watch/${video.id}?playlist=${app.playlistActive?.id || "local"}`}
                      className="relative shrink-0 overflow-hidden rounded-md"
                      onClick={closePanel}
                    >
                      <img
                        src={getVideoThumbnails(video.id, false).default}
                        alt={video.title || video.id}
                        className="h-[3.2rem] w-[5.7rem] object-cover"
                        loading="lazy"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/watch/${video.id}?playlist=${app.playlistActive?.id || "local"}`}
                        className="line-clamp-2 text-xs font-medium leading-snug text-[color:var(--color-foreground)] hover:underline"
                        onClick={closePanel}
                      >
                        {video.title || video.id}
                      </Link>
                      {video.channel?.name ? (
                        <span className="mt-0.5 block truncate text-[11px] text-[color:var(--color-muted-foreground)]">
                          {video.channel.english_name || video.channel.name}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-6 self-center text-[color:var(--color-muted-foreground)] opacity-0 transition hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100 dark:hover:bg-rose-500/15"
                      title={t("component.videoCard.removeFromPlaylist")}
                      onClick={(event) => {
                        event.stopPropagation();
                        app.removeFromPlaylistByIndex(idx);
                      }}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty className="flex-none gap-0 rounded-none p-0 px-3 py-8 text-xs text-[color:var(--color-muted-foreground)] md:p-0 md:px-3 md:py-8">
              <EmptyDescription className="text-xs leading-normal text-[color:var(--color-muted-foreground)]">
                {t("views.playlist.page-instruction")}
              </EmptyDescription>
            </Empty>
          )}
          {serverPlaylists.length > 0 ? (
            <>
              <Separator className="bg-[color:var(--color-border)]" />
              <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
                {t("views.playlist.page-heading")}
              </div>
              <ScrollArea className="max-h-[160px]">
                <ToggleGroup value={app.playlistActive?.id ? [app.playlistActive.id] : []} onValueChange={(value) => { const playlist = serverPlaylists.find((pl) => pl.id === value[0]); if (playlist) void switchPlaylist(playlist); }} className="flex w-full flex-col items-stretch px-1 pb-1">
                  {serverPlaylists.map((pl) => (
                    <ToggleGroupItem
                      key={pl.id}
                      value={pl.id}
                      size="sm"
                      className="h-auto w-full justify-start gap-2 px-2.5 py-2 text-left transition-colors data-[state=on]:font-medium data-[state=on]:text-[color:var(--color-primary)] data-[state=off]:font-normal data-[state=off]:text-[color:var(--color-foreground)] hover:bg-[color:var(--surface-soft)] dark:hover:bg-[color:var(--surface-soft)]"
                    >
                      {pl.id === app.playlistActive?.id ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : (
                        <span className="h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px]">
                            {pl.name}
                          </span>
                          {pl.id === app.playlistActive?.id &&
                          !app.playlistIsSaved ? (
                            <Badge className="shrink-0 rounded-full border-amber-400/30 bg-amber-400/15 px-1.5 py-px text-[9px] text-amber-200">
                              {t("views.playlist.playlist-is-modified")}
                            </Badge>
                          ) : null}
                        </div>
                        <span className="block text-[10px] text-[color:var(--color-muted-foreground)]">
	                          {t("component.playlist.video-count", {
	                            count: (pl.video_ids || pl.videos || []).length,
	                          })}
                          {pl.updated_at
                            ? ` · ${formatPlaylistTime(pl.updated_at)}`
                            : ""}
                        </span>
                      </div>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </ScrollArea>
            </>
          ) : null}
        </PopoverContent>
      <Dialog
        open={playlistYTDialog}
        onOpenChange={setPlaylistYTDialog}
      >
        <DialogContent className="max-w-[90%] p-0 md:max-w-[60vw]">
          <Card className="p-5">
            <DialogTitle className="text-lg font-semibold leading-7 text-[color:var(--color-foreground)]">
              {t("views.library.exportYTHeading")}
            </DialogTitle>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="text-sm text-[color:var(--color-muted-foreground)]">
                <p
                  dangerouslySetInnerHTML={{
                    __html: t.raw("views.library.exportYTExplanation"),
                  }}
                />
                <br />
                <p
                  dangerouslySetInnerHTML={{
                    __html: t.raw("views.library.exportYTInstructions"),
                  }}
                />
                <DialogFooter className="mt-4 flex-row flex-wrap justify-start gap-2 sm:justify-start">
                  <Button
                    type="button"
                    className="bg-emerald-600 text-white hover:brightness-110"
                    onClick={exportPlaylistToYT}
                  >
                    {t("views.library.createYtPlaylistButton", { arg0: playlistCount })}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPlaylistYTDialog(false)}
                  >
                    {t("views.library.deleteConfirmationCancel")}
                  </Button>
                </DialogFooter>
              </div>
              <img src="/img/playlist-instruction.jpg" alt="" className="max-w-full rounded-xl" />
            </div>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
}
