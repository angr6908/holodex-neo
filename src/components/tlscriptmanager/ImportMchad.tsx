"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ImportMchad({ onClose }: { onClose?: (payload: { upload?: boolean }) => void }) {
  const { t } = useI18n();
  const app = useAppState();
  const [room, setRoom] = useState("");
  const [pass, setPass] = useState("");
  const [loginText, setLoginText] = useState("");
  const [archiveData, setArchiveData] = useState<any[]>([]);
  const [working, setWorking] = useState(false);
  const [claimErrorMsg, setClaimErrorMsg] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);
  function resetData() { setRoom(""); setPass(""); setLoginText(""); setArchiveData([]); setWorking(false); setClaimSuccess(false); setClaimErrorMsg(""); }
  async function checkAvailable() { try { setWorking(true); if (!(room && pass)) throw new Error("Missing room or pass"); const { data } = await api.checkMchadMigrate(room, pass); setArchiveData(data.archives); setLoginText(`Found Mchad Id: ${data.mchad_user_id}`); } catch (e: any) { setClaimErrorMsg(e.message); } setWorking(false); }
  async function claimAll() { try { setWorking(true); const res = await api.claimMchadMigrate(app.userdata.jwt!, room, pass); if (res.status === 200) setClaimSuccess(true); } catch (error: any) { setClaimErrorMsg(error.response?.data?.message || error.message); } setWorking(false); }
  return <div className="space-y-5 p-6"><h2 className="text-lg font-semibold text-white">Import From Mchad</h2>{claimSuccess ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">Successfully claimed all imported archives from Mchad</div> : null}{claimErrorMsg ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{claimErrorMsg}</div> : null}<div className="space-y-4 rounded-[calc(var(--radius)+6px)] border border-white/10 bg-white/4 p-4"><div className="grid gap-3 md:grid-cols-2"><label className="space-y-2"><span className="block text-sm font-medium text-slate-300">Room name</span><Input value={room} onChange={(e) => setRoom(e.target.value)} /></label><label className="space-y-2"><span className="block text-sm font-medium text-slate-300">Password</span><Input value={pass} onChange={(e) => setPass(e.target.value)} type="password" /></label></div><Button variant="secondary" className="w-full" onClick={checkAvailable}>{t("component.mainNav.login")} to Mchad</Button><p className="text-sm text-slate-400">{loginText}</p></div><div className="overflow-hidden rounded-[calc(var(--radius)+6px)] border border-white/10"><div className="max-h-[40vh] overflow-auto"><table className="min-w-full text-sm"><thead className="sticky top-0 bg-slate-950/95 backdrop-blur"><tr className="border-b border-white/10 text-left text-slate-300"><th className="px-4 py-3 font-medium">#</th><th className="px-4 py-3 font-medium">Video Id</th><th className="px-4 py-3 font-medium">Entry Length</th></tr></thead><tbody>{archiveData.map((dt, index) => <tr key={index} className="border-b border-white/8 text-slate-200"><td className="px-4 py-3">{index + 1}</td><td className="px-4 py-3">{dt.video_id}</td><td className="px-4 py-3">{dt.count}</td></tr>)}{archiveData.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No archives loaded yet.</td></tr> : null}</tbody></table></div></div><div className="flex items-center gap-3"><Button variant="ghost" onClick={() => { onClose?.({ upload: false }); resetData(); }}>{t("views.watch.uploadPanel.cancelBtn")}</Button><Button variant="destructive" className="ml-auto" disabled={archiveData.length === 0 || working} onClick={claimAll}>{working ? "Processing" : "Claim All Archives"}</Button></div></div>;
}
