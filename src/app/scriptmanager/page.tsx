"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ImportMchad } from "@/components/tl/ImportMchad";
import { ExportToFile } from "@/components/tl/ManagerExportToFile";
import { UploadScript } from "@/components/tl/UploadScript";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { openUserMenu } from "@/lib/browser";
import { TL_LANGS } from "@/lib/consts";
import {
  ArrowBigLeft,
  ArrowBigRight,
  ClipboardCopy,
  Download,
  Edit3,
  Files,
  Pencil,
  Trash2,
} from "@/lib/icons";
import { useAppState } from "@/lib/store";

type Lang = (typeof TL_LANGS)[number];
type Mode = 0 | 1 | 2 | 3 | 4;
type Row = {
  custom_video_id?: string;
  entry_count?: number;
  lang: string;
  title?: string;
  video_id?: string;
};
type VideoExport = { custom_video_id?: string; id: string; start_actual?: number; title: string };

export default function TLScriptManagerPage() {
  const t = useTranslations();
  const router = useRouter();
  const app = useAppState();
  const [tlData, setTlData] = useState<Row[]>([]);
  const [modal, setModal] = useState(false);
  const [mode, setMode] = useState<Mode>(0);
  // The script a dialog acts on, its delete-able entry ids and the script whose link is being
  // changed; only read by handlers, so they live in refs.
  const selectedID = useRef("");
  const [lang, setLang] = useState<Lang>(TL_LANGS[0]);
  const [modalText, setModalText] = useState("");
  const deleteEntries = useRef<Array<string | number>>([]);
  const [query, setQuery] = useState({ limit: 20, offset: 0 });
  const [newLink, setNewLink] = useState("");
  const selScript = useRef<Row | undefined>(undefined);
  const [videoData, setVideoData] = useState<VideoExport | undefined>();
  const panelClass = mode === 2 ? "max-w-[300px]" : mode === 3 ? "max-w-[95vw]" : "max-w-[600px]";
  const pageRange = useMemo(() => `${query.offset + 1} ... ${query.offset + query.limit}`, [query]);
  const loadPage = useEffectEvent(() => reloadData());
  useEffect(() => {
    document.title = "TLManager - Holodex";
    loadPage();
  }, [query.offset]);

  function reloadData() {
    api
      .getTLStats(app.userdata.jwt!, query)
      .then(({ status, data }: { status: number; data: Row[] }) => {
        if (status !== 200) return;
        setTlData(data);
        setModal(false);
      })
      .catch(console.error);
  }

  function openTlClient(id = "", customId = "") {
    if (!app.userdata?.user) return openUserMenu();
    router.push(`/scripteditor?video=${encodeURIComponent(customId || `YT_${id}`)}`);
  }

  function deleteClick(id = "", customId = "") {
    const target = customId || id;
    setModal(true);
    setMode(2);
    selectedID.current = target;
    setTimeout(() => reloadDeleteEntries(target, lang), 0);
  }

  async function downloadClick(id = "", customId = "") {
    if (customId) setVideoData({ id: "custom", custom_video_id: customId, title: customId });
    else {
      const { status, data } = await api.video(id, lang.value);
      if (status === 200)
        setVideoData({
          id,
          start_actual: Date.parse(data.start_actual || data.available_at),
          title: data.title,
        });
    }
    setModal(true);
    setMode(1);
    selectedID.current = customId || id;
  }

  function uploadClick(id = "") {
    api
      .video(id, lang.value)
      .then(({ status, data }: any) => {
        if (status !== 200) return;
        setVideoData({
          id,
          start_actual: Date.parse(data.start_actual || data.available_at),
          title: data.title,
        });
        setModal(true);
        setMode(0);
        selectedID.current = id;
      })
      .catch(console.error);
  }

  function closeUpload(e: { upload?: boolean }) {
    if (e.upload) reloadData();
    setModal(false);
  }

  const loadNext = () => {
    if (tlData.length >= query.limit) {
      setTlData([]);
      setQuery((q) => ({ ...q, offset: q.offset + q.limit }));
    }
  };
  const loadPrev = () => {
    setTlData([]);
    setQuery((q) => ({ ...q, offset: Math.max(0, q.offset - q.limit) }));
  };

  function reloadDeleteEntries(id: string, lg: Lang) {
    const isCustom = /^https:\/\//i.test(id);
    api
      .chatHistory(isCustom ? "custom" : id, {
        ...(isCustom && { custom_video_id: id }),
        lang: lg.value,
        verified: 0,
        moderator: 0,
        vtuber: 0,
        limit: 100000,
        mode: 1,
        creator_id: app.userdata.user.id,
      })
      .then(({ status, data }: any) => {
        if (status !== 200) return;
        const next = data.map((e: { id: string | number }) => e.id);
        deleteEntries.current = next;
        setModalText(`${next.length} entries`);
      })
      .catch(console.error);
  }

  function clearAll() {
    const id = selectedID.current;
    const isCustom = /^https:\/\//i.test(id);
    api
      .postTLLog({
        ...(isCustom && { custom_video_id: id }),
        videoId: isCustom ? "custom" : id,
        jwt: app.userdata.jwt!,
        body: deleteEntries.current.map((entryId) => ({ type: "Delete", data: { id: entryId } })),
        lang: lang.value,
      })
      .then(({ status }) => {
        if (status === 200) {
          reloadData();
          setModal(false);
        }
      })
      .catch(console.error);
  }

  async function changeLink() {
    const script = selScript.current;
    if (!script) return;
    try {
      await api.postChangeLink({
        jwt: app.userdata.jwt!,
        body: { oldId: script.custom_video_id, newId: newLink, lang: script.lang },
      });
    } catch (e) {
      alert(`failed ${e}`);
    }
    reloadData();
  }

  function changeDeleteLang(v: string) {
    const next = TL_LANGS.find((i) => i.value === v) || TL_LANGS[0];
    setLang(next);
    reloadDeleteEntries(selectedID.current, next);
  }

  function openChangeLink(s: Row) {
    setMode(4);
    setModal(true);
    setNewLink(s.custom_video_id || "");
    selScript.current = s;
  }

  const renderDialog = () => {
    if (mode === 0)
      return (
        <UploadScript
          key={videoData?.custom_video_id || videoData?.id}
          videoData={videoData}
          onClose={closeUpload}
        />
      );
    if (mode === 1) return <ExportToFile videoData={videoData} />;
    if (mode === 3) return <ImportMchad onClose={closeUpload} />;
    if (mode === 2)
      return (
        <div className="space-y-5 p-6">
          <DialogHeader className="text-left">
            <DialogTitle>{t("views.tlManager.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <Field className="gap-2">
            <FieldLabel>{t("views.tlManager.langPick")}</FieldLabel>
            <Select value={lang.value} onValueChange={changeDeleteLang}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TL_LANGS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {`${i.text} (${i.value})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogDescription>{modalText}</DialogDescription>
          <DialogFooter className="flex-row items-center gap-3 sm:justify-start">
            <Button variant="ghost" onClick={() => setModal(false)}>
              {t("views.tlClient.cancelBtn")}
            </Button>
            <Button variant="destructive" className="ml-auto" onClick={clearAll}>
              {t("views.tlManager.delete")}
            </Button>
          </DialogFooter>
        </div>
      );
    return (
      <div className="space-y-5 p-6">
        <DialogHeader className="text-left">
          <DialogTitle>{t("views.tlManager.changeStreamLink")}</DialogTitle>
        </DialogHeader>
        <Field className="gap-2">
          <FieldLabel htmlFor="new-link">{t("views.tlManager.newLink")}</FieldLabel>
          <Input id="new-link" value={newLink} onChange={(e) => setNewLink(e.target.value)} />
        </Field>
        <DialogFooter className="flex-row items-center gap-3 sm:justify-start">
          <Button variant="ghost" onClick={() => setModal(false)}>
            {t("views.tlClient.cancelBtn")}
          </Button>
          <Button
            className="ml-auto"
            onClick={() => {
              setModal(false);
              void changeLink();
            }}
          >
            {t("views.tlClient.okBtn")}
          </Button>
        </DialogFooter>
      </div>
    );
  };

  return (
    <section className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-10 pt-(--nav-total-height,120px) sm:px-5 space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary">TLDex</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{t("views.tlManager.title")}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("views.tlManager.description")}
        </p>
      </header>

      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <Button
            onClick={() => {
              setModal(true);
              setMode(3);
            }}
          >
            <Files className="size-4" />
            {t("views.tlManager.importFromMchad")}
          </Button>
          <div className="flex items-center gap-2 md:ml-auto">
            <Button variant="outline" size="icon" onClick={loadPrev}>
              <ArrowBigLeft className="size-4" />
            </Button>
            <div className="min-w-[9rem] text-center text-sm text-muted-foreground">
              {pageRange}
            </div>
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
              {tlData.map((s) => {
                const sid = s.video_id || s.custom_video_id || "";
                const href = s.video_id ? `/watch/${s.video_id}` : s.custom_video_id || "#";
                return (
                  <TableRow key={`${sid}:${s.lang}`}>
                    <TableCell>
                      <Link className="text-primary hover:underline" href={href}>
                        {s.video_id || s.custom_video_id}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <div className="truncate">
                        {s.title || s.custom_video_id || t("views.tlManager.noTitle")}
                      </div>
                    </TableCell>
                    <TableCell>{s.lang}</TableCell>
                    <TableCell>
                      {t("views.tlManager.entriesCount", { count: s.entry_count || 0 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t("component.videoCard.openScriptEditor")}
                          onClick={() => openTlClient(s.video_id, s.custom_video_id)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {s.video_id ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("component.videoCard.uploadScript")}
                            onClick={() => uploadClick(s.video_id)}
                          >
                            <ClipboardCopy className="size-4" />
                          </Button>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t("views.tlManager.download")}
                          onClick={() => void downloadClick(s.video_id, s.custom_video_id)}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t("views.tlManager.delete")}
                          onClick={() => deleteClick(s.video_id, s.custom_video_id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        {s.custom_video_id ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("views.tlManager.changeCustomLink")}
                            onClick={() => openChangeLink(s)}
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

      <Dialog
        open={modal}
        onOpenChange={(o) => (o ? setModal(true) : mode !== 3 && setModal(false))}
      >
        <DialogContent className={`${panelClass} p-0`}>{renderDialog()}</DialogContent>
      </Dialog>
    </section>
  );
}
