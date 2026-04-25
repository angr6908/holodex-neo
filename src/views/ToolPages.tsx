"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { mdiMinusCircle, mdiPlusCircle } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { TL_LANGS } from "@/lib/consts";
import { getVideoIDFromUrl } from "@/lib/functions";
import { cn } from "@/lib/cn";

function LangSelect({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  return <select value={value.value} onChange={(e) => onChange(TL_LANGS.find((x) => x.value === e.target.value) || TL_LANGS[0])} className="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20">{TL_LANGS.map((item) => <option key={item.value} value={item.value} className="bg-slate-950">{item.text} ({item.value})</option>)}</select>;
}
function validateChannel(channelUrl: string) { if (channelUrl.indexOf("https://www.youtube.com/channel/") !== 0) return undefined; return (((channelUrl.indexOf("?") !== -1) ? channelUrl.slice(0, channelUrl.indexOf("?")) : channelUrl).slice(("https://www.youtube.com/channel/").length)); }
function cloneSettings(setting: any[]) { return setting.map((item) => ({ ...item, blacklist: [...(item.blacklist || [])], whitelist: [...(item.whitelist || [])] })); }

export function RelayBotPage() {
  const searchParams = useSearchParams();
  const [loggedIn, setLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [guilds, setGuilds] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [setting, setSetting] = useState<any[]>([]);
  const [channelInpt, setChannelInpt] = useState("");
  const [langInpt, setLangInpt] = useState<any>(TL_LANGS[0]);
  const [selectedGuild, setSelectedGuild] = useState(-1);
  const [selectedChannel, setSelectedChannel] = useState(-1);
  const [saveNotif, setSaveNotif] = useState("");
  const [selectedSetting, setSelectedSetting] = useState(-1);
  const [blacklistInput, setBlacklistInput] = useState("");
  const [whitelistInput, setWhitelistInput] = useState("");
  const [relayInput, setRelayInput] = useState("");
  const [langRelayInput, setLangRelayInput] = useState<any>(TL_LANGS[0]);
  const botInviteLink = "https://discord.com/api/oauth2/authorize?client_id=826055534318583858&permissions=274877910016&scope=bot%20applications.commands";
  const [discordOAuth2Links, setDiscordOAuth2Links] = useState("#");
  useEffect(() => { document.title = "RelayBot - Holodex"; }, []);
  useEffect(() => {
    switch (location.hostname) {
      case "localhost": setDiscordOAuth2Links("https://discord.com/api/oauth2/authorize?client_id=826055534318583858&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Frelaybot&response_type=code&scope=guilds%20identify"); break;
      case "staging.holodex.net": setDiscordOAuth2Links("https://discord.com/api/oauth2/authorize?client_id=826055534318583858&redirect_uri=https%3A%2F%2Fstaging.holodex.net%2Frelaybot&response_type=code&scope=guilds%20identify"); break;
      case "holodex.net": setDiscordOAuth2Links("https://discord.com/api/oauth2/authorize?client_id=826055534318583858&redirect_uri=https%3A%2F%2Fholodex.net%2Frelaybot&response_type=code&scope=guilds%20identify"); break;
      default: setDiscordOAuth2Links(`https://discord.com/api/oauth2/authorize?client_id=826055534318583858&redirect_uri=${encodeURIComponent(window.location.origin + "/relaybot")}&response_type=code&scope=guilds%20identify`);
    }
  }, []);
  const selectedGuildData = selectedGuild >= 0 ? guilds[selectedGuild] : null;
  const selectedChannelData = selectedChannel >= 0 ? channels[selectedChannel] : null;
  function init() {
    setLoggedIn(false);
    const code = searchParams.get("code");
    if (!code) return;
    let mode = 3;
    if (location.hostname === "localhost") mode = 0; else if (location.hostname === "staging.holodex.net") mode = 1; else if (location.hostname === "holodex.net") mode = 2; else mode = 2;
    api.relayBotLogin(code, mode).then(({ status, data }: any) => {
      if (status === 200) {
        setSelectedChannel(-1); setSelectedGuild(-1); setLoggedIn(true); setAccessToken(data.access_token);
        const nextGuilds = data.guilds.filter((e: any) => e.admin).map((e: any) => ({ id: e.id, name: e.name, bot: false }));
        setGuilds(nextGuilds);
        api.relayBotCheckBotPresence(nextGuilds.map((e: any) => e.id)).then(({ status, data }: any) => { if (status === 200) setGuilds(nextGuilds.map((e: any) => ({ ...e, bot: data.includes(e.id) }))); }).catch(() => setLoggedIn(false));
      }
    }).catch(() => setLoggedIn(false));
  }
  useEffect(() => { init(); }, [searchParams.get("code")]);
  function loadChannel(index: number) { setChannels([]); setSelectedGuild(index); setSelectedChannel(-1); if (guilds[index].bot) api.relayBotGetChannels(guilds[index].id).then(({ status, data }: any) => { if (status === 200) setChannels(data.map((e: any) => ({ id: e.id, name: e.name }))); }).catch(console.error); }
  function loadSetting(index: number) { setSelectedChannel(index); setChannelInpt(""); setSelectedSetting(-1); setLangInpt(TL_LANGS[0]); setLangRelayInput(TL_LANGS[0]); setSaveNotif(""); setSetting([]); api.relayBotGetSettingChannel(channels[index].id).then(({ status, data }: any) => { if (status === 200) setSetting(data.SubChannel ? data.SubChannel.map((e: any) => ({ ...e, lang: e.lang || "en", whitelist: e.whitelist || [], blacklist: e.blacklist || [] })) : []); }).catch(console.error); }
  function addSetting() { const channelId = validateChannel(channelInpt); if (!channelId) return; const setPush = { link: `YT_${channelId}`, lang: langInpt.value }; setSetting((cur) => cur.some((e) => e.link === setPush.link && e.lang === setPush.lang) ? cur : [...cur, setPush]); setChannelInpt(""); setLangInpt(TL_LANGS[0]); }
  function selectSetting(index: number) { setSelectedSetting(index); setBlacklistInput(""); setWhitelistInput(""); }
  function addBlacklist() { const value = blacklistInput.trim(); if (!value || selectedSetting < 0) return; let duplicate = false; setSetting((cur) => { const next = cloneSettings(cur); const row = next[selectedSetting]; if (!row.blacklist.includes(value)) { row.blacklist.push(value); row.whitelist = row.whitelist.filter((e: string) => e !== value); } else duplicate = true; return next; }); if (duplicate) setBlacklistInput(""); }
  function addWhitelist() { const value = whitelistInput.trim(); if (!value || selectedSetting < 0) return; let duplicate = false; setSetting((cur) => { const next = cloneSettings(cur); const row = next[selectedSetting]; if (!row.whitelist.includes(value)) { row.whitelist.push(value); row.blacklist = row.blacklist.filter((e: string) => e !== value); } else duplicate = true; return next; }); if (duplicate) setWhitelistInput(""); }
  function removeList(kind: "blacklist" | "whitelist", index: number) { setSetting((cur) => { const next = cloneSettings(cur); next[selectedSetting][kind].splice(index, 1); return next; }); }
  function saveSetting() { if (!selectedChannelData) return; setSaveNotif("Saving..."); api.relayBotSubmitData(selectedChannelData.id, setting).then(({ status }: any) => { if (status === 200) setSaveNotif("Saved!!"); }).catch((err: any) => setSaveNotif(String(err))); }
  function triggerRelay() { if (!selectedChannelData) return; let mode = 0; let link = relayInput; const parsed = getVideoIDFromUrl(link) as any; if (parsed) { setRelayInput("Sending trigger..."); mode = 1; link = `YT_${parsed.id}`; } else if (validateChannel(link)) { setRelayInput("Sending trigger..."); mode = 2; link = `YT_${validateChannel(link)}`; } else return; api.relayBotTrigger(selectedChannelData.id, mode, link, langRelayInput.value).then(({ status }: any) => { if (status === 200) setRelayInput("Ok!!"); }).catch(() => setRelayInput("Not Ok!!")); }
  const tableRow = (set: any, index: number) => <tr key={`${set.link}-${set.lang}-${index}`} className={cn("cursor-pointer border-t border-white/8 transition hover:bg-white/6", selectedSetting === index && "bg-sky-400/10")} onClick={() => selectSetting(index)}><td className="px-4 py-3 text-slate-200">{set.link}</td><td className="px-4 py-3 text-slate-300">{set.lang}</td><td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={(e: any) => { e.stopPropagation(); setSelectedSetting(-1); setSetting((cur) => cur.filter((_, i) => i !== index)); }}><Icon icon={mdiMinusCircle} className="h-4 w-4" /></Button></td></tr>;
  return <section className="space-y-6 px-4 py-6"><header className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight text-white">Relay Bot</h1><p className="max-w-3xl text-sm text-slate-400">Manage Discord relay targets, subscriptions, and translator allowlists from the migrated settings panel.</p></header>{!loggedIn ? <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center sm:flex-row"><Button as="a" href={discordOAuth2Links}>Login Discord</Button><Button as="a" variant="secondary" href={botInviteLink} target="_blank" rel="noopener noreferrer">Invite Bot</Button></Card> : <div className="grid gap-6 xl:grid-cols-[0.9fr_0.9fr_1.5fr]"><Card className="flex min-h-[32rem] flex-col p-4"><div className="border-b border-white/10 px-2 pb-3 text-center text-lg font-semibold text-white">Servers</div><div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">{guilds.map((guild, index) => <button key={guild.id} type="button" className={cn("w-full rounded-xl border px-3 py-2 text-left text-sm transition", selectedGuild === index ? "border-sky-400/60 bg-sky-400/12 text-white" : "border-white/10 bg-white/4 text-slate-200 hover:bg-white/8")} onClick={() => loadChannel(index)}>{guild.name}</button>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Server not shown if you have insufficient privilege (admin or kick/ban people).</p></Card>{selectedGuildData ? <Card className="flex min-h-[32rem] flex-col p-4"><div className="border-b border-white/10 px-2 pb-3 text-center text-lg font-semibold text-white">{selectedGuildData.bot ? `Channels (${selectedGuildData.name})` : selectedGuildData.name}</div>{!selectedGuildData.bot ? <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center"><p className="text-sm text-slate-300">Bot is not in this server.</p><Button as="a" href={botInviteLink} target="_blank" rel="noopener noreferrer">Invite Bot</Button></div> : <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">{channels.map((channel, index) => <button key={channel.id} type="button" className={cn("w-full rounded-xl border px-3 py-2 text-left text-sm transition", selectedChannel === index ? "border-sky-400/60 bg-sky-400/12 text-white" : "border-white/10 bg-white/4 text-slate-200 hover:bg-white/8")} onClick={() => loadSetting(index)}>{channel.name}</button>)}</div>}</Card> : null}{selectedChannelData ? <Card className="space-y-6 p-5"><div><h2 className="text-lg font-semibold text-white">{`Setting (${selectedChannelData.name})`}</h2></div><section className="space-y-3"><div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Youtube Link (Channel/Video)</label><Input value={relayInput} onChange={(e) => setRelayInput(e.target.value)} /></div><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><label className="space-y-2"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Lang</span><LangSelect value={langRelayInput} onChange={setLangRelayInput} /></label><Button className="self-end" onClick={triggerRelay}>Relay TL</Button></div></section><section className="space-y-3 border-t border-white/10 pt-6"><h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Relay Subscription</h3><div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Youtube Channel</label><Input value={channelInpt} onChange={(e) => setChannelInpt(e.target.value)} /></div><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><label className="space-y-2"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Lang</span><LangSelect value={langInpt} onChange={setLangInpt} /></label><Button className="self-end" onClick={addSetting}><Icon icon={mdiPlusCircle} className="h-4 w-4" />Add Subscription</Button></div></section><section className="space-y-3 border-t border-white/10 pt-6"><div className="overflow-hidden rounded-2xl border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/6 text-left text-slate-300"><tr><th className="px-4 py-3 font-medium">Subscribed Channel</th><th className="px-4 py-3 font-medium">Lang</th><th className="px-4 py-3 font-medium text-right">Remove</th></tr></thead><tbody>{setting.map(tableRow)}{setting.length === 0 ? <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">No subscriptions configured.</td></tr> : null}</tbody></table></div></section>{selectedSetting >= 0 && selectedSetting < setting.length ? <section className="grid gap-4 border-t border-white/10 pt-6 lg:grid-cols-2"><ListEditor title="Blacklist" values={setting[selectedSetting].blacklist || []} input={blacklistInput} setInput={setBlacklistInput} add={addBlacklist} remove={(i) => removeList("blacklist", i)} empty="No blacklist entries." /><ListEditor title="Whitelist" values={setting[selectedSetting].whitelist || []} input={whitelistInput} setInput={setWhitelistInput} add={addWhitelist} remove={(i) => removeList("whitelist", i)} empty="No whitelist entries." /></section> : null}<section className="border-t border-white/10 pt-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><Button onClick={saveSetting}>Save</Button><p className="text-sm text-slate-400">{saveNotif}</p></div></section></Card> : null}</div>}</section>;
}

function ListEditor({ title, values, input, setInput, add, remove, empty }: any) {
  return <Card className="space-y-4 border border-white/10 p-4"><h3 className="text-base font-semibold text-white">{title}</h3><div className="overflow-hidden rounded-2xl border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/6 text-left text-slate-300"><tr><th className="px-4 py-3 font-medium">Translator Name</th><th className="px-4 py-3 font-medium text-right">Remove</th></tr></thead><tbody>{values.map((dt: string, index: number) => <tr key={`${dt}-${index}`} className="border-t border-white/8"><td className="px-4 py-3 text-slate-200">{dt}</td><td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => remove(index)}><Icon icon={mdiMinusCircle} className="h-4 w-4" /></Button></td></tr>)}{values.length === 0 ? <tr><td colSpan={2} className="px-4 py-4 text-center text-slate-500">{empty}</td></tr> : null}</tbody></table></div><div className="flex gap-2"><Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Translator Name" onKeyPress={(e) => { if (e.key === "Enter") add(); }} /><Button variant="secondary" onClick={add}><Icon icon={mdiPlusCircle} className="h-4 w-4" /></Button></div></Card>;
}
