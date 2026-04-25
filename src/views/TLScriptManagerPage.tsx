"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { mdiArrowLeftBold, mdiArrowRightBold, mdiClipboardArrowUpOutline, mdiDownload, mdiFileMultiple, mdiNoteEdit, mdiTrashCan, mdiTypewriter } from "@mdi/js";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { TL_LANGS } from "@/lib/consts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ExportToFile } from "@/components/tlscriptmanager/ExportToFile";
import { UploadScript } from "@/components/tlscriptmanager/UploadScript";
import { ImportMchad } from "@/components/tlscriptmanager/ImportMchad";
import { openUserMenu } from "@/lib/navigation-events";

export function TLScriptManagerPage() {
  const { t } = useI18n();
  const router = useRouter();
  const app = useAppState();
  const [tlData, setTlData] = useState<any[]>([]);
  const [modalNexus, setModalNexus] = useState(false);
  const [modalMode, setModalMode] = useState(0);
  const [selectedID, setSelectedID] = useState<any>(-1);
  const [tlLang, setTlLang] = useState<any>(TL_LANGS[0]);
  const [modalText, setModalText] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [query, setQuery] = useState({ limit: 20, offset: 0 });
  const [newLinkInput, setNewLinkInput] = useState("");
  const [selectedScript, setSelectedScript] = useState<any>(undefined);
  const [videoData, setVideoData] = useState<any>(undefined);
  const dialogPanelClass = modalMode === 2 ? "max-w-[300px]" : modalMode === 3 ? "max-w-[95vw]" : "max-w-[600px]";
  const pageRange = useMemo(() => `${query.offset + 1} ... ${query.offset + query.limit}`, [query]);
  useEffect(() => { document.title = "TLManager - Holodex"; reloadData(); }, [query.offset]);

  function reloadData() { api.getTLStats(app.userdata.jwt!, query).then(({ status, data }: any) => { if (status === 200) { setTlData(data); setModalNexus(false); } }).catch(console.error); }
  function openTlClient(id: string, customVideoId: string) { if (app.userdata?.user) router.push(`/scripteditor?video=${encodeURIComponent(customVideoId || `YT_${id}`)}`); else openUserMenu(); }
  function deleteClick(id: string, customVideoId: string) { setModalNexus(true); setModalMode(2); setSelectedID(customVideoId || id); setTimeout(() => reloadDeleteEntries(customVideoId || id, tlLang), 0); }
  async function downloadClick(id: string, customVideoId: string) { if (customVideoId) setVideoData({ id: "custom", custom_video_id: customVideoId, title: customVideoId }); else { const { status, data } = await api.video(id, tlLang.value); if (status === 200) setVideoData({ id, start_actual: !data.start_actual ? Date.parse(data.available_at) : Date.parse(data.start_actual), title: data.title }); } setModalNexus(true); setModalMode(1); setSelectedID(id); }
  function uploadClick(id: string) { api.video(id, tlLang.value).then(({ status, data }: any) => { if (status === 200) { setVideoData({ id, start_actual: !data.start_actual ? Date.parse(data.available_at) : Date.parse(data.start_actual), title: data.title }); setModalNexus(true); setModalMode(0); setSelectedID(id); } }).catch(console.error); }
  function closeUpload(e: { upload?: boolean }) { if (e.upload) reloadData(); setModalNexus(false); }
  function loadNext() { if (tlData.length >= query.limit) { setTlData([]); setQuery((q) => ({ ...q, offset: q.offset + 20 })); } }
  function loadPrev() { setTlData([]); setQuery((q) => ({ ...q, offset: Math.max(0, q.offset - 20) })); }
  function reloadDeleteEntries(idArg = selectedID, langArg = tlLang) { const isCustom = !!String(idArg).match(/^https:\/\//i); api.chatHistory(isCustom ? "custom" : idArg, { ...(isCustom && { custom_video_id: idArg }), lang: langArg.value, verified: 0, moderator: 0, vtuber: 0, limit: 100000, mode: 1, creator_id: app.userdata.user.id }).then(({ status, data }: any) => { if (status === 200) { const next = data.map((e: any) => e.id); setEntries(next); setModalText(`${next.length} entries`); } }).catch(console.error); }
  function clearAll() { const isCustom = !!String(selectedID).match(/^https:\/\//i); const processes = entries.map((e) => ({ type: "Delete", data: { id: e } })); api.postTLLog({ ...(isCustom && { custom_video_id: selectedID }), videoId: isCustom ? "custom" : selectedID, jwt: app.userdata.jwt!, body: processes, lang: tlLang.value }).then(({ status }: any) => { if (status === 200) { reloadData(); setModalNexus(false); } }).catch(console.error); }
  async function changeLink() { try { await api.postChangeLink({ jwt: app.userdata.jwt!, body: { oldId: selectedScript.custom_video_id, newId: newLinkInput, lang: selectedScript.lang } }); } catch (e) { alert(`failed ${e}`); } reloadData(); }
  function changeDeleteLang(value: string) { const next = TL_LANGS.find((x) => x.value === value) || TL_LANGS[0]; setTlLang(next); reloadDeleteEntries(selectedID, next); }

  return <section className="space-y-6 px-4 py-6"><header className="space-y-2"><Badge variant="secondary">TLDex</Badge><h1 className="text-3xl font-semibold tracking-tight text-white">{t("views.tlManager.title")}</h1><p className="max-w-3xl text-sm text-slate-400">Manage translation scripts, export data, and clean up custom links from the migrated manager surface.</p></header><Card className="p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center"><Button onClick={() => { setModalNexus(true); setModalMode(3); }}><Icon icon={mdiFileMultiple} size="sm" />Import From Mchad</Button><div className="flex items-center gap-2 md:ml-auto"><Button variant="outline" size="icon" onClick={loadPrev}><Icon icon={mdiArrowLeftBold} size="sm" /></Button><div className="min-w-[9rem] text-center text-sm text-slate-400">{pageRange}</div><Button variant="outline" size="icon" onClick={loadNext}><Icon icon={mdiArrowRightBold} size="sm" /></Button></div></div><div className="mt-5 overflow-hidden rounded-[calc(var(--radius)+6px)] border border-white/10"><div className="max-h-[70vh] overflow-auto"><table className="tl-manager-table min-w-full text-sm"><thead className="sticky top-0 bg-slate-950/95 backdrop-blur"><tr className="border-b border-white/10 text-left text-slate-300"><th className="px-4 py-3 font-medium">{t("views.tlManager.headerID")}</th><th className="px-4 py-3 font-medium">Video Title</th><th className="px-4 py-3 font-medium">Lang</th><th className="px-4 py-3 font-medium">{t("views.tlManager.headerEntries")}</th><th className="px-4 py-3 font-medium text-right">Actions</th></tr></thead><tbody>{tlData.map((dt, index) => <tr key={index} className="border-b border-white/8 text-slate-200 transition hover:bg-white/4"><td className="px-4 py-3 align-top"><Link className="text-sky-300 hover:text-sky-200" href={dt.video_id ? `/watch/${dt.video_id}` : dt.custom_video_id}>{dt.video_id || dt.custom_video_id}</Link></td><td className="max-w-0 px-4 py-3 align-top"><div className="truncate">{dt.title || dt.custom_video_id || "No title"}</div></td><td className="px-4 py-3 align-top">{dt.lang}</td><td className="px-4 py-3 align-top">{(dt.entry_count || 0) + " entries"}</td><td className="px-4 py-3 align-top"><div className="flex justify-end gap-2"><Button size="icon" variant="ghost" title={t("component.videoCard.openScriptEditor")} onClick={() => openTlClient(dt.video_id, dt.custom_video_id)}><Icon icon={mdiTypewriter} size="sm" /></Button>{dt.video_id ? <Button size="icon" variant="ghost" title={t("component.videoCard.uploadScript")} onClick={() => uploadClick(dt.video_id)}><Icon icon={mdiClipboardArrowUpOutline} size="sm" /></Button> : null}<Button size="icon" variant="ghost" title={t("views.tlManager.download")} onClick={() => downloadClick(dt.video_id, dt.custom_video_id)}><Icon icon={mdiDownload} size="sm" /></Button><Button size="icon" variant="ghost" title={t("views.tlManager.delete")} onClick={() => deleteClick(dt.video_id, dt.custom_video_id)}><Icon icon={mdiTrashCan} size="sm" /></Button>{dt.custom_video_id ? <Button size="icon" variant="ghost" title="Change Custom Link" onClick={() => { setModalMode(4); setModalNexus(true); setNewLinkInput(dt.custom_video_id); setSelectedScript(dt); }}><Icon icon={mdiNoteEdit} size="sm" /></Button> : null}</div></td></tr>)}{tlData.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No translation scripts found for this page.</td></tr> : null}</tbody></table></div></div></Card><Dialog open={modalNexus} className={dialogPanelClass} onOpenChange={(open) => { if (!open && modalMode !== 3) setModalNexus(false); else if (open) setModalNexus(true); }}>{modalMode === 0 ? <div className="bg-slate-950"><UploadScript videoData={videoData} onClose={closeUpload} /></div> : modalMode === 1 ? <div className="bg-slate-950"><ExportToFile videoData={videoData} /></div> : modalMode === 2 ? <div className="space-y-5 p-6"><div><h2 className="text-lg font-semibold text-white">{t("views.tlManager.deleteTitle")}</h2></div><label className="block space-y-2"><span className="text-sm font-medium text-slate-300">{t("views.tlManager.langPick")}</span><select value={tlLang.value} className="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20" onChange={(e) => changeDeleteLang(e.target.value)}>{TL_LANGS.map((item) => <option key={item.value} value={item.value} className="bg-slate-950">{item.text + " (" + item.value + ")"}</option>)}</select></label><p className="text-sm text-slate-400">{modalText}</p><div className="flex items-center gap-3"><Button variant="ghost" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button variant="destructive" className="ml-auto" onClick={clearAll}>{t("views.tlManager.delete")}</Button></div></div> : modalMode === 3 ? <div className="bg-slate-950"><ImportMchad onClose={closeUpload} /></div> : <div className="space-y-5 p-6"><div><h2 className="text-lg font-semibold text-white">Change stream link</h2></div><div className="space-y-2"><label className="block text-sm font-medium text-slate-300">New link</label><Input value={newLinkInput} onChange={(e) => setNewLinkInput(e.target.value)} /></div><div className="flex items-center gap-3"><Button variant="ghost" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button className="ml-auto" onClick={() => { setModalNexus(false); changeLink(); }}>{t("views.tlClient.okBtn")}</Button></div></div>}</Dialog></section>;
}
