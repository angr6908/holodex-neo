"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { TL_LANGS } from "@/lib/consts";
import { getVideoIDFromUrl } from "@/lib/functions";
import { useOrigin } from "@/lib/hooks";
import { CirclePlus, MinusCircle } from "@/lib/icons";
import { cn } from "@/lib/utils";

const fieldLabelClass = "";

function validateChannel(channelUrl: string) {
  if (channelUrl.indexOf("https://www.youtube.com/channel/") !== 0) return undefined;
  return (
    channelUrl.indexOf("?") !== -1 ? channelUrl.slice(0, channelUrl.indexOf("?")) : channelUrl
  ).slice("https://www.youtube.com/channel/".length);
}
function cloneSettings(setting: any[]) {
  return setting.map((item) => ({
    ...item,
    blacklist: [...(item.blacklist || [])],
    whitelist: [...(item.whitelist || [])],
  }));
}

const BOT_INVITE_LINK =
  "https://discord.com/api/oauth2/authorize?client_id=826055534318583858&permissions=274877910016&scope=bot%20applications.commands";

// Discord sends the login code back to the relay bot page of the site that asked for it.
function discordOAuthLink(hostname: string, origin: string) {
  const redirects: Record<string, string> = {
    localhost: "http%3A%2F%2Flocalhost%3A8080%2Frelaybot",
    "staging.holodex.net": "https%3A%2F%2Fstaging.holodex.net%2Frelaybot",
    "holodex.net": "https%3A%2F%2Fholodex.net%2Frelaybot",
  };
  const redirect = redirects[hostname] ?? encodeURIComponent(`${origin}/relaybot`);
  return `https://discord.com/api/oauth2/authorize?client_id=826055534318583858&redirect_uri=${redirect}&response_type=code&scope=guilds%20identify`;
}

const relayLoginMode = (hostname: string) =>
  hostname === "localhost" ? 0 : hostname === "staging.holodex.net" ? 1 : 2;

const findLang = (value: string) => TL_LANGS.find((x) => x.value === value) || TL_LANGS[0];

// A video link triggers relaying that video; a channel link relays the channel's current stream.
function relayTarget(link: string) {
  const parsed = getVideoIDFromUrl(link) as any;
  if (parsed) return { mode: 1, link: `YT_${parsed.id}` };
  const channelId = validateChannel(link);
  if (channelId) return { mode: 2, link: `YT_${channelId}` };
  return null;
}

function inviteButton(label: string) {
  return (
    <Button
      nativeButton={false}
      render={(props) => (
        <a {...props} href={BOT_INVITE_LINK} target="_blank" rel="noopener noreferrer" />
      )}
      variant="secondary"
    >
      {label}
    </Button>
  );
}

// A vertical single-select list of names (servers, channels).
function PickList({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; name: string }[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ScrollArea className="mt-4 min-h-0 flex-1 pr-1">
      <ToggleGroup
        variant="outline"
        size="sm"
        value={selected >= 0 ? [String(selected)] : []}
        onValueChange={(value) => {
          if (value[0]) onSelect(Number(value[0]));
        }}
        className="flex w-full flex-col items-stretch gap-2"
      >
        {items.map((item, index) => (
          <ToggleGroupItem
            key={item.id}
            value={String(index)}
            className="h-auto w-full justify-start px-3 py-2 text-left font-normal whitespace-normal"
          >
            {item.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </ScrollArea>
  );
}

function GuildChannels({
  guild,
  channels,
  selected,
  onSelect,
}: {
  guild: any;
  channels: any[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const t = useTranslations();
  return (
    <Card className="flex min-h-[32rem] flex-col p-4">
      <div className="border-b px-2 pb-3 text-center text-lg font-normal">
        {guild.bot ? t("views.relayBot.channelsFor", { name: guild.name }) : guild.name}
      </div>
      {!guild.bot ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-sm text-muted-foreground">{t("views.relayBot.botMissing")}</p>
          <Button
            nativeButton={false}
            render={(props) => (
              <a {...props} href={BOT_INVITE_LINK} target="_blank" rel="noopener noreferrer" />
            )}
          >
            {t("views.relayBot.inviteBot")}
          </Button>
        </div>
      ) : (
        <PickList items={channels} selected={selected} onSelect={onSelect} />
      )}
    </Card>
  );
}

function LanguageSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: any;
  onChange: (lang: any) => void;
}) {
  const t = useTranslations();
  return (
    <Field className="gap-2">
      <FieldLabel className={fieldLabelClass} htmlFor={id}>
        {t("component.common.language")}
      </FieldLabel>
      <Select value={value.value} onValueChange={(nextValue) => onChange(findLang(nextValue))}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TL_LANGS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.text} ({item.value})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// A YouTube link field, then a language picker beside the action button.
function LinkLanguageForm({
  id,
  label,
  link,
  onLink,
  lang,
  onLang,
  action,
}: {
  id: string;
  label: string;
  link: string;
  onLink: (value: string) => void;
  lang: any;
  onLang: (lang: any) => void;
  action: React.ReactNode;
}) {
  return (
    <>
      <Field className="gap-2">
        <FieldLabel className={fieldLabelClass} htmlFor={id}>
          {label}
        </FieldLabel>
        <Input id={id} value={link} onChange={(e) => onLink(e.target.value)} />
      </Field>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <LanguageSelect id={`${id}-lang`} value={lang} onChange={onLang} />
        {action}
      </div>
    </>
  );
}

function SubscriptionTable({
  setting,
  selected,
  onSelect,
  onRemove,
}: {
  setting: any[];
  selected: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const t = useTranslations();
  return (
    <div className="rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("views.relayBot.subscribedChannel")}</TableHead>
            <TableHead>{t("component.common.language")}</TableHead>
            <TableHead className="text-right">{t("component.common.remove")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {setting.map((set, index) => (
            <TableRow
              key={`${set.link}-${set.lang}`}
              className={cn("cursor-pointer", selected === index && "bg-accent")}
              onClick={() => onSelect(index)}
            >
              <TableCell>{set.link}</TableCell>
              <TableCell>{set.lang}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("component.common.remove")}
                  onClick={(e: any) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                >
                  <MinusCircle className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {setting.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                {t("views.relayBot.noSubscriptionsConfigured")}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

// Translator names on a subscription's blacklist or whitelist, with an input to add one.
function NameList({
  title,
  emptyText,
  names,
  input,
  onInput,
  onAdd,
  onRemove,
}: {
  title: string;
  emptyText: string;
  names: string[];
  input: string;
  onInput: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const t = useTranslations();
  return (
    <Card className="space-y-4 p-4">
      <h3 className="text-base font-normal">{title}</h3>
      <div className="rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("views.relayBot.translatorName")}</TableHead>
              <TableHead className="text-right">{t("component.common.remove")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {names.map((dt: string, index: number) => (
              <TableRow key={dt}>
                <TableCell>{dt}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("component.common.remove")}
                    onClick={() => onRemove(index)}
                  >
                    <MinusCircle className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {names.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder={t("views.relayBot.translatorName")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) onAdd();
          }}
        />
        <Button
          variant="secondary"
          aria-label={t("views.multiview.video.addUrlShort")}
          onClick={onAdd}
        >
          <CirclePlus className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export default function RelayBotPage() {
  return (
    <Suspense fallback={null}>
      <RelayBot />
    </Suspense>
  );
}

function RelayBot() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [loggedIn, setLoggedIn] = useState(false);
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
  // The login link needs the page's own host, known only in the browser.
  const origin = useOrigin();
  const discordOAuth2Links = origin ? discordOAuthLink(new URL(origin).hostname, origin) : "#";
  useEffect(() => {
    document.title = "RelayBot - Holodex";
  }, []);
  const selectedGuildData = selectedGuild >= 0 ? guilds[selectedGuild] : null;
  const selectedChannelData = selectedChannel >= 0 ? channels[selectedChannel] : null;
  const selectedRow = selectedSetting >= 0 ? setting[selectedSetting] : undefined;
  function init(code: string | null) {
    setLoggedIn(false);
    if (!code) return;
    api
      .relayBotLogin(code, relayLoginMode(location.hostname))
      .then(({ status, data }: any) => {
        if (status === 200) {
          setSelectedChannel(-1);
          setSelectedGuild(-1);
          setLoggedIn(true);
          const nextGuilds = data.guilds
            .filter((e: any) => e.admin)
            .map((e: any) => ({ id: e.id, name: e.name, bot: false }));
          setGuilds(nextGuilds);
          api
            .relayBotCheckBotPresence(nextGuilds.map((e: any) => e.id))
            .then(({ status, data }: any) => {
              if (status !== 200) return;
              const withBot = new Set(data);
              setGuilds(nextGuilds.map((e: any) => ({ ...e, bot: withBot.has(e.id) })));
            })
            .catch(() => setLoggedIn(false));
        }
      })
      .catch(() => setLoggedIn(false));
  }
  const code = searchParams.get("code");
  const login = useEffectEvent((oauthCode: string | null) => init(oauthCode));
  useEffect(() => {
    login(code);
  }, [code]);
  function loadChannel(index: number) {
    setChannels([]);
    setSelectedGuild(index);
    setSelectedChannel(-1);
    if (guilds[index].bot)
      api
        .relayBotGetChannels(guilds[index].id)
        .then(({ status, data }: any) => {
          if (status === 200) setChannels(data.map((e: any) => ({ id: e.id, name: e.name })));
        })
        .catch(console.error);
  }
  function loadSetting(index: number) {
    setSelectedChannel(index);
    setChannelInpt("");
    setSelectedSetting(-1);
    setLangInpt(TL_LANGS[0]);
    setLangRelayInput(TL_LANGS[0]);
    setSaveNotif("");
    setSetting([]);
    api
      .relayBotGetSettingChannel(channels[index].id)
      .then(({ status, data }: any) => {
        if (status === 200)
          setSetting(
            data.SubChannel
              ? data.SubChannel.map((e: any) => ({
                  ...e,
                  lang: e.lang || "en",
                  whitelist: e.whitelist || [],
                  blacklist: e.blacklist || [],
                }))
              : [],
          );
      })
      .catch(console.error);
  }
  function addSetting() {
    const channelId = validateChannel(channelInpt);
    if (!channelId) return;
    const setPush = { link: `YT_${channelId}`, lang: langInpt.value };
    setSetting((cur) =>
      cur.some((e) => e.link === setPush.link && e.lang === setPush.lang) ? cur : [...cur, setPush],
    );
    setChannelInpt("");
    setLangInpt(TL_LANGS[0]);
  }
  function selectSetting(index: number) {
    setSelectedSetting(index);
    setBlacklistInput("");
    setWhitelistInput("");
  }
  function addList(kind: "blacklist" | "whitelist", rawValue: string, clearInput: () => void) {
    const value = rawValue.trim();
    if (!value || selectedSetting < 0) return;
    const other = kind === "blacklist" ? "whitelist" : "blacklist";
    if (setting[selectedSetting][kind].includes(value)) {
      clearInput();
      return;
    }
    const next = cloneSettings(setting);
    const row = next[selectedSetting];
    row[kind].push(value);
    row[other] = row[other].filter((e: string) => e !== value);
    setSetting(next);
  }
  function removeList(kind: "blacklist" | "whitelist", index: number) {
    setSetting((cur) => {
      const next = cloneSettings(cur);
      next[selectedSetting][kind].splice(index, 1);
      return next;
    });
  }
  function saveSetting() {
    if (!selectedChannelData) return;
    setSaveNotif(t("views.relayBot.saving"));
    api
      .relayBotSubmitData(selectedChannelData.id, setting)
      .then(({ status }: any) => {
        if (status === 200) setSaveNotif(t("views.relayBot.saved"));
      })
      .catch((err: any) => setSaveNotif(String(err)));
  }
  function triggerRelay() {
    if (!selectedChannelData) return;
    const target = relayTarget(relayInput);
    if (!target) return;
    setRelayInput(t("views.relayBot.sendingTrigger"));
    api
      .relayBotTrigger(selectedChannelData.id, target.mode, target.link, langRelayInput.value)
      .then(({ status }: any) => {
        if (status === 200) setRelayInput(t("views.relayBot.ok"));
      })
      .catch(() => setRelayInput(t("views.relayBot.notOk")));
  }
  return (
    <section className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-10 pt-(--nav-total-height,120px) sm:px-5 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("views.relayBot.title")}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("views.relayBot.description")}</p>
      </header>
      {!loggedIn ? (
        <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center sm:flex-row">
          <Button
            nativeButton={false}
            render={(props) => <a {...props} href={discordOAuth2Links} />}
          >
            {t("views.relayBot.loginDiscord")}
          </Button>
          {inviteButton(t("views.relayBot.inviteBot"))}
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_0.9fr_1.5fr]">
          <Card className="flex min-h-[32rem] flex-col p-4">
            <div className="border-b px-2 pb-3 text-center text-lg font-normal">
              {t("views.relayBot.servers")}
            </div>
            <PickList items={guilds} selected={selectedGuild} onSelect={loadChannel} />
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {t("views.relayBot.serverNotShown")}
            </p>
          </Card>
          {selectedGuildData ? (
            <GuildChannels
              guild={selectedGuildData}
              channels={channels}
              selected={selectedChannel}
              onSelect={loadSetting}
            />
          ) : null}
          {selectedChannelData ? (
            <Card className="space-y-6 p-5">
              <div>
                <h2 className="text-lg font-normal">
                  {t("views.relayBot.settingFor", { name: selectedChannelData.name })}
                </h2>
              </div>
              <section className="space-y-3">
                <LinkLanguageForm
                  id="relaybot-trigger-link"
                  label={t("views.relayBot.youtubeLinkChannelVideo")}
                  link={relayInput}
                  onLink={setRelayInput}
                  lang={langRelayInput}
                  onLang={setLangRelayInput}
                  action={
                    <Button className="self-end" onClick={triggerRelay}>
                      {t("views.relayBot.relayTL")}
                    </Button>
                  }
                />
              </section>
              <section className="space-y-3 border-t pt-6">
                <h3 className="text-sm font-normal text-muted-foreground">
                  {t("views.relayBot.relaySubscription")}
                </h3>
                <LinkLanguageForm
                  id="relaybot-channel"
                  label={t("views.relayBot.youtubeChannel")}
                  link={channelInpt}
                  onLink={setChannelInpt}
                  lang={langInpt}
                  onLang={setLangInpt}
                  action={
                    <Button className="self-end" onClick={addSetting}>
                      <CirclePlus className="h-4 w-4" />
                      {t("views.relayBot.addSubscription")}
                    </Button>
                  }
                />
              </section>
              <section className="space-y-3 border-t pt-6">
                <SubscriptionTable
                  setting={setting}
                  selected={selectedSetting}
                  onSelect={selectSetting}
                  onRemove={(index) => {
                    setSelectedSetting(-1);
                    setSetting((cur) => cur.filter((_, i) => i !== index));
                  }}
                />
              </section>
              {selectedRow ? (
                <section className="grid gap-4 border-t pt-6 lg:grid-cols-2">
                  <NameList
                    title={t("views.relayBot.blacklist")}
                    emptyText={t("views.relayBot.noBlacklistEntries")}
                    names={selectedRow.blacklist || []}
                    input={blacklistInput}
                    onInput={setBlacklistInput}
                    onAdd={() => addList("blacklist", blacklistInput, () => setBlacklistInput(""))}
                    onRemove={(index) => removeList("blacklist", index)}
                  />
                  <NameList
                    title={t("views.relayBot.whitelist")}
                    emptyText={t("views.relayBot.noWhitelistEntries")}
                    names={selectedRow.whitelist || []}
                    input={whitelistInput}
                    onInput={setWhitelistInput}
                    onAdd={() => addList("whitelist", whitelistInput, () => setWhitelistInput(""))}
                    onRemove={(index) => removeList("whitelist", index)}
                  />
                </section>
              ) : null}
              <section className="border-t pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button onClick={saveSetting}>{t("component.common.save")}</Button>
                  <p className="text-sm text-muted-foreground">{saveNotif}</p>
                </div>
              </section>
            </Card>
          ) : null}
        </div>
      )}
    </section>
  );
}
