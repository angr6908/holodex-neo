"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MinusCircle, CirclePlus } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { TL_LANGS } from "@/lib/consts";
import { getVideoIDFromUrl } from "@/lib/functions";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
const fieldLabelClass = "text-xs font-semibold uppercase tracking-[0.2em] text-slate-400";

function validateChannel(channelUrl: string) { if (channelUrl.indexOf("https://www.youtube.com/channel/") !== 0) return undefined; return (((channelUrl.indexOf("?") !== -1) ? channelUrl.slice(0, channelUrl.indexOf("?")) : channelUrl).slice(("https://www.youtube.com/channel/").length)); }
function cloneSettings(setting: any[]) { return setting.map((item) => ({ ...item, blacklist: [...(item.blacklist || [])], whitelist: [...(item.whitelist || [])] })); }

export default function RelayBotPage() {
  const t = useTranslations();
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
    const mode = location.hostname === "localhost" ? 0 : location.hostname === "staging.holodex.net" ? 1 : 2;
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
  function addList(kind: "blacklist" | "whitelist", rawValue: string, clearInput: () => void) {
    const value = rawValue.trim();
    if (!value || selectedSetting < 0) return;
    const other = kind === "blacklist" ? "whitelist" : "blacklist";
    let duplicate = false;
    setSetting((cur) => {
      const next = cloneSettings(cur);
      const row = next[selectedSetting];
      if (row[kind].includes(value)) {
        duplicate = true;
      } else {
        row[kind].push(value);
        row[other] = row[other].filter((e: string) => e !== value);
      }
      return next;
    });
    if (duplicate) clearInput();
  }
  function addBlacklist() { addList("blacklist", blacklistInput, () => setBlacklistInput("")); }
  function addWhitelist() { addList("whitelist", whitelistInput, () => setWhitelistInput("")); }
  function removeList(kind: "blacklist" | "whitelist", index: number) {
    setSetting((cur) => {
      const next = cloneSettings(cur);
      next[selectedSetting][kind].splice(index, 1);
      return next;
    });
  }
  function saveSetting() { if (!selectedChannelData) return; setSaveNotif(t("views.relayBot.saving")); api.relayBotSubmitData(selectedChannelData.id, setting).then(({ status }: any) => { if (status === 200) setSaveNotif(t("views.relayBot.saved")); }).catch((err: any) => setSaveNotif(String(err))); }
  function triggerRelay() { if (!selectedChannelData) return; let mode = 0; let link = relayInput; const parsed = getVideoIDFromUrl(link) as any; if (parsed) { setRelayInput(t("views.relayBot.sendingTrigger")); mode = 1; link = `YT_${parsed.id}`; } else if (validateChannel(link)) { setRelayInput(t("views.relayBot.sendingTrigger")); mode = 2; link = `YT_${validateChannel(link)}`; } else return; api.relayBotTrigger(selectedChannelData.id, mode, link, langRelayInput.value).then(({ status }: any) => { if (status === 200) setRelayInput(t("views.relayBot.ok")); }).catch(() => setRelayInput(t("views.relayBot.notOk"))); }
  return (
    <section className="app-page space-y-6">
      <header className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight text-white">{t("views.relayBot.title")}</h1><p className="max-w-3xl text-sm text-slate-400">{t("views.relayBot.description")}</p></header>
      {!loggedIn ? (
        <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center sm:flex-row"><Button nativeButton={false} render={<a href={discordOAuth2Links} />}>{t("views.relayBot.loginDiscord")}</Button><Button nativeButton={false} render={<a href={botInviteLink} target="_blank" rel="noopener noreferrer" />} variant="secondary">{t("views.relayBot.inviteBot")}</Button></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_0.9fr_1.5fr]">
          <Card className="flex min-h-[32rem] flex-col p-4">
            <div className="border-b border-white/10 px-2 pb-3 text-center text-lg font-semibold text-white">{t("views.relayBot.servers")}</div>
            <ScrollArea className="mt-4 min-h-0 flex-1 pr-1"><ToggleGroup value={selectedGuild >= 0 ? [String(selectedGuild)] : []} onValueChange={(value) => { if (value[0]) loadChannel(Number(value[0])); }} className="flex w-full flex-col items-stretch gap-2">{guilds.map((guild, index) => <ToggleGroupItem key={guild.id} value={String(index)} className="h-auto w-full justify-start rounded-xl border px-3 py-2 text-left font-normal whitespace-normal transition data-[state=on]:border-sky-400/60 data-[state=on]:bg-sky-400/12 data-[state=on]:text-white data-[state=on]:hover:bg-sky-400/12 data-[state=on]:hover:text-white data-[state=off]:border-white/10 data-[state=off]:bg-white/4 data-[state=off]:text-slate-200 data-[state=off]:hover:bg-white/8 data-[state=off]:hover:text-slate-200">{guild.name}</ToggleGroupItem>)}</ToggleGroup></ScrollArea>
            <p className="mt-4 text-xs leading-5 text-slate-500">{t("views.relayBot.serverNotShown")}</p>
          </Card>
          {selectedGuildData ? (
            <Card className="flex min-h-[32rem] flex-col p-4">
              <div className="border-b border-white/10 px-2 pb-3 text-center text-lg font-semibold text-white">{selectedGuildData.bot ? t("views.relayBot.channelsFor", { name: selectedGuildData.name }) : selectedGuildData.name}</div>
              {!selectedGuildData.bot ? <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center"><p className="text-sm text-slate-300">{t("views.relayBot.botMissing")}</p><Button nativeButton={false} render={<a href={botInviteLink} target="_blank" rel="noopener noreferrer" />}>{t("views.relayBot.inviteBot")}</Button></div> : <ScrollArea className="mt-4 min-h-0 flex-1 pr-1"><ToggleGroup value={selectedChannel >= 0 ? [String(selectedChannel)] : []} onValueChange={(value) => { if (value[0]) loadSetting(Number(value[0])); }} className="flex w-full flex-col items-stretch gap-2">{channels.map((channel, index) => <ToggleGroupItem key={channel.id} value={String(index)} className="h-auto w-full justify-start rounded-xl border px-3 py-2 text-left font-normal whitespace-normal transition data-[state=on]:border-sky-400/60 data-[state=on]:bg-sky-400/12 data-[state=on]:text-white data-[state=on]:hover:bg-sky-400/12 data-[state=on]:hover:text-white data-[state=off]:border-white/10 data-[state=off]:bg-white/4 data-[state=off]:text-slate-200 data-[state=off]:hover:bg-white/8 data-[state=off]:hover:text-slate-200">{channel.name}</ToggleGroupItem>)}</ToggleGroup></ScrollArea>}
            </Card>
          ) : null}
          {selectedChannelData ? (
            <Card className="space-y-6 p-5">
              <div><h2 className="text-lg font-semibold text-white">{t("views.relayBot.settingFor", { name: selectedChannelData.name })}</h2></div>
              <section className="space-y-3">
                <Field className="gap-2"><FieldLabel className={fieldLabelClass} htmlFor="relaybot-trigger-link">{t("views.relayBot.youtubeLinkChannelVideo")}</FieldLabel><Input id="relaybot-trigger-link" value={relayInput} onChange={(e) => setRelayInput(e.target.value)} /></Field>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <Field className="gap-2"><FieldLabel className={fieldLabelClass} htmlFor="relaybot-trigger-lang">{t("component.common.language")}</FieldLabel><Select value={langRelayInput.value} onValueChange={(nextValue) => setLangRelayInput(TL_LANGS.find((x) => x.value === nextValue) || TL_LANGS[0])}><SelectTrigger id="relaybot-trigger-lang" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TL_LANGS.map((item) => <SelectItem key={item.value} value={item.value}>{item.text} ({item.value})</SelectItem>)}</SelectContent></Select></Field>
                  <Button className="self-end" onClick={triggerRelay}>{t("views.relayBot.relayTL")}</Button>
                </div>
              </section>
              <section className="space-y-3 border-t border-white/10 pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">{t("views.relayBot.relaySubscription")}</h3>
                <Field className="gap-2"><FieldLabel className={fieldLabelClass} htmlFor="relaybot-channel">{t("views.relayBot.youtubeChannel")}</FieldLabel><Input id="relaybot-channel" value={channelInpt} onChange={(e) => setChannelInpt(e.target.value)} /></Field>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <Field className="gap-2"><FieldLabel className={fieldLabelClass} htmlFor="relaybot-channel-lang">{t("component.common.language")}</FieldLabel><Select value={langInpt.value} onValueChange={(nextValue) => setLangInpt(TL_LANGS.find((x) => x.value === nextValue) || TL_LANGS[0])}><SelectTrigger id="relaybot-channel-lang" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TL_LANGS.map((item) => <SelectItem key={item.value} value={item.value}>{item.text} ({item.value})</SelectItem>)}</SelectContent></Select></Field>
                  <Button className="self-end" onClick={addSetting}><CirclePlus className="h-4 w-4" />{t("views.relayBot.addSubscription")}</Button>
                </div>
              </section>
              <section className="space-y-3 border-t border-white/10 pt-6">
                <div className="rounded-2xl border"><Table><TableHeader><TableRow><TableHead>{t("views.relayBot.subscribedChannel")}</TableHead><TableHead>{t("component.common.language")}</TableHead><TableHead className="text-right">{t("component.common.remove")}</TableHead></TableRow></TableHeader><TableBody>{setting.map((set, index) => <TableRow key={`${set.link}-${set.lang}-${index}`} className={cn("cursor-pointer", selectedSetting === index && "bg-accent")} onClick={() => selectSetting(index)}><TableCell>{set.link}</TableCell><TableCell>{set.lang}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={(e: any) => { e.stopPropagation(); setSelectedSetting(-1); setSetting((cur) => cur.filter((_, i) => i !== index)); }}><MinusCircle className="h-4 w-4" /></Button></TableCell></TableRow>)}{setting.length === 0 ? <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">{t("views.relayBot.noSubscriptionsConfigured")}</TableCell></TableRow> : null}</TableBody></Table></div>
              </section>
              {selectedSetting >= 0 && selectedSetting < setting.length ? (
                <section className="grid gap-4 border-t border-white/10 pt-6 lg:grid-cols-2">
                  <Card className="space-y-4 border border-white/10 p-4"><h3 className="text-base font-semibold text-white">{t("views.relayBot.blacklist")}</h3><div className="rounded-2xl border"><Table><TableHeader><TableRow><TableHead>{t("views.relayBot.translatorName")}</TableHead><TableHead className="text-right">{t("component.common.remove")}</TableHead></TableRow></TableHeader><TableBody>{(setting[selectedSetting].blacklist || []).map((dt: string, index: number) => <TableRow key={`${dt}-${index}`}><TableCell>{dt}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => removeList("blacklist", index)}><MinusCircle className="h-4 w-4" /></Button></TableCell></TableRow>)}{(setting[selectedSetting].blacklist || []).length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">{t("views.relayBot.noBlacklistEntries")}</TableCell></TableRow> : null}</TableBody></Table></div><div className="flex gap-2"><Input value={blacklistInput} onChange={(e) => setBlacklistInput(e.target.value)} placeholder={t("views.relayBot.translatorName")} onKeyDown={(e) => { if (e.key === "Enter") addBlacklist(); }} /><Button variant="secondary" onClick={addBlacklist}><CirclePlus className="h-4 w-4" /></Button></div></Card>
                  <Card className="space-y-4 border border-white/10 p-4"><h3 className="text-base font-semibold text-white">{t("views.relayBot.whitelist")}</h3><div className="rounded-2xl border"><Table><TableHeader><TableRow><TableHead>{t("views.relayBot.translatorName")}</TableHead><TableHead className="text-right">{t("component.common.remove")}</TableHead></TableRow></TableHeader><TableBody>{(setting[selectedSetting].whitelist || []).map((dt: string, index: number) => <TableRow key={`${dt}-${index}`}><TableCell>{dt}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => removeList("whitelist", index)}><MinusCircle className="h-4 w-4" /></Button></TableCell></TableRow>)}{(setting[selectedSetting].whitelist || []).length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">{t("views.relayBot.noWhitelistEntries")}</TableCell></TableRow> : null}</TableBody></Table></div><div className="flex gap-2"><Input value={whitelistInput} onChange={(e) => setWhitelistInput(e.target.value)} placeholder={t("views.relayBot.translatorName")} onKeyDown={(e) => { if (e.key === "Enter") addWhitelist(); }} /><Button variant="secondary" onClick={addWhitelist}><CirclePlus className="h-4 w-4" /></Button></div></Card>
                </section>
              ) : null}
              <section className="border-t border-white/10 pt-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><Button onClick={saveSetting}>{t("component.common.save")}</Button><p className="text-sm text-slate-400">{saveNotif}</p></div></section>
            </Card>
          ) : null}
        </div>
      )}
    </section>
  );
}
