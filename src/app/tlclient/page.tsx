"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { LiveTranslations } from "@/components/chat/LiveTranslations";
import { VideoSelector } from "@/components/multiview/VideoSelector";
import { TwitchPlayer } from "@/components/player/TwitchPlayer";
import { YoutubePlayer } from "@/components/player/YoutubePlayer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TlProfileLegend } from "@/components/tl/TlProfileLegend";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { openUserMenu, readJSON, writeJSON } from "@/lib/browser";
import { CHAT_EMBED_SANDBOX, TL_LANGS, VIDEO_URL_REGEX } from "@/lib/consts";
import { getVideoIDFromUrl } from "@/lib/functions";
import { useHostname } from "@/lib/hooks";
import { CirclePlus, CircleX, Home, MinusCircle, Settings, XIcon } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useStoredState } from "@/lib/stored-state";
import { newTlProfileId, withTlProfileIds } from "@/lib/tl-format";
import { cn } from "@/lib/utils";

const defaultProfile = [
  {
    id: "default",
    Name: "Default",
    Prefix: "",
    Suffix: "",
    useCC: false,
    CC: "#000000",
    useOC: false,
    OC: "#000000",
  },
];
const playerEmbedClass =
  "h-full w-full [&>div]:h-full [&>div]:w-full [&>div>iframe]:h-full [&>div>iframe]:w-full [&>iframe]:h-full [&>iframe]:w-full";

let collabLinkSeq = 0;
const newCollabLink = () => ({ id: collabLinkSeq++, link: "" });

// postMessage target for the extension's sync on embedded YouTube/Twitch chats.
function chatOrigin(chat: string) {
  if (chat.startsWith("YT_")) return "https://www.youtube.com";
  if (chat.startsWith("TW_")) return "https://www.twitch.tv";
  return null;
}

function chatEmbedUrl(chat: string, host: string) {
  const id = chat.slice(3);
  if (chat.startsWith("YT_"))
    return `https://www.youtube.com/live_chat?v=${id}&embed_domain=${host}`;
  if (chat.startsWith("TW_")) return `https://www.twitch.tv/embed/${id}/chat?parent=${host}`;
  return "";
}

const blankProfile = (name: string) => ({
  id: newTlProfileId(),
  Name: name,
  Prefix: "",
  Suffix: "",
  useCC: false,
  CC: "#000000",
  useOC: false,
  OC: "#000000",
});

// Saved TL profiles (prefix/suffix/colors), the active one, and the legend that briefly shows
// the list whenever the active profile changes.
function useTlProfiles() {
  const [profile, setProfile] = useStoredState<any[]>(
    "tldex-profiles",
    defaultProfile,
    withTlProfileIds,
  );
  const [profileIdx, setProfileIdx] = useState(0);
  const [profileDisplay, setProfileDisplay] = useState(false);
  const profileDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (profileDisplayTimer.current) clearTimeout(profileDisplayTimer.current);
    },
    [],
  );

  function showProfileList() {
    if (!profileDisplay) setProfileDisplay(true);
    if (profileDisplayTimer.current) clearTimeout(profileDisplayTimer.current);
    profileDisplayTimer.current = setTimeout(() => {
      setProfileDisplay(false);
      profileDisplayTimer.current = null;
    }, 3000);
  }

  // Moves the active profile one place; the default profile (index 0) stays first.
  function swapProfile(dir: -1 | 1) {
    if (
      (dir === -1 && profileIdx <= 1) ||
      (dir === 1 && (profileIdx === 0 || profileIdx >= profile.length - 1))
    )
      return showProfileList();
    setProfile((prev) => {
      const n = [...prev];
      [n[profileIdx + dir], n[profileIdx]] = [n[profileIdx], n[profileIdx + dir]];
      return n;
    });
    setProfileIdx((i) => i + dir);
    showProfileList();
  }
  const up = () => {
    setProfileIdx((i) => (i === 0 ? profile.length - 1 : i - 1));
    showProfileList();
  };
  const down = (isTab: boolean) => {
    setProfileIdx((i) => (i === profile.length - 1 ? (isTab ? 1 : 0) : i + 1));
    showProfileList();
  };
  const jump = (i: number) => {
    if (i < profile.length) setProfileIdx(i);
    showProfileList();
  };
  function add(rawName: string) {
    const name = rawName.trim() || `Profile ${profile.length}`;
    setProfile((p) => [...p, blankProfile(name)]);
    setProfileIdx(profile.length);
    showProfileList();
  }
  function remove() {
    if (profileIdx !== 0) {
      setProfile((p) => p.filter((_, i) => i !== profileIdx));
      setProfileIdx((i) => i - 1);
    }
    showProfileList();
  }
  const updateField = (field: string, value: string) =>
    setProfile((p) => p.map((item, i) => (i === profileIdx ? { ...item, [field]: value } : item)));

  return {
    profile,
    profileIdx,
    profileDisplay,
    current: profile[profileIdx] || profile[0] || defaultProfile[0],
    shiftUp: () => swapProfile(-1),
    shiftDown: () => swapProfile(1),
    up,
    down,
    jump,
    add,
    remove,
    updateField,
  };
}

type TlProfiles = ReturnType<typeof useTlProfiles>;

// Up/Down cycle profiles, Tab/Shift-Tab jump between custom profiles and the default,
// Ctrl+digit picks a profile; Enter sends (except while an IME is composing).
function handleTlKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  profiles: TlProfiles,
  send: () => void,
) {
  if (e.nativeEvent.isComposing) return;
  if (e.key === "Enter") return send();
  if (e.ctrlKey && /^[0-9]$/.test(e.key)) {
    e.preventDefault();
    return profiles.jump(Number(e.key));
  }
  if (e.ctrlKey || !["Tab", "ArrowUp", "ArrowDown"].includes(e.key)) return;
  e.preventDefault();
  if (e.key === "ArrowUp") profiles.up();
  else if (e.key === "ArrowDown") profiles.down(false);
  else if (e.shiftKey) profiles.jump(0);
  else profiles.down(true);
}

function TlClientMenu({
  scriptEditorHref,
  vidPlayer,
  onSettings,
  onToggleVideo,
  onLoadChat,
  onUnloadChat,
}: {
  scriptEditorHref: string;
  vidPlayer: boolean;
  onSettings: () => void;
  onToggleVideo: () => void;
  onLoadChat: () => void;
  onUnloadChat: () => void;
}) {
  const t = useTranslations();
  return (
    <Card className="flex flex-wrap items-center gap-2 p-3">
      <Button nativeButton={false} render={<Link href="/" />} size="sm" variant="outline">
        <Home className="size-4" />
        {t("component.mainNav.home")}
      </Button>
      <Button size="sm" variant="outline" onClick={onSettings}>
        {t("views.tlClient.menu.setting")}
      </Button>
      <Button
        nativeButton={false}
        render={<Link href={scriptEditorHref} />}
        size="sm"
        variant="outline"
      >
        {t("component.videoCard.openScriptEditor")}
      </Button>
      <div className="mx-auto hidden md:block" />
      <Button size="sm" variant="outline" onClick={onToggleVideo}>
        {!vidPlayer ? t("views.tlClient.menu.loadVideo") : t("views.tlClient.menu.unloadVideo")}
      </Button>
      <Button size="sm" variant="outline" onClick={onLoadChat}>
        {t("views.tlClient.menu.loadChat")}
      </Button>
      <Button size="sm" variant="outline" onClick={onUnloadChat}>
        {t("views.tlClient.menu.unloadChat")}
      </Button>
    </Card>
  );
}

function ChatFrame({
  chat,
  host,
  onClose,
  onLoad,
}: {
  chat: string;
  host: string;
  onClose: () => void;
  onLoad: (event: React.SyntheticEvent<HTMLIFrameElement>) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex min-h-0 flex-col border-b last:border-b-0">
      <div className="flex items-center justify-between px-3 py-2 text-sm">
        <span>{chat}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("component.common.close")}
          onClick={onClose}
        >
          <CircleX className="size-4" />
        </Button>
      </div>
      <iframe
        className="h-full min-h-0 w-full flex-1"
        src={chatEmbedUrl(chat, host)}
        title={chat}
        sandbox={CHAT_EMBED_SANDBOX}
        frameBorder={0}
        onLoad={onLoad}
      />
    </div>
  );
}

function TlShortcutHelp() {
  const t = useTranslations();
  return (
    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
      <div>{t("views.tlClient.shortcuts.whileTyping")}</div>
      <div>
        <Kbd>Up⇧</Kbd> {t("views.tlClient.shortcuts.or")} <Kbd>Down⇩</Kbd>{" "}
        {t("views.tlClient.shortcuts.changeProfiles")}
      </div>
      <div>
        <Kbd>Ctrl+[0~9]</Kbd> {t("views.tlClient.shortcuts.quickSwitchProfileRange")}
      </div>
      <div>
        <Kbd>Tab↹</Kbd> {t("views.tlClient.shortcuts.quickSwitchProfiles")}
      </div>
      <div>
        <Kbd>Shift⇧-Tab↹</Kbd> {t("views.tlClient.shortcuts.quickSwitchDefaultProfile")}
      </div>
    </div>
  );
}

function TextSetting({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

// The active profile's prefix/suffix, the local chat prefix, and profile management buttons.
function ProfileSettings({
  profiles,
  localPrefix,
  onLocalPrefix,
  onClose,
  onAddProfile,
  onRemoveProfile,
}: {
  profiles: TlProfiles;
  localPrefix: string;
  onLocalPrefix: (value: string) => void;
  onClose: () => void;
  onAddProfile: () => void;
  onRemoveProfile: () => void;
}) {
  const t = useTranslations();
  const current = profiles.current;
  return (
    <div className="mt-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">
            {t("views.tlClient.tlControl.currentProfileSettings", { name: current.Name })}
          </div>
          <TlShortcutHelp />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("component.common.close")}
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        <TextSetting
          id="tlclient-profile-prefix"
          label={t("views.tlClient.tlControl.prefix")}
          value={current.Prefix}
          onChange={(value) => profiles.updateField("Prefix", value)}
        />
        <TextSetting
          id="tlclient-profile-suffix"
          label={t("views.tlClient.tlControl.suffix")}
          value={current.Suffix}
          onChange={(value) => profiles.updateField("Suffix", value)}
        />
        <TextSetting
          id="tlclient-local-prefix"
          label={t("views.tlClient.tlControl.localPrefix")}
          value={localPrefix}
          onChange={onLocalPrefix}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onAddProfile}>
          {t("views.tlClient.tlControl.addProfile")}
        </Button>
        <Button variant="secondary" onClick={onRemoveProfile}>
          {t("views.tlClient.tlControl.removeProfile")} ({current.Name})
        </Button>
        <Button variant="secondary" onClick={profiles.shiftUp}>
          {t("views.tlClient.tlControl.shiftUp")}
        </Button>
        <Button variant="secondary" onClick={profiles.shiftDown}>
          {t("views.tlClient.tlControl.shiftDown")}
        </Button>
      </div>
    </div>
  );
}

// A dialog body: title, optional content, then cancel / OK.
function ConfirmPanel({
  title,
  children,
  onCancel,
  onConfirm,
}: {
  title: string;
  children?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-5 p-6">
      <h2 className="text-lg font-normal">{title}</h2>
      {children}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onCancel}>
          {t("views.tlClient.cancelBtn")}
        </Button>
        <Button className="ml-auto" onClick={onConfirm}>
          {t("views.tlClient.okBtn")}
        </Button>
      </div>
    </div>
  );
}

function CollabLinksField({
  links,
  onChange,
}: {
  links: { id: number; link: string }[];
  onChange: (
    update: (links: { id: number; link: string }[]) => { id: number; link: string }[],
  ) => void;
}) {
  const t = useTranslations();
  return (
    <Field className="gap-3">
      <FieldLabel>{t("views.tlClient.settingPanel.collabLink")}</FieldLabel>
      {links.map((auxLink) => (
        <div key={auxLink.id} className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("component.common.remove")}
            onClick={() => {
              if (links.length !== 1) onChange((p) => p.filter((item) => item.id !== auxLink.id));
            }}
          >
            <MinusCircle className="size-4" />
          </Button>
          <Input
            value={auxLink.link}
            className="flex-1"
            onChange={(event) =>
              onChange((prev) =>
                prev.map((item) =>
                  item.id === auxLink.id ? { ...item, link: event.target.value } : item,
                ),
              )
            }
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={t("views.multiview.video.addUrlShort")}
            onClick={() => onChange((prev) => [...prev, newCollabLink()])}
          >
            <CirclePlus className="size-4" />
          </Button>
        </div>
      ))}
    </Field>
  );
}

// Session setup: TL language, the main stream link (or picking a video), and collab links.
function SettingsPanel({
  username,
  tlLang,
  onTlLang,
  mainStreamLink,
  onMainStreamLink,
  collabLinks,
  onCollabLinks,
  onFindVideo,
  onChangeUsername,
  onConfirm,
}: {
  username?: string;
  tlLang: any;
  onTlLang: (lang: any) => void;
  mainStreamLink: string;
  onMainStreamLink: (value: string) => void;
  collabLinks: { id: number; link: string }[];
  onCollabLinks: (
    update: (links: { id: number; link: string }[]) => { id: number; link: string }[],
  ) => void;
  onFindVideo: () => void;
  onChangeUsername: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-5 p-6">
      <div>
        <h2 className="text-lg font-normal">{t("views.tlClient.settingPanel.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("views.watch.uploadPanel.usernameText") + " : " + username + " "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 align-baseline text-xs underline underline-offset-4"
            onClick={onChangeUsername}
          >
            {t("views.watch.uploadPanel.usernameChange")}
          </Button>
        </p>
      </div>
      <Field className="gap-2">
        <FieldLabel htmlFor="tlclient-language">{t("views.watch.uploadPanel.tlLang")}</FieldLabel>
        <Select
          value={tlLang.value}
          onValueChange={(value) =>
            onTlLang(TL_LANGS.find((item) => item.value === value) || TL_LANGS[0])
          }
        >
          <SelectTrigger id="tlclient-language" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TL_LANGS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {`${item.text} (${item.value})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <Field className="flex-1 gap-2">
          <FieldLabel htmlFor="tlclient-main-stream-link">
            {t("views.tlClient.settingPanel.mainStreamLink")}
          </FieldLabel>
          <Input
            id="tlclient-main-stream-link"
            value={mainStreamLink}
            placeholder="https://..."
            onChange={(event) => onMainStreamLink(event.target.value)}
          />
        </Field>
        <span className="text-sm text-muted-foreground">{t("component.common.or")}</span>
        <Button variant="secondary" onClick={onFindVideo}>
          {t("views.tlClient.settingPanel.findVideo")}
        </Button>
      </div>
      <CollabLinksField links={collabLinks} onChange={onCollabLinks} />
      <div className="flex justify-center">
        <Button onClick={onConfirm}>{t("views.tlClient.okBtn")}</Button>
      </div>
    </div>
  );
}

// Panel sizes (TL chat height, video width with one / several chats), saved across visits.
function useTlLayout(chatCount: number) {
  const [tlChatPanelSize, setTlChatPanelSize] = useState(38);
  const [videoPanelWidth1, setVideoPanelWidth1] = useState(60);
  const [videoPanelWidth2, setVideoPanelWidth2] = useState(40);

  function restore() {
    const saved = readJSON("Holodex-TLClient", {} as Record<string, number>);
    if (saved.tlChatPanelSize) setTlChatPanelSize(saved.tlChatPanelSize);
    if (saved.videoPanelWidth1) setVideoPanelWidth1(saved.videoPanelWidth1);
    if (saved.videoPanelWidth2) setVideoPanelWidth2(saved.videoPanelWidth2);
  }

  const persist = (tl = tlChatPanelSize, w1 = videoPanelWidth1, w2 = videoPanelWidth2) =>
    writeJSON("Holodex-TLClient", {
      tlChatPanelSize: tl,
      videoPanelWidth1: w1,
      videoPanelWidth2: w2,
    });

  function onMainLayout(l: Record<string, number>) {
    const size = l["tlclient-main"];
    if (!chatCount || !size) return;
    if (chatCount < 2) {
      setVideoPanelWidth1(size);
      persist(tlChatPanelSize, size, videoPanelWidth2);
    } else {
      setVideoPanelWidth2(size);
      persist(tlChatPanelSize, videoPanelWidth1, size);
    }
  }

  function onVideoStackLayout(l: Record<string, number>) {
    const t = l["tlclient-translations"];
    if (!t) return;
    setTlChatPanelSize(t);
    persist(t);
  }

  return {
    tlChatPanelSize,
    videoPanelWidth: chatCount < 2 ? videoPanelWidth1 : videoPanelWidth2,
    restore,
    onMainLayout,
    onVideoStackLayout,
  };
}

type TlLayout = ReturnType<typeof useTlLayout>;

// The stream player above the TL feed (resizable), or just the feed when no video is loaded.
function TlMainPanel({
  parsedMain,
  showPlayer,
  layout,
  translations,
  legend,
}: {
  parsedMain: any;
  showPlayer: boolean;
  layout: TlLayout;
  translations: React.ReactNode;
  legend: React.ReactNode;
}) {
  return (
    <Card className="relative flex h-full min-h-0 flex-col overflow-hidden p-0">
      {showPlayer && parsedMain ? (
        <ResizablePanelGroup
          orientation="vertical"
          className="min-h-0 flex-1"
          onLayoutChanged={layout.onVideoStackLayout}
        >
          <ResizablePanel
            id="tlclient-player"
            defaultSize={100 - layout.tlChatPanelSize}
            minSize={25}
            className="min-h-0"
          >
            <div id="player" className="h-full w-full overflow-hidden">
              {parsedMain.type !== "twitch" ? (
                <YoutubePlayer videoId={parsedMain.id} className={playerEmbedClass} />
              ) : (
                <TwitchPlayer channel={parsedMain.id} className={playerEmbedClass} />
              )}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="tlclient-translations"
            defaultSize={layout.tlChatPanelSize}
            minSize={20}
            className="min-h-0"
          >
            {translations}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        translations
      )}
      {legend}
    </Card>
  );
}

// The TL input between the active profile's prefix and suffix, send, and the settings toggle.
function TlInputBar({
  profiles,
  value,
  onChange,
  onSend,
  settingsShown,
  onToggleSettings,
}: {
  profiles: TlProfiles;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  settingsShown: boolean;
  onToggleSettings: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="flex flex-1 items-center gap-2 rounded-md border px-3 py-2">
        <span className="shrink-0 text-sm text-muted-foreground">{profiles.current.Prefix}</span>
        <Input
          value={value}
          className="border-0 bg-transparent px-0 shadow-none focus:ring-0"
          placeholder={t("views.tlClient.tlControl.inputPlaceholder")}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(e) => handleTlKeyDown(e, profiles, onSend)}
        />
        <span className="shrink-0 text-sm text-muted-foreground">{profiles.current.Suffix}</span>
      </div>
      <Button className="lg:self-start" onClick={onSend}>
        {t("views.tlClient.tlControl.enterBtn")}
      </Button>
      <Button variant="outline" className="lg:self-start" onClick={onToggleSettings}>
        {settingsShown
          ? t("views.tlClient.tlControl.hideSetting")
          : t("views.tlClient.tlControl.showSetting")}
        <Settings className="size-4" />
      </Button>
    </div>
  );
}

function ProfileLegendCard({
  profiles,
  showNextTab,
}: {
  profiles: TlProfiles;
  showNextTab?: boolean;
}) {
  return (
    <Card className="absolute bottom-1 right-1 flex flex-col gap-1 p-3 text-xs">
      <TlProfileLegend
        profiles={profiles.profile}
        activeIndex={profiles.profileIdx}
        showNextTab={showNextTab}
      />
    </Card>
  );
}

// The loaded YouTube/Twitch chats side by side (two rows from four chats on).
function ChatPanel({
  chats,
  host,
  onClose,
  onLoad,
  legend,
}: {
  chats: { text: string }[];
  host: string;
  onClose: (index: number) => void;
  onLoad: (event: React.SyntheticEvent<HTMLIFrameElement>, chat: string) => void;
  legend: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "relative grid h-full min-h-0 grid-flow-col overflow-hidden p-0",
        chats.length < 4 ? "grid-rows-1" : "grid-rows-2",
      )}
    >
      {chats.map((chat, index) => (
        <ChatFrame
          key={chat.text}
          chat={chat.text}
          host={host}
          onClose={() => onClose(index)}
          onLoad={(event) => onLoad(event, chat.text)}
        />
      ))}
      {legend}
    </Card>
  );
}

// The client's dialog: 1 add profile, 2 remove profile, 3 session settings, 4 load a chat,
// 5 unload all chats.
function TlClientDialog({
  open,
  mode,
  onOpenChange,
  onClose,
  profiles,
  newProfileName,
  onNewProfileName,
  chatLink,
  onChatLink,
  onLoadChat,
  onUnloadChats,
  settings,
}: {
  open: boolean;
  mode: number;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  profiles: TlProfiles;
  newProfileName: string;
  onNewProfileName: (value: string) => void;
  chatLink: string;
  onChatLink: (value: string) => void;
  onLoadChat: (link: string) => void;
  onUnloadChats: () => void;
  settings: React.ReactNode;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0">
        {mode === 1 ? (
          <ConfirmPanel
            title={t("views.tlClient.addProfilePanel.title")}
            onCancel={onClose}
            onConfirm={() => {
              profiles.add(newProfileName);
              onClose();
            }}
          >
            <Input
              value={newProfileName}
              placeholder={t("views.tlClient.addProfilePanel.inputLabel")}
              onChange={(event) => onNewProfileName(event.target.value)}
            />
          </ConfirmPanel>
        ) : null}
        {mode === 2 ? (
          <ConfirmPanel
            title={`${t("views.tlClient.removeProfileTitle")} ${profiles.current.Name}.`}
            onCancel={onClose}
            onConfirm={() => {
              profiles.remove();
              onClose();
            }}
          />
        ) : null}
        {mode === 3 ? settings : null}
        {mode === 4 ? (
          <ConfirmPanel
            title={t("views.tlClient.loadChatPanel.title")}
            onCancel={onClose}
            onConfirm={() => {
              onLoadChat(chatLink);
              onClose();
            }}
          >
            <Input
              value={chatLink}
              placeholder={t("views.tlClient.loadChatPanel.inputLabel")}
              onChange={(event) => onChatLink(event.target.value)}
            />
          </ConfirmPanel>
        ) : null}
        {mode === 5 ? (
          <ConfirmPanel
            title={t("views.tlClient.unloadChatTitle")}
            onCancel={onClose}
            onConfirm={() => {
              onUnloadChats();
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// Mirrors a sent TL into an embedded YouTube/Twitch chat through the Holodex+ extension.
function postToChatFrame(
  chat: { text: string; IFrameEle?: HTMLIFrameElement | null },
  text: string,
) {
  const origin = chatOrigin(chat.text);
  if (origin) chat.IFrameEle?.contentWindow?.postMessage({ n: "HolodexSync", d: text }, origin);
}

// Posts one TL entry to a video (or, for links that aren't YouTube videos, a custom id).
function postTlEntry({
  id,
  customId,
  withToast,
  jwt,
  lang,
  body,
}: {
  id: string;
  customId?: string;
  withToast: boolean;
  jwt: string;
  lang: string;
  body: Record<string, unknown>;
}) {
  return api
    .postTL({
      videoId: id || "custom",
      jwt,
      lang,
      ...(customId && { custom_video_id: customId }),
      body,
    })
    .then(({ status, data }: any) => {
      if (status !== 200) {
        console.error(data);
        if (withToast) toast.error(String(data));
      }
    })
    .catch((err: any) => {
      console.error(err);
      if (withToast) toast.error(String(err));
    });
}

const scriptEditorHref = (video: any, mainStreamLink: string) =>
  `/scripteditor?video=${encodeURIComponent(video.id ? `YT_${video.id}` : mainStreamLink)}`;

// The TL feed for the main stream (a custom id when the link isn't a known video).
function TlFeed({
  tlLang,
  video,
  mainStreamLink,
  stickBottom,
}: {
  tlLang: string;
  video: any;
  mainStreamLink: string;
  stickBottom: boolean;
}) {
  return (
    <LiveTranslations
      tlLang={tlLang}
      tlClient
      video={!video?.id ? { id: mainStreamLink, isCustom: true } : video}
      className={cn("h-full", stickBottom && "flex-col-reverse")}
      useLocalSubtitleToggle={false}
    />
  );
}

export default function TLClientPage() {
  return (
    <Suspense fallback={null}>
      <TLClient />
    </Suspense>
  );
}

function TLClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appStore = useAppState();
  const hostname = useHostname();
  const profiles = useTlProfiles();
  const [mainStreamLink, setMainStreamLink] = useStoredState("tldex-lastlink", "");
  const [TLSetting, setTLSetting] = useState(true);
  // Only read by the settings OK handler, so it doesn't need to re-render.
  const firstLoad = useRef(true);
  const [inputString, setInputString] = useState("");
  const [localPrefix, setLocalPrefix] = useState(`[${TL_LANGS[0].value}] `);
  const [modalNexus, setModalNexus] = useState(true);
  const [modalMode, setModalMode] = useState(3);
  const [addProfileNameString, setAddProfileNameString] = useState("");
  const [TLLang, setTLLang] = useState<any>(TL_LANGS[0]);
  const [collabLinks, setCollabLinks] = useState(() => [newCollabLink()]);
  const [videoSelectDialog, setVideoSelectDialog] = useState(false);
  const [activeChat, setActiveChat] = useState<
    Array<{ text: string; IFrameEle?: HTMLIFrameElement | null }>
  >([]);
  const [activeURLStream, setActiveURLStream] = useState("");
  const [vidPlayer, setVidPlayer] = useState(false);
  const [video, setVideo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  const layout = useTlLayout(activeChat.length);
  const liveTlStickBottom = appStore.settings.liveTlStickBottom;
  const userdata = appStore.userdata;
  const { profile, profileIdx, profileDisplay } = profiles;

  const reset = useEffectEvent(() => init());
  const restoreLayout = useEffectEvent(() => layout.restore());
  useEffect(() => {
    document.title = "TLClient - Holodex";
    reset();
    restoreLayout();
  }, []);

  // `?video=` opens the client on that stream; the param is then dropped from the URL.
  const openQueryVideo = useEffectEvent((queryVideo: string) => {
    setMainStreamLink(queryVideo);
    init();
    router.replace("/tlclient");
  });
  useEffect(() => {
    const queryVideo = searchParams.get("video");
    if (queryVideo) openQueryVideo(queryVideo);
  }, [searchParams]);

  function init() {
    firstLoad.current = true;
    setModalNexus(true);
    setModalMode(3);
    setCollabLinks([newCollabLink()]);
    setVidPlayer(false);
    setActiveChat([]);
    appStore.loginVerify({ bounceToLogin: true });
  }

  function onChatFrameLoad(event: React.SyntheticEvent<HTMLIFrameElement>, target: string) {
    setActiveChat((prev) =>
      prev.map((item) =>
        item.text === target ? { ...item, IFrameEle: event.currentTarget } : item,
      ),
    );
    const origin = chatOrigin(target);
    if (!origin) return;
    const send = () =>
      event.currentTarget.contentWindow?.postMessage({ n: "HolodexSync", d: "Initiate" }, origin);
    if (target.startsWith("YT_")) setTimeout(send, 5000);
    else send();
  }

  function addEntry() {
    const p = profile[profileIdx];
    const message = p.Prefix + inputString + p.Suffix;
    for (const e of activeChat) postToChatFrame(e, localPrefix + message);
    const body = {
      name: userdata.user.username,
      message,
      cc: p.useCC ? p.CC : "",
      oc: p.useOC ? p.OC : "",
      source: "user",
    };
    const post = (id: string, customId?: string, withToast = false) =>
      postTlEntry({ id, customId, withToast, jwt: userdata.jwt, lang: TLLang.value, body });
    post(video?.id, video?.id ? undefined : mainStreamLink);
    collabLinks.forEach(({ link }) => {
      if (!link) return;
      const ytId = link.match(VIDEO_URL_REGEX)?.groups?.id;
      post(ytId || "", ytId ? undefined : link, true);
    });
    setInputString("");
  }

  const modalOutsideClick = () => {
    if (modalMode !== 3) setModalNexus(false);
  };
  const openModal = (mode: number) => {
    setModalMode(mode);
    setModalNexus(true);
  };
  const closeModal = () => setModalNexus(false);

  async function settingOKClick() {
    const ytId = mainStreamLink.match(VIDEO_URL_REGEX)?.groups?.id || mainStreamLink;
    setIsLoading(true);
    setVideo({});
    if (ytId && ytId !== mainStreamLink) {
      api
        .video(ytId, TLLang.value)
        .then(({ data }: any) => setVideo(data))
        .catch(() => setVideo({ id: ytId }))
        .finally(() => setIsLoading(false));
    } else {
      setVideo({});
      setIsLoading(false);
    }
    setLocalPrefix(`[${TLLang.value}] `);
    setModalNexus(false);
    if (firstLoad.current) {
      loadChat(mainStreamLink);
      setVidPlayer(true);
      collabLinks.forEach(({ link }) => loadChat(link));
      firstLoad.current = false;
    }
  }

  const closeChat = (i: number) => setActiveChat((p) => p.filter((_, x) => x !== i));

  function loadChat(s: string) {
    const url: any = getVideoIDFromUrl(s);
    if (!url) return;
    setActiveChat((p) => [
      ...p,
      { text: `${url.type === "twitch" ? "TW_" : "YT_"}${url.id}`, IFrameEle: undefined },
    ]);
  }

  const handleVideoClicked = (v: any) => {
    setVideoSelectDialog(false);
    setMainStreamLink(v.type === "placeholder" ? v.link : `https://youtube.com/watch?v=${v.id}`);
  };

  const parsedMain = getVideoIDFromUrl(mainStreamLink) as any;
  const hasChats = activeChat.length > 0;
  const translations = !isLoading ? (
    <TlFeed
      tlLang={TLLang.value}
      video={video}
      mainStreamLink={mainStreamLink}
      stickBottom={liveTlStickBottom}
    />
  ) : null;

  return (
    <section className="flex h-screen max-h-screen flex-col gap-4 px-3 py-3">
      <TlClientMenu
        scriptEditorHref={scriptEditorHref(video, mainStreamLink)}
        vidPlayer={vidPlayer}
        onSettings={() => openModal(3)}
        onToggleVideo={() => setVidPlayer(!vidPlayer)}
        onLoadChat={() => {
          openModal(4);
          setActiveURLStream("");
        }}
        onUnloadChat={() => openModal(5)}
      />

      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1 gap-3"
        onLayoutChanged={layout.onMainLayout}
      >
        <ResizablePanel
          id="tlclient-main"
          defaultSize={hasChats ? layout.videoPanelWidth : 100}
          minSize={hasChats ? 33 : undefined}
          maxSize={hasChats ? 75 : undefined}
          className="min-h-0"
        >
          <TlMainPanel
            parsedMain={parsedMain}
            showPlayer={vidPlayer}
            layout={layout}
            translations={translations}
            legend={
              profileDisplay && activeChat.length > 1 ? (
                <ProfileLegendCard profiles={profiles} />
              ) : null
            }
          />
        </ResizablePanel>

        {hasChats ? <ResizableHandle withHandle /> : null}

        {hasChats ? (
          <ResizablePanel
            id="tlclient-chat"
            defaultSize={100 - layout.videoPanelWidth}
            minSize={25}
            className="min-h-0"
          >
            <ChatPanel
              chats={activeChat}
              host={hostname}
              onClose={closeChat}
              onLoad={onChatFrameLoad}
              legend={
                profileDisplay && activeChat.length < 2 ? (
                  <ProfileLegendCard profiles={profiles} showNextTab />
                ) : null
              }
            />
          </ResizablePanel>
        ) : null}
      </ResizablePanelGroup>

      <Card className="p-3">
        <TlInputBar
          profiles={profiles}
          value={inputString}
          onChange={setInputString}
          onSend={addEntry}
          settingsShown={TLSetting}
          onToggleSettings={() => setTLSetting(!TLSetting)}
        />

        {TLSetting ? (
          <ProfileSettings
            profiles={profiles}
            localPrefix={localPrefix}
            onLocalPrefix={setLocalPrefix}
            onClose={() => setTLSetting(false)}
            onAddProfile={() => {
              openModal(1);
              setAddProfileNameString(`Profile ${profile.length}`);
            }}
            onRemoveProfile={() => openModal(2)}
          />
        ) : null}
      </Card>

      <TlClientDialog
        open={modalNexus}
        mode={modalMode}
        onOpenChange={(o) => (o ? setModalNexus(true) : modalOutsideClick())}
        onClose={closeModal}
        profiles={profiles}
        newProfileName={addProfileNameString}
        onNewProfileName={setAddProfileNameString}
        chatLink={activeURLStream}
        onChatLink={setActiveURLStream}
        onLoadChat={loadChat}
        onUnloadChats={() => setActiveChat([])}
        settings={
          <SettingsPanel
            username={userdata.user?.username}
            tlLang={TLLang}
            onTlLang={(next) => {
              setTLLang(next);
              setLocalPrefix(`[${next.value}] `);
            }}
            mainStreamLink={mainStreamLink}
            onMainStreamLink={setMainStreamLink}
            collabLinks={collabLinks}
            onCollabLinks={setCollabLinks}
            onFindVideo={() => setVideoSelectDialog(true)}
            onChangeUsername={() => {
              openUserMenu();
              router.push("/");
            }}
            onConfirm={settingOKClick}
          />
        }
      />

      <Dialog open={videoSelectDialog} onOpenChange={setVideoSelectDialog}>
        <DialogContent className="w-[min(94vw,30rem)] p-0 sm:w-auto sm:max-w-[75vw]">
          <VideoSelector isActive={videoSelectDialog} onVideoClicked={handleVideoClicked} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
