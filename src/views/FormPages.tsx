"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { mdiCheck, mdiMinusBox, mdiPencil, mdiPlusBox } from "@mdi/js";
import { api } from "@/lib/api";
import { dayjs } from "@/lib/time";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { ChannelAutocomplete } from "@/components/channel/ChannelAutocomplete";
import { VideoCard } from "@/components/video/VideoCard";
import { VideoSelector } from "@/components/multiview/VideoSelector";
import * as icons from "@/lib/icons";
import { cn } from "@/lib/cn";

const ADD_VTUBER = "Add a Vtuber ▶️ for Holodex to track the channel and clips.";
const ADD_CLIPPER = "I'd like to ➕ add a clipping/subbing channel to Holodex.";
const MODIFY_EXISTING = "I'd like to modify existing channel";
const DELETE = "I'd like to delete my channel";

const languages = [
  { text: "English", value: "en" }, { text: "日本語", value: "ja" }, { text: "中文", value: "zh" }, { text: "한국어", value: "ko" }, { text: "Español", value: "es" },
  { text: "Français", value: "fr" }, { text: "ไทย (Thai)", value: "th" }, { text: "Bahasa", value: "id" }, { text: "Русский язык", value: "ru" }, { text: "Tiếng Việt", value: "vi" },
];
const PLACEHOLDER_TYPES = [
  { text: "Scheduled YT Stream", value: "scheduled-yt-stream" },
  { text: "External Stream (eg. Twitch/Twitcast)", value: "external-stream" },
  { text: "Event", value: "event" },
];
const CERTAINTY_CHOICE = [{ text: "Certain", value: "certain" }, { text: "Likely", value: "likely" }];
const TIMEZONES = [{ text: "JST", value: "Asia/Tokyo" }, { text: "PST", value: "America/Los_Angeles" }, { text: "GMT", value: "Etc/GMT" }];

function Field({ label, children, hint, error }: any) {
  return <div className="space-y-2"><label className="block text-sm font-medium text-slate-300">{label}</label>{children}{hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}{error ? <p className="text-xs text-rose-300">{error}</p> : null}</div>;
}
function NativeSelect({ value, onChange, children }: any) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20">{children}</select>; }
function Toasts({ error, errorMessage, success, successText = "OK" }: any) { return <>{error ? <div className="fixed bottom-4 right-4 z-[120] rounded-2xl border border-rose-400/30 bg-rose-500/90 px-4 py-3 text-sm text-white shadow-2xl">{String(errorMessage || "Some error occurred.")}</div> : null}{success ? <div className="fixed bottom-4 right-4 z-[120] rounded-2xl border border-emerald-400/30 bg-emerald-500/90 px-4 py-3 text-sm text-white shadow-2xl">{successText}</div> : null}</>; }

export function AddPlaceholderPage() {
  const app = useAppState();
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
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const tokenRaw = search.get("token") || undefined;
  const token = useMemo(() => { try { return tokenRaw ? jwtDecode<any>(tokenRaw) : null; } catch { return null; } }, [tokenRaw]);
  const isEditor = ["editor", "admin"].includes(app.userdata?.user?.role);
  const expired = !token?.exp || dayjs().isAfter(dayjs(token.exp * 1000));
  const expiresIn = token?.exp ? dayjs(token.exp * 1000).fromNow() : "never";
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
  const validation = { creditName: isEditor && !creditName ? "Required" : "", channel: channel?.id ? "" : "Required", videoTitle: videoTitle ? "" : "Required", sourceUrl: !sourceUrl ? "Required" : validUrl(sourceUrl) ? "" : "Invalid url", thumbnail: !thumbnail ? "" : validUrl(thumbnail) ? "" : "Invalid url", placeholderType: placeholderType ? "" : "Required", certainty: certainty ? "" : "Required", liveDate: liveDate ? "" : "Required", liveTime: !liveTime ? "Required" : availableAt ? "" : "Invalid time", duration: Number(duration) > 0 ? "" : "Required" } as Record<string, string>;
  const formValid = Object.values(validation).every((v) => !v);
  useEffect(() => { if (tab === 0) setId(""); }, [tab]);
  useEffect(() => { if (token?.link) api.discordServerInfo(token.link).then((data) => setDiscordCredits(data)).catch(() => {}); }, [token?.link]);
  useEffect(() => { const queryId = search.get("id"); if (queryId && isEditor) { setId(queryId); setTab(1); void loadExistingPlaceholder(queryId); } }, [search, isEditor]);
  function changeDate(amount: number, unit: "hour" | "day") { if (unit === "hour") setLiveTime(dayjs(`${liveDate} ${liveTime || "00:00"}`).add(amount, unit).format("HH:mm")); else setLiveDate(dayjs(liveDate || dayjs().format("YYYY-MM-DD")).add(amount, unit).format("YYYY-MM-DD")); }
  async function loadExistingPlaceholder(phId: string) { if (!phId) return; const video = (await api.video(phId, undefined, 0)).data; setVideoTitle(video.title || ""); setVideoTitleJP(video.jp_name || ""); setSourceUrl(video.link || ""); setThumbnail(video.thumbnail || ""); setPlaceholderType(video.placeholderType || ""); const vt = dayjs(video.start_scheduled).tz("Asia/Tokyo"); setTimezone("Asia/Tokyo"); setLiveDate(vt.format("YYYY-MM-DD")); setLiveTime(vt.format("HH:mm")); setDuration(video.duration / 60); setCertainty(video.certainty || ""); setChannel(video.channel); }
  async function onSubmit() {
    if (formValid && (isEditor || (token && !expired))) {
      const titlePayload: any = { name: videoTitle, ...(videoTitleJP && { jp_name: videoTitleJP }), link: sourceUrl, ...(thumbnail && { thumbnail }), placeholderType, certainty, credits };
      const body: any = { channel_id: channel.id, title: titlePayload, liveTime: availableAt, duration: Number(duration) * 60, id: undefined };
      if (id) body.id = id;
      try { await api.addPlaceholderStream(body, app.userdata?.jwt, tokenRaw); setSuccess(true); } catch (e: any) { setError(true); setErrorMessage(String(e)); }
    } else { setError(true); setErrorMessage("You're not a valid Holodex Editor, or your discord-generated placeholder creation link has expired"); }
  }
  return <section className="space-y-6 px-4 py-6"><header className="space-y-2"><Badge variant="secondary">Editor</Badge><h1 className="text-3xl font-semibold tracking-tight text-white">Placeholder Stream</h1><p className="max-w-3xl text-sm text-slate-400">Create or update scheduled placeholders with the migrated form flow.</p></header><div className="grid gap-6 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]"><div className="space-y-4"><VideoCard video={videoObj} includeChannel /></div><div className="space-y-4">{!isEditor && token && !expired ? <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">Editing as {token.user} from {discordCredits?.data?.guild?.name || ""} Discord<br />Your session expires: {expiresIn}. Please refresh if it is about to expire.</div> : !isEditor ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">You are not an editor or token has expired, please login or generate a new token using our bot.</div> : null}<Card className="p-6"><div className="flex flex-wrap gap-2"><button type="button" className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition", tab === 0 ? "border-sky-400/60 bg-sky-400/12 text-white" : "border-white/10 bg-white/4 text-slate-300 hover:bg-white/8")} onClick={() => setTab(0)}><Icon icon={mdiPlusBox} className="h-4 w-4" />New</button><button type="button" className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition", tab === 1 ? "border-sky-400/60 bg-sky-400/12 text-white" : "border-white/10 bg-white/4 text-slate-300 hover:bg-white/8")} onClick={() => setTab(1)}><Icon icon={mdiPencil} className="h-4 w-4" />Existing</button></div><div className="mt-6 space-y-5">{isEditor ? <Field label="Editor Credit Name" hint="Use a different name when being publicly credited." error={validation.creditName}><Input value={creditName} onChange={(e) => setCreditName(e.target.value)} /></Field> : null}{tab === 1 ? <div className="space-y-4"><Field label="Placeholder ID (11 characters)"><div className="flex gap-2"><Input value={id} onChange={(e) => setId(e.target.value)} placeholder="Placeholder ID" /><Button variant="secondary" onClick={() => loadExistingPlaceholder(id)}><Icon icon={mdiCheck} className="h-4 w-4" /></Button></div></Field>{!id ? <VideoSelector hidePlaceholder={false} onVideoClicked={(video: any) => { setId(video.id); void loadExistingPlaceholder(video.id); }} /> : null}</div> : null}<Field label="Channel" error={validation.channel}><ChannelAutocomplete value={channel} onChange={setChannel} label="Channel" /></Field><Field label="Video Title" error={validation.videoTitle}><Input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} /></Field><Field label="Japanese Video Title"><Input value={videoTitleJP} onChange={(e) => setVideoTitleJP(e.target.value)} /></Field><Field label="Source Link" hint="eg. URL to twitter schedule or twitch channel" error={validation.sourceUrl}><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} type="url" placeholder="https://twitter.com/..." /></Field><Field label="Thumbnail Image" error={validation.thumbnail}><Input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} type="url" placeholder="https://imgur.com/..." /></Field><div className="grid gap-4 md:grid-cols-2"><Field label="Event Type" error={validation.placeholderType}><NativeSelect value={placeholderType} onChange={setPlaceholderType}>{PLACEHOLDER_TYPES.map((item) => <option key={item.value} value={item.value} className="bg-slate-950">{item.text}</option>)}</NativeSelect></Field><Field label="Certainty" error={validation.certainty}><NativeSelect value={certainty} onChange={setCertainty}>{CERTAINTY_CHOICE.map((item) => <option key={item.value} value={item.value} className="bg-slate-950">{item.text}</option>)}</NativeSelect></Field></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Timezone"><NativeSelect value={timezone} onChange={setTimezone}>{TIMEZONES.map((item) => <option key={item.value} value={item.value} className="bg-slate-950">{item.text}</option>)}</NativeSelect></Field><Field label="Date" hint="YYYY-MM-DD" error={validation.liveDate}><div className="flex gap-2"><Button variant="secondary" size="icon" onClick={() => changeDate(-1, "day")}><Icon icon={mdiMinusBox} className="h-4 w-4" /></Button><Input value={liveDate} onChange={(e) => setLiveDate(e.target.value)} type="date" className="min-w-0" /><Button variant="secondary" size="icon" onClick={() => changeDate(1, "day")}><Icon icon={mdiPlusBox} className="h-4 w-4" /></Button></div></Field><Field label="Time" error={validation.liveTime}><div className="flex gap-2"><Button variant="secondary" size="icon" onClick={() => changeDate(-1, "hour")}><Icon icon={mdiMinusBox} className="h-4 w-4" /></Button><Input value={liveTime} onChange={(e) => setLiveTime(e.target.value)} type="time" className="min-w-0" /><Button variant="secondary" size="icon" onClick={() => changeDate(1, "hour")}><Icon icon={mdiPlusBox} className="h-4 w-4" /></Button></div></Field><Field label="Duration" hint="Guess a duration in minutes" error={validation.duration}><Input value={duration} onChange={(e) => setDuration(Number(e.target.value))} type="number" min={1} /></Field></div><Button onClick={onSubmit}>{id ? "Submit Placeholder Modification" : "Create new Placeholder"}</Button></div></Card></div></div><Toasts error={error} errorMessage={errorMessage} success={success} successText="Successfully added Placeholder Stream" /></section>;
}

export function AddChannelPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState(false); const [errorMessage, setErrorMessage] = useState(""); const [success, setSuccess] = useState(false);
  const [link, setLink] = useState(""); const [englishName, setEnglishName] = useState(""); const [type, setType] = useState(""); const [lang, setLang] = useState(""); const [twitter, setTwitter] = useState(""); const [contact, setContact] = useState(""); const [comments, setComments] = useState(""); const [org, setOrg] = useState(""); const [channel, setChannel] = useState<any>({});
  const channelTypes = [{ text: t("channelRequest.Types.AddVtuber"), value: ADD_VTUBER }, { text: t("channelRequest.Types.AddClipper"), value: ADD_CLIPPER }, { text: t("channelRequest.Types.ModifyExistingInfo"), value: MODIFY_EXISTING }, { text: t("channelRequest.Types.DeleteChannel"), value: DELETE }];
  useEffect(() => { setLink(""); setChannel({}); setEnglishName(""); setLang(""); setTwitter(""); setContact(""); setComments(""); setOrg(""); }, [type]);
  useEffect(() => { if (success) { const tm = setTimeout(() => setSuccess(false), 2000); return () => clearTimeout(tm); } }, [success]);
  useEffect(() => { if (error) { const tm = setTimeout(() => setError(false), 4000); return () => clearTimeout(tm); } }, [error]);
  function channelURLRule(v: string) { const cid = v.match(/(?:https?:\/\/)(?:www\.)?youtu(?:be\.com\/)(?:channel\/|@)([\w-.]*)$/i); return ((cid && !cid[0].includes("/c/") && (cid[1].length > 12 || cid[0].includes("@")) && cid[0].startsWith("ht")) || t("channelRequest.ChannelURLErrorFeedback")); }
  function twitterRule(v: string) { return !v || /^@.*$/.test(v) || "@ABC"; }
  const linkRule = channelURLRule(link);
  const twitterRuleResult = twitterRule(twitter);
  const linkError = !link || type === MODIFY_EXISTING || type === DELETE ? "" : linkRule === true ? "" : String(linkRule);
  const twitterError = !twitter ? "" : twitterRuleResult === true ? "" : String(twitterRuleResult);
  const contactError = type !== DELETE || contact ? "" : "Required";
  const langError = !(type === ADD_CLIPPER || type === MODIFY_EXISTING) || lang ? "" : "Required";
  function alertText(tType: string) { switch (tType) { case ADD_VTUBER: return t("channelRequest.VtuberRequirementText"); case ADD_CLIPPER: return t("channelRequest.ClipperRequirementText"); case DELETE: return t("channelRequest.DeletionRequirementText"); default: return false; } }
  function isFormValid() { if (!type) return false; if ((type === ADD_VTUBER || type === ADD_CLIPPER) && linkRule !== true) return false; if ((type === ADD_CLIPPER || type === MODIFY_EXISTING) && !lang) return false; if (type === DELETE && !contact) return false; if (twitterRuleResult !== true) return false; if ((type === MODIFY_EXISTING || type === DELETE) && !channel?.id) return false; return true; }
  async function onSubmit() {
    let handle = null as any;
    if (type === ADD_VTUBER || type === ADD_CLIPPER) { const matches = [...link.matchAll(/(?:https?:\/\/)(?:www\.)?youtu(?:be\.com\/)(?:channel\/|@)([\w\-_]*)/gi)]; let id = matches?.[0]?.[1]; handle = link.includes("@"); id = handle ? `@${id?.toLowerCase()}` : id; try { const exists = id && (await api.channel(id)); if (exists && exists.data && exists.data.id) { router.push(`/channel/${exists.data.id}`); return; } } catch {} }
    if (!isFormValid()) { setError(true); setErrorMessage("Some error occurred."); return; }
    const fields: any[] = [{ name: "Request Type", value: type, inline: false }, { name: "Channel Link", value: link || `https://www.youtube.com/channel/${channel.id}`, inline: false }];
    if (englishName) fields.push({ name: "Alternate Channel Name (optional)", value: englishName, inline: false }); if (lang) fields.push({ name: "What language is your channel?", value: lang, inline: false }); if (twitter) fields.push({ name: "Twitter Handle (optional)", value: twitter, inline: false }); if (contact) fields.push({ name: "Direct contact", value: contact, inline: false }); if (org || comments) fields.push({ name: "Comments", value: `[${org}] ${comments}`, inline: false });
    try { await api.requestChannel({ content: "‌Look what the cat dragged in...", embeds: [{ title: "Holodex New Subber Request", color: 1955806, fields, footer: { text: "Holodex UI" } }] }); setSuccess(true); setLink(""); setChannel({}); setEnglishName(""); setLang(""); setTwitter(""); setContact(""); setComments(""); setOrg(""); } catch (e: any) { setError(true); setErrorMessage(e?.response && typeof e.response.data === "string" ? e.response.data : String(e)); }
  }
  return <div className="mx-auto w-full max-w-5xl px-4 py-6"><div className="mx-auto w-full md:max-w-[83.333%] lg:max-w-[66.666%]"><Card className="p-6"><div className="text-2xl font-semibold text-white">{t("channelRequest.PageTitle")}</div>{type && alertText(type) ? <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100"><p dangerouslySetInnerHTML={{ __html: String(alertText(type)) }} /></div> : null}<div className="mt-6 space-y-6"><fieldset><legend className="mb-3 text-sm font-medium text-slate-300">{t("channelRequest.RequestType")}</legend><div className="grid gap-3">{channelTypes.map((ct) => <label key={ct.value} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/8"><input checked={type === ct.value} onChange={() => setType(ct.value)} type="radio" value={ct.value} className="mt-1" /><span>{ct.text}</span></label>)}</div></fieldset>{type === MODIFY_EXISTING || type === DELETE ? <div><ChannelAutocomplete value={channel} onChange={setChannel} label="Channel" /></div> : <Field label="Channel URL" hint="https://www.youtube.com/channel/UC_____ or https://www.youtube.com/@_____" error={linkError}><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/channel/UC_____  or https://www.youtube.com/@_____" /></Field>}{type !== DELETE && type !== ADD_CLIPPER ? <Field label={t("channelRequest.EnglishNameLabel")} hint={t("channelRequest.EnglishNameHint")}><Input value={englishName} onChange={(e) => setEnglishName(e.target.value)} /></Field> : null}{!(type === ADD_VTUBER || type === DELETE) ? <Field label={t("channelRequest.ChannelLanguageLabel")} error={langError}><NativeSelect value={lang} onChange={setLang}><option value="" className="bg-slate-950">Select language</option>{languages.map((item) => <option key={item.value} value={item.value} className="bg-slate-950">{item.text}</option>)}</NativeSelect></Field> : null}{type === ADD_VTUBER || type === MODIFY_EXISTING ? <Field label={t("channelRequest.VtuberGroupLabel")} hint={t("channelRequest.VtuberGroupHint")}><Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Hololive, Nijisanji, ..." /></Field> : null}{type !== DELETE ? <Field label={t("channelRequest.TwitterHandle")} hint="@username" error={twitterError}><Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@xyzabc" /></Field> : null}<Field label={t("channelRequest.DirectContactLabel")} hint={t("channelRequest.DirectContactDisclaimer")} error={contactError}><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@abc / discord#1234 / contact@hello.me" /></Field><Field label={t("channelRequest.Comments")} hint={t("channelRequest.CommentsHint")}><textarea value={comments} onChange={(e) => setComments(e.target.value)} className="min-h-28 w-full rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20" /></Field><Button type="button" className="mt-2" onClick={onSubmit}><Icon icon={icons.mdiCheck} />Submit</Button></div></Card></div><Toasts error={error} errorMessage={errorMessage} success={success} /></div>;
}
