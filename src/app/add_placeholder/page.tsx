"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { Check, MinusSquare, Pencil, SquarePlus } from "@/lib/icons";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { dayjs, formatRelativeTime } from "@/lib/time";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChannelAutocomplete } from "@/components/channel/ChannelAutocomplete";
import { VideoCard } from "@/components/video/VideoCard";
import { VideoSelector } from "@/components/multiview/VideoSelector";
const TIMEZONES = [{ text: "JST", value: "Asia/Tokyo" }, { text: "PST", value: "America/Los_Angeles" }, { text: "GMT", value: "Etc/GMT" }];

export default function AddPlaceholderPage() {
  const app = useAppState();
  const t = useTranslations();
  const search = useSearchParams();
  const [tab, setTab] = useState(0);
  const [id, setId] = useState("");
  const [channel, setChannel] = useState<any>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoTitleJP, setVideoTitleJP] = useState("");
  const [creditName, setCreditName] = useState(app.userdata?.user?.username || "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [placeholderType, setPlaceholderType] = useState("");
  const [certainty, setCertainty] = useState("");
  const [liveDate, setLiveDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [liveTime, setLiveTime] = useState("");
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [duration, setDuration] = useState(60);
  const [discordCredits, setDiscordCredits] = useState<any>(null);
  const tokenRaw = search.get("token") || undefined;
  const token = useMemo(() => { try { return tokenRaw ? jwtDecode<any>(tokenRaw) : null; } catch { return null; } }, [tokenRaw]);
  const isEditor = ["editor", "admin"].includes(app.userdata?.user?.role);
  const expired = !token?.exp || dayjs().isAfter(dayjs(token.exp * 1000));
  const expiresIn = token?.exp ? formatRelativeTime(dayjs(token.exp * 1000), app.settings.lang) : t("component.form.never");
  const placeholderTypes = [
    { text: t("component.videoCard.typeScheduledYT"), value: "scheduled-yt-stream" },
    { text: t("component.videoCard.typeExternalStream"), value: "external-stream" },
    { text: t("component.videoCard.typeEventPlaceholder"), value: "event" },
  ];
  const certaintyChoices = [
    { text: t("component.form.certainty.certain"), value: "certain" },
    { text: t("component.form.certainty.likely"), value: "likely" },
  ];
  const availableAt = useMemo(() => {
    if (liveTime && timezone && liveDate) {
      const parsed = dayjs.tz(`${liveDate} ${liveTime}`, timezone);
      if (parsed.isValid()) return parsed.toISOString();
      return null;
    }
    return null;
  }, [liveDate, liveTime, timezone]);
  const credits = isEditor ? { editor: { name: creditName, user: app.userdata.user?.id } } : token ? { discord: { name: token.name, link: token.link, user: token.user } } : null;
  const videoObj = { title: videoTitle || "Example Title", placeholderType: placeholderType || "scheduled-yt-stream", channel: channel || { id: "ExampleIdThatDoesntExist", name: "<CHANNEL>", english_name: "<CHANNEL>" }, thumbnail, type: "placeholder", status: "upcoming", start_scheduled: availableAt || dayjs().toISOString(), available_at: availableAt || dayjs().toISOString(), credits: credits || { discord: { user: "Discord User", link: "jctkgHBt4b" } }, certainty, link: sourceUrl };
  const validUrl = (value: string) => /^https?:\/\/[\w-]+(\.[\w-]+)+\.?(\/\S*)?/.test(value);
  const validation = { creditName: isEditor && !creditName ? t("component.form.required") : "", channel: channel?.id ? "" : t("component.form.required"), videoTitle: videoTitle ? "" : t("component.form.required"), sourceUrl: !sourceUrl ? t("component.form.required") : validUrl(sourceUrl) ? "" : t("component.form.invalidUrl"), thumbnail: !thumbnail ? "" : validUrl(thumbnail) ? "" : t("component.form.invalidUrl"), placeholderType: placeholderType ? "" : t("component.form.required"), certainty: certainty ? "" : t("component.form.required"), liveDate: liveDate ? "" : t("component.form.required"), liveTime: !liveTime ? t("component.form.required") : availableAt ? "" : t("component.form.invalidTime"), duration: Number(duration) > 0 ? "" : t("component.form.required") } as Record<string, string>;
  const formValid = Object.values(validation).every((v) => !v);
  useEffect(() => { if (tab === 0) setId(""); }, [tab]);
  useEffect(() => {
    if (token?.link) api.discordServerInfo(token.link).then((data) => setDiscordCredits(data)).catch(() => {});
  }, [token?.link]);
  useEffect(() => {
    const queryId = search.get("id");
    if (queryId && isEditor) {
      setId(queryId);
      setTab(1);
      void loadExistingPlaceholder(queryId);
    }
  }, [search, isEditor]);
  function changeDate(amount: number, unit: "hour" | "day") {
    if (unit === "hour") setLiveTime(dayjs(`${liveDate} ${liveTime || "00:00"}`).add(amount, unit).format("HH:mm"));
    else setLiveDate(dayjs(liveDate || dayjs().format("YYYY-MM-DD")).add(amount, unit).format("YYYY-MM-DD"));
  }
  async function loadExistingPlaceholder(phId: string) {
    if (!phId) return;
    const video = (await api.video(phId, undefined, 0)).data;
    setVideoTitle(video.title || "");
    setVideoTitleJP(video.jp_name || "");
    setSourceUrl(video.link || "");
    setThumbnail(video.thumbnail || "");
    setPlaceholderType(video.placeholderType || "");
    const vt = dayjs(video.start_scheduled).tz("Asia/Tokyo");
    setTimezone("Asia/Tokyo");
    setLiveDate(vt.format("YYYY-MM-DD"));
    setLiveTime(vt.format("HH:mm"));
    setDuration(video.duration / 60);
    setCertainty(video.certainty || "");
    setChannel(video.channel);
  }
  async function onSubmit() {
    if (!formValid || !(isEditor || (token && !expired))) {
      toast.error(t("component.form.placeholder.authError"));
      return;
    }
    const titlePayload: any = { name: videoTitle, ...(videoTitleJP && { jp_name: videoTitleJP }), link: sourceUrl, ...(thumbnail && { thumbnail }), placeholderType, certainty, credits };
    const body: any = { channel_id: channel.id, title: titlePayload, liveTime: availableAt, duration: Number(duration) * 60, id: undefined };
    if (id) body.id = id;
    try {
      await api.addPlaceholderStream(body, app.userdata?.jwt, tokenRaw);
      toast.success(t("component.form.placeholder.success"));
    } catch (e: any) {
      toast.error(String(e) || t("component.form.error"));
    }
  }
  return (
    <section className="app-page space-y-6">
      <header className="space-y-2"><Badge variant="secondary">{t("component.form.placeholder.editorBadge")}</Badge><h1 className="text-3xl font-semibold tracking-tight text-white">{t("component.form.placeholder.title")}</h1><p className="max-w-3xl text-sm text-slate-400">{t("component.form.placeholder.description")}</p></header>
      <div className="grid gap-6 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div className="space-y-4"><VideoCard video={videoObj} includeChannel /></div>
        <div className="space-y-4">
          {!isEditor && token && !expired ? <Alert><AlertDescription>{t("component.form.placeholder.editingAs", { user: token.user, guild: discordCredits?.data?.guild?.name || "", expiresIn })}</AlertDescription></Alert> : !isEditor ? <Alert variant="destructive"><AlertDescription>{t("component.form.placeholder.notEditor")}</AlertDescription></Alert> : null}
          <Card className="p-6">
            <ToggleGroup value={[String(tab)]} onValueChange={(value) => value[0] && setTab(Number(value[0]))} className="flex-wrap justify-start">
              <ToggleGroupItem value="0"><SquarePlus className="h-4 w-4" />{t("component.form.new")}</ToggleGroupItem>
              <ToggleGroupItem value="1"><Pencil className="h-4 w-4" />{t("component.form.existing")}</ToggleGroupItem>
            </ToggleGroup>
            <div className="mt-6 space-y-5">
              {isEditor ? <Field data-invalid={!!validation.creditName}><FieldLabel>{t("component.form.placeholder.editorCreditName")}</FieldLabel><Input value={creditName} onChange={(e) => setCreditName(e.target.value)} /><FieldDescription>{t("component.form.placeholder.editorCreditHint")}</FieldDescription>{validation.creditName ? <FieldError>{validation.creditName}</FieldError> : null}</Field> : null}
              {tab === 1 ? <div className="space-y-4"><Field><FieldLabel>{t("component.form.placeholder.placeholderId")}</FieldLabel><div className="flex gap-2"><Input value={id} onChange={(e) => setId(e.target.value)} placeholder={t("component.form.placeholder.placeholderIdInput")} /><Button variant="secondary" onClick={() => loadExistingPlaceholder(id)}><Check className="h-4 w-4" /></Button></div></Field>{!id ? <VideoSelector hidePlaceholder={false} onVideoClicked={(video: any) => { setId(video.id); void loadExistingPlaceholder(video.id); }} /> : null}</div> : null}
              <Field data-invalid={!!validation.channel}><FieldLabel>{t("component.form.channel")}</FieldLabel><ChannelAutocomplete value={channel} onChange={setChannel} label={t("component.form.channel")} />{validation.channel ? <FieldError>{validation.channel}</FieldError> : null}</Field>
              <Field data-invalid={!!validation.videoTitle}><FieldLabel>{t("component.form.placeholder.videoTitle")}</FieldLabel><Input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} />{validation.videoTitle ? <FieldError>{validation.videoTitle}</FieldError> : null}</Field>
              <Field><FieldLabel>{t("component.form.placeholder.japaneseVideoTitle")}</FieldLabel><Input value={videoTitleJP} onChange={(e) => setVideoTitleJP(e.target.value)} /></Field>
              <Field data-invalid={!!validation.sourceUrl}><FieldLabel>{t("component.form.placeholder.sourceLink")}</FieldLabel><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} type="url" placeholder={t("component.form.placeholder.sourceLinkPlaceholder")} /><FieldDescription>{t("component.form.placeholder.sourceLinkHint")}</FieldDescription>{validation.sourceUrl ? <FieldError>{validation.sourceUrl}</FieldError> : null}</Field>
              <Field data-invalid={!!validation.thumbnail}><FieldLabel>{t("component.form.placeholder.thumbnailImage")}</FieldLabel><Input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} type="url" placeholder={t("component.form.placeholder.thumbnailPlaceholder")} />{validation.thumbnail ? <FieldError>{validation.thumbnail}</FieldError> : null}</Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={!!validation.placeholderType}><FieldLabel>{t("component.form.placeholder.eventType")}</FieldLabel><Select value={placeholderType} onValueChange={setPlaceholderType}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{placeholderTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.text}</SelectItem>)}</SelectContent></Select>{validation.placeholderType ? <FieldError>{validation.placeholderType}</FieldError> : null}</Field>
                <Field data-invalid={!!validation.certainty}><FieldLabel>{t("component.form.placeholder.certainty")}</FieldLabel><Select value={certainty} onValueChange={setCertainty}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{certaintyChoices.map((item) => <SelectItem key={item.value} value={item.value}>{item.text}</SelectItem>)}</SelectContent></Select>{validation.certainty ? <FieldError>{validation.certainty}</FieldError> : null}</Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field><FieldLabel>{t("component.form.placeholder.timezone")}</FieldLabel><Select value={timezone} onValueChange={setTimezone}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TIMEZONES.map((item) => <SelectItem key={item.value} value={item.value}>{item.text}</SelectItem>)}</SelectContent></Select></Field>
                <Field data-invalid={!!validation.liveDate}><FieldLabel>{t("component.form.placeholder.date")}</FieldLabel><div className="flex gap-2"><Button variant="secondary" size="icon" onClick={() => changeDate(-1, "day")}><MinusSquare className="h-4 w-4" /></Button><Input value={liveDate} onChange={(e) => setLiveDate(e.target.value)} type="date" className="min-w-0" /><Button variant="secondary" size="icon" onClick={() => changeDate(1, "day")}><SquarePlus className="h-4 w-4" /></Button></div><FieldDescription>YYYY-MM-DD</FieldDescription>{validation.liveDate ? <FieldError>{validation.liveDate}</FieldError> : null}</Field>
                <Field data-invalid={!!validation.liveTime}><FieldLabel>{t("component.form.placeholder.time")}</FieldLabel><div className="flex gap-2"><Button variant="secondary" size="icon" onClick={() => changeDate(-1, "hour")}><MinusSquare className="h-4 w-4" /></Button><Input value={liveTime} onChange={(e) => setLiveTime(e.target.value)} type="time" className="min-w-0" /><Button variant="secondary" size="icon" onClick={() => changeDate(1, "hour")}><SquarePlus className="h-4 w-4" /></Button></div>{validation.liveTime ? <FieldError>{validation.liveTime}</FieldError> : null}</Field>
                <Field data-invalid={!!validation.duration}><FieldLabel>{t("component.form.placeholder.duration")}</FieldLabel><Input value={duration} onChange={(e) => setDuration(Number(e.target.value))} type="number" min={1} /><FieldDescription>{t("component.form.placeholder.durationHint")}</FieldDescription>{validation.duration ? <FieldError>{validation.duration}</FieldError> : null}</Field>
              </div>
              <Button onClick={onSubmit}>{id ? t("component.form.placeholder.submitModification") : t("component.form.placeholder.create")}</Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
