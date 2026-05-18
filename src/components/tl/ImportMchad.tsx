"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export function ImportMchad({ onClose }: { onClose?: (payload: { upload?: boolean }) => void }) {
  const t = useTranslations();
  const app = useAppState();
  const [room, setRoom] = useState("");
  const [pass, setPass] = useState("");
  const [loginText, setLoginText] = useState("");
  const [archiveData, setArchiveData] = useState<any[]>([]);
  const [working, setWorking] = useState(false);
  const [claimErrorMsg, setClaimErrorMsg] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);
  function resetData() { setRoom(""); setPass(""); setLoginText(""); setArchiveData([]); setWorking(false); setClaimSuccess(false); setClaimErrorMsg(""); }
  async function checkAvailable() { try { setWorking(true); if (!(room && pass)) throw new Error(t("views.tlManager.importMchad.missingCredentials")); const { data } = await api.checkMchadMigrate(room, pass); setArchiveData(data.archives); setLoginText(t("views.tlManager.importMchad.foundId", { id: data.mchad_user_id })); } catch (e: any) { setClaimErrorMsg(e.message); } setWorking(false); }
  async function claimAll() { try { setWorking(true); const res = await api.claimMchadMigrate(app.userdata.jwt!, room, pass); if (res.status === 200) setClaimSuccess(true); } catch (error: any) { setClaimErrorMsg(error.response?.data?.message || error.message); } setWorking(false); }
  return (
    <div className="space-y-5 p-6">
	      <h2 className="text-lg font-semibold">{t("views.tlManager.importFromMchad")}</h2>
      {claimSuccess ? (
        <Alert>
          <AlertDescription>{t("views.tlManager.importMchad.claimSuccess")}</AlertDescription>
        </Alert>
      ) : null}
      {claimErrorMsg ? (
        <Alert variant="destructive">
          <AlertDescription>{claimErrorMsg}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <div className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel>{t("views.tlManager.importMchad.roomName")}</FieldLabel>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>{t("views.tlManager.importMchad.password")}</FieldLabel>
            <Input value={pass} onChange={(e) => setPass(e.target.value)} type="password" />
          </Field>
        </div>
        <Button variant="secondary" className="w-full" onClick={checkAvailable}>{t("views.tlManager.importMchad.login")}</Button>
        <p className="text-sm text-muted-foreground">{loginText}</p>
      </FieldGroup>
      <div className="max-h-[40vh] overflow-auto rounded-[calc(var(--radius)+6px)] border">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("views.tlManager.headerID")}</TableHead>
              <TableHead>{t("views.tlManager.importMchad.entryLength")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {archiveData.map((dt, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{dt.video_id}</TableCell>
                <TableCell>{dt.count}</TableCell>
              </TableRow>
            ))}
            {archiveData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{t("views.tlManager.importMchad.noArchives")}</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => { onClose?.({ upload: false }); resetData(); }}>{t("views.watch.uploadPanel.cancelBtn")}</Button>
        <Button variant="destructive" className="ml-auto" disabled={archiveData.length === 0 || working} onClick={claimAll}>
          {working ? (
            <>
              <Spinner />
              {t("component.common.processing")}
            </>
          ) : (
            t("views.tlManager.importMchad.claimAllArchives")
          )}
        </Button>
      </div>
    </div>
  );
}
