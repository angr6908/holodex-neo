"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowBigLeft, ArrowBigRight, ClipboardCopy, Download, Files, Edit3, Trash2, Pencil } from "@/lib/icons";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { TL_LANGS } from "@/lib/consts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportToFile } from "@/components/tl/ManagerExportToFile";
import { UploadScript } from "@/components/tl/UploadScript";
import { ImportMchad } from "@/components/tl/ImportMchad";
import { openUserMenu } from "@/lib/browser";
type TlLanguage = (typeof TL_LANGS)[number];
type ModalMode = 0 | 1 | 2 | 3 | 4;

type TlScriptRow = {
  custom_video_id?: string;
  entry_count?: number;
  lang: string;
  title?: string;
  video_id?: string;
};

type VideoExportData = {
  custom_video_id?: string;
  id: string;
  start_actual?: number;
  title: string;
};

export default function TLScriptManagerPage() {
  const t = useTranslations();
  const router = useRouter();
  const app = useAppState();
  const [tlData, setTlData] = useState<TlScriptRow[]>([]);
  const [modalNexus, setModalNexus] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(0);
  const [selectedID, setSelectedID] = useState("");
  const [tlLang, setTlLang] = useState<TlLanguage>(TL_LANGS[0]);
  const [modalText, setModalText] = useState("");
  const [entries, setEntries] = useState<Array<string | number>>([]);
  const [query, setQuery] = useState({ limit: 20, offset: 0 });
  const [newLinkInput, setNewLinkInput] = useState("");
  const [selectedScript, setSelectedScript] = useState<TlScriptRow | undefined>(undefined);
  const [videoData, setVideoData] = useState<VideoExportData | undefined>(undefined);
  const dialogPanelClass = modalMode === 2 ? "max-w-[300px]" : modalMode === 3 ? "max-w-[95vw]" : "max-w-[600px]";
  const pageRange = useMemo(() => `${query.offset + 1} ... ${query.offset + query.limit}`, [query]);
  useEffect(() => { document.title = "TLManager - Holodex"; reloadData(); }, [query.offset]);

  function reloadData() {
    api
      .getTLStats(app.userdata.jwt!, query)
      .then(({ status, data }: { status: number; data: TlScriptRow[] }) => {
        if (status !== 200) return;

        setTlData(data);
        setModalNexus(false);
      })
      .catch(console.error);
  }

  function openTlClient(id = "", customVideoId = "") {
    if (!app.userdata?.user) {
      openUserMenu();
      return;
    }

    router.push(`/scripteditor?video=${encodeURIComponent(customVideoId || `YT_${id}`)}`);
  }

  function deleteClick(id = "", customVideoId = "") {
    const targetId = customVideoId || id;

    setModalNexus(true);
    setModalMode(2);
    setSelectedID(targetId);
    setTimeout(() => reloadDeleteEntries(targetId, tlLang), 0);
  }

  async function downloadClick(id = "", customVideoId = "") {
    if (customVideoId) {
      setVideoData({ id: "custom", custom_video_id: customVideoId, title: customVideoId });
    } else {
      const { status, data } = await api.video(id, tlLang.value);

      if (status === 200) {
        setVideoData({
          id,
          start_actual: Date.parse(data.start_actual || data.available_at),
          title: data.title,
        });
      }
    }

    setModalNexus(true);
    setModalMode(1);
    setSelectedID(customVideoId || id);
  }

  function uploadClick(id = "") {
    api
      .video(id, tlLang.value)
      .then(({ status, data }: any) => {
        if (status !== 200) return;

        setVideoData({
          id,
          start_actual: Date.parse(data.start_actual || data.available_at),
          title: data.title,
        });
        setModalNexus(true);
        setModalMode(0);
        setSelectedID(id);
      })
      .catch(console.error);
  }

  function closeUpload(event: { upload?: boolean }) {
    if (event.upload) reloadData();
    setModalNexus(false);
  }

  function loadNext() {
    if (tlData.length < query.limit) return;

    setTlData([]);
    setQuery((current) => ({ ...current, offset: current.offset + query.limit }));
  }

  function loadPrev() {
    setTlData([]);
    setQuery((current) => ({ ...current, offset: Math.max(0, current.offset - query.limit) }));
  }

  function reloadDeleteEntries(idArg = selectedID, langArg = tlLang) {
    const isCustom = /^https:\/\//i.test(idArg);

    api
      .chatHistory(isCustom ? "custom" : idArg, {
        ...(isCustom && { custom_video_id: idArg }),
        lang: langArg.value,
        verified: 0,
        moderator: 0,
        vtuber: 0,
        limit: 100000,
        mode: 1,
        creator_id: app.userdata.user.id,
      })
      .then(({ status, data }: any) => {
        if (status !== 200) return;

        const next = data.map((entry: { id: string | number }) => entry.id);
        setEntries(next);
        setModalText(`${next.length} entries`);
      })
      .catch(console.error);
  }

  function clearAll() {
    const isCustom = /^https:\/\//i.test(selectedID);
    const processes = entries.map((id) => ({ type: "Delete", data: { id } }));

    api
      .postTLLog({
        ...(isCustom && { custom_video_id: selectedID }),
        videoId: isCustom ? "custom" : selectedID,
        jwt: app.userdata.jwt!,
        body: processes,
        lang: tlLang.value,
      })
      .then(({ status }: { status: number }) => {
        if (status !== 200) return;

        reloadData();
        setModalNexus(false);
      })
      .catch(console.error);
  }

  async function changeLink() {
    if (!selectedScript) return;

    try {
      await api.postChangeLink({
        jwt: app.userdata.jwt!,
        body: {
          oldId: selectedScript.custom_video_id,
          newId: newLinkInput,
          lang: selectedScript.lang,
        },
      });
    } catch (error) {
      alert(`failed ${error}`);
    }

    reloadData();
  }

  function changeDeleteLang(value: string) {
    const next = TL_LANGS.find((item) => item.value === value) || TL_LANGS[0];

    setTlLang(next);
    reloadDeleteEntries(selectedID, next);
  }

  function openChangeLinkDialog(script: TlScriptRow) {
    setModalMode(4);
    setModalNexus(true);
    setNewLinkInput(script.custom_video_id || "");
    setSelectedScript(script);
  }

  function handleDialogOpenChange(open: boolean) {
    if (open) {
      setModalNexus(true);
      return;
    }

    if (modalMode !== 3) {
      setModalNexus(false);
    }
  }

  function renderDialogContent() {
    if (modalMode === 0) {
      return <div className="bg-slate-950"><UploadScript videoData={videoData} onClose={closeUpload} /></div>;
    }

    if (modalMode === 1) {
      return <div className="bg-slate-950"><ExportToFile videoData={videoData} /></div>;
    }

    if (modalMode === 2) {
      return (
        <div className="space-y-5 p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-white">{t("views.tlManager.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <Field className="gap-2">
            <FieldLabel className="text-slate-300">{t("views.tlManager.langPick")}</FieldLabel>
            <Select value={tlLang.value} onValueChange={changeDeleteLang}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TL_LANGS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.text + " (" + item.value + ")"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogDescription className="text-slate-400">{modalText}</DialogDescription>
          <DialogFooter className="flex-row items-center gap-3 sm:justify-start">
            <Button variant="ghost" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button>
            <Button variant="destructive" className="ml-auto" onClick={clearAll}>{t("views.tlManager.delete")}</Button>
          </DialogFooter>
        </div>
      );
    }

    if (modalMode === 3) {
      return <div className="bg-slate-950"><ImportMchad onClose={closeUpload} /></div>;
    }

    return (
      <div className="space-y-5 p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-white">{t("views.tlManager.changeStreamLink")}</DialogTitle>
        </DialogHeader>
        <Field className="gap-2">
          <FieldLabel className="text-slate-300" htmlFor="tl-manager-new-link">{t("views.tlManager.newLink")}</FieldLabel>
          <Input id="tl-manager-new-link" value={newLinkInput} onChange={(event) => setNewLinkInput(event.target.value)} />
        </Field>
        <DialogFooter className="flex-row items-center gap-3 sm:justify-start">
          <Button variant="ghost" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button>
          <Button className="ml-auto" onClick={() => { setModalNexus(false); void changeLink(); }}>{t("views.tlClient.okBtn")}</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <section className="app-page space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary">TLDex</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-white">{t("views.tlManager.title")}</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          {t("views.tlManager.description")}
        </p>
      </header>

      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <Button onClick={() => { setModalNexus(true); setModalMode(3); }}>
            <Files className="size-4" />
            {t("views.tlManager.importFromMchad")}
          </Button>
          <div className="flex items-center gap-2 md:ml-auto">
            <Button variant="outline" size="icon" onClick={loadPrev}>
              <ArrowBigLeft className="size-4" />
            </Button>
            <div className="min-w-[9rem] text-center text-sm text-slate-400">{pageRange}</div>
            <Button variant="outline" size="icon" onClick={loadNext}>
              <ArrowBigRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 max-h-[70vh] overflow-auto rounded-[calc(var(--radius)+6px)] border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t("views.tlManager.headerID")}</TableHead>
                <TableHead>{t("views.tlManager.videoTitle")}</TableHead>
                <TableHead>{t("component.common.language")}</TableHead>
                <TableHead>{t("views.tlManager.headerEntries")}</TableHead>
                <TableHead className="text-right">{t("component.common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tlData.map((script, index) => {
                const scriptId = script.video_id || script.custom_video_id || String(index);
                const scriptHref = script.video_id ? `/watch/${script.video_id}` : script.custom_video_id || "#";

                return (
                  <TableRow key={scriptId}>
                    <TableCell>
                      <Link className="text-sky-300 hover:text-sky-200" href={scriptHref}>
                        {script.video_id || script.custom_video_id}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <div className="truncate">{script.title || script.custom_video_id || t("views.tlManager.noTitle")}</div>
                    </TableCell>
                    <TableCell>{script.lang}</TableCell>
                    <TableCell>{t("views.tlManager.entriesCount", { count: script.entry_count || 0 })}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t("component.videoCard.openScriptEditor")}
                          onClick={() => openTlClient(script.video_id, script.custom_video_id)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {script.video_id ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("component.videoCard.uploadScript")}
                            onClick={() => uploadClick(script.video_id)}
                          >
                            <ClipboardCopy className="size-4" />
                          </Button>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t("views.tlManager.download")}
                          onClick={() => void downloadClick(script.video_id, script.custom_video_id)}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t("views.tlManager.delete")}
                          onClick={() => deleteClick(script.video_id, script.custom_video_id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        {script.custom_video_id ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("views.tlManager.changeCustomLink")}
                            onClick={() => openChangeLinkDialog(script)}
                          >
                            <Edit3 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {tlData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {t("views.tlManager.noScriptsFound")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={modalNexus} onOpenChange={handleDialogOpenChange}>
        <DialogContent className={`${dialogPanelClass} p-0`}>
          {renderDialogContent()}
        </DialogContent>
      </Dialog>
    </section>
  );
}
