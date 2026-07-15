"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LiveTranslations } from "@/components/chat/LiveTranslations";
import { VideoSelector } from "@/components/multiview/VideoSelector";
import { TwitchPlayer } from "@/components/player/TwitchPlayer";
import { YoutubePlayer } from "@/components/player/YoutubePlayer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { TL_LANGS, VIDEO_URL_REGEX } from "@/lib/consts";
import { getVideoIDFromUrl } from "@/lib/functions";
import { CirclePlus, CircleX, Home, MinusCircle, Settings, XIcon } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

const defaultProfile = [
  {
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

export default function TLClientPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appStore = useAppState();
  const [profile, setProfile] = useState<any[]>(defaultProfile);
  const [mainStreamLink, setMainStreamLink] = useState("");
  const [TLSetting, setTLSetting] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [profileIdx, setProfileIdx] = useState(0);
  const [profileDisplay, setProfileDisplay] = useState(false);
  const profileDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputString, setInputString] = useState("");
  const [localPrefix, setLocalPrefix] = useState(`[${TL_LANGS[0].value}] `);
  const [modalNexus, setModalNexus] = useState(true);
  const [modalMode, setModalMode] = useState(3);
  const [addProfileNameString, setAddProfileNameString] = useState("");
  const [TLLang, setTLLang] = useState<any>(TL_LANGS[0]);
  const [collabLinks, setCollabLinks] = useState<string[]>([""]);
  const [videoSelectDialog, setVideoSelectDialog] = useState(false);
  const [activeChat, setActiveChat] = useState<
    Array<{ text: string; IFrameEle?: HTMLIFrameElement | null }>
  >([]);
  const [activeURLStream, setActiveURLStream] = useState("");
  const [vidPlayer, setVidPlayer] = useState(false);
  const [tlChatPanelSize, setTlChatPanelSize] = useState(38);
  const [videoPanelWidth1, setVideoPanelWidth1] = useState(60);
  const [videoPanelWidth2, setVideoPanelWidth2] = useState(40);
  const [video, setVideo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  const mainLinkIsCustom = !video?.id;
  const currentVideoPanelWidth = activeChat.length < 2 ? videoPanelWidth1 : videoPanelWidth2;
  const liveTlStickBottom = appStore.settings.liveTlStickBottom;
  const userdata = appStore.userdata;

  useEffect(() => {
    document.title = "TLClient - Holodex";
    setProfile(readJSON("tldex-profiles", defaultProfile));
    setMainStreamLink(readJSON("tldex-lastlink", ""));
    init();
    const saved = readJSON("Holodex-TLClient", {} as Record<string, number>);
    if (saved.tlChatPanelSize) setTlChatPanelSize(saved.tlChatPanelSize);
    if (saved.videoPanelWidth1) setVideoPanelWidth1(saved.videoPanelWidth1);
    if (saved.videoPanelWidth2) setVideoPanelWidth2(saved.videoPanelWidth2);
  }, []);

  useEffect(() => {
    writeJSON("tldex-profiles", profile);
  }, [profile]);
  useEffect(() => {
    writeJSON("tldex-lastlink", mainStreamLink);
  }, [mainStreamLink]);

  useEffect(() => {
    const queryVideo = searchParams.get("video");
    if (queryVideo) {
      setMainStreamLink(queryVideo);
      init();
    }
  }, [searchParams]);

  useEffect(() => {
    const queryVideo = searchParams.get("video");
    if (queryVideo && mainStreamLink !== queryVideo) router.replace("/tlclient");
  }, [mainStreamLink, searchParams, router]);

  useEffect(
    () => () => {
      if (profileDisplayTimer.current) clearTimeout(profileDisplayTimer.current);
    },
    [],
  );

  function init() {
    setFirstLoad(true);
    setModalNexus(true);
    setModalMode(3);
    setCollabLinks([]);
    unloadVideo();
    unloadAll();
    checkLoginValidity();
  }

  function IFrameLoaded(event: React.SyntheticEvent<HTMLIFrameElement>, target: string) {
    setActiveChat((prev) =>
      prev.map((item) =>
        item.text === target ? { ...item, IFrameEle: event.currentTarget } : item,
      ),
    );
    const isYT = target.startsWith("YT_"),
      isTW = target.startsWith("TW_");
    if (!isYT && !isTW) return;
    const origin = isYT ? "https://www.youtube.com" : "https://www.twitch.tv";
    const send = () =>
      event.currentTarget.contentWindow?.postMessage({ n: "HolodexSync", d: "Initiate" }, origin);
    if (isYT) setTimeout(send, 5000);
    else send();
  }

  function addEntry() {
    const p = profile[profileIdx];
    const message = p.Prefix + inputString + p.Suffix;
    activeChat.forEach((e) => {
      const origin = e.text.startsWith("YT_")
        ? "https://www.youtube.com"
        : e.text.startsWith("TW_")
          ? "https://www.twitch.tv"
          : null;
      if (origin)
        e.IFrameEle?.contentWindow?.postMessage(
          { n: "HolodexSync", d: localPrefix + message },
          origin,
        );
    });
    const body = {
      name: userdata.user.username,
      message,
      cc: p.useCC ? p.CC : "",
      oc: p.useOC ? p.OC : "",
      source: "user",
    };
    const post = (id: string, customId?: string, withToast = false) =>
      api
        .postTL({
          videoId: id || "custom",
          jwt: userdata.jwt,
          lang: TLLang.value,
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
    post(video?.id, video?.id ? undefined : mainStreamLink);
    collabLinks.forEach((link) => {
      if (!link) return;
      const ytId = link.match(VIDEO_URL_REGEX)?.groups?.id;
      post(ytId || "", ytId ? undefined : link, true);
    });
    setInputString("");
  }

  const deleteAuxLink = (i: number) => {
    if (collabLinks.length !== 1) setCollabLinks((p) => p.filter((_, x) => x !== i));
  };
  const modalOutsideClick = () => {
    if (modalMode !== 3) setModalNexus(false);
  };

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
    if (firstLoad) {
      loadChat(mainStreamLink);
      setVidPlayer(true);
      collabLinks.forEach(loadChat);
      setFirstLoad(false);
    }
  }

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
  const profileUp = () => {
    setProfileIdx((i) => (i === 0 ? profile.length - 1 : i - 1));
    showProfileList();
  };
  const profileDown = (isTab: boolean) => {
    setProfileIdx((i) => (i === profile.length - 1 ? (isTab ? 1 : 0) : i + 1));
    showProfileList();
  };
  const profileJump = (i: number) => {
    if (i < profile.length) setProfileIdx(i);
    showProfileList();
  };

  function addProfile() {
    const name = addProfileNameString.trim() || `Profile ${profile.length}`;
    setProfile((p) => [
      ...p,
      {
        Name: name,
        Prefix: "",
        Suffix: "",
        useCC: false,
        CC: "#000000",
        useOC: false,
        OC: "#000000",
      },
    ]);
    setProfileIdx(profile.length);
    setModalNexus(false);
    showProfileList();
  }

  function deleteProfile() {
    if (profileIdx !== 0) {
      setProfile((p) => p.filter((_, i) => i !== profileIdx));
      setProfileIdx((i) => i - 1);
    }
    setModalNexus(false);
    showProfileList();
  }

  function showProfileList() {
    if (!profileDisplay) setProfileDisplay(true);
    if (profileDisplayTimer.current) clearTimeout(profileDisplayTimer.current);
    profileDisplayTimer.current = setTimeout(() => {
      setProfileDisplay(false);
      profileDisplayTimer.current = null;
    }, 3000);
  }

  const closeChat = (i: number) => setActiveChat((p) => p.filter((_, x) => x !== i));

  function URLExtender(s: string) {
    const id = s.slice(3),
      host = window.location.hostname;
    if (s.startsWith("YT_"))
      return `https://www.youtube.com/live_chat?v=${id}&embed_domain=${host}`;
    if (s.startsWith("TW_")) return `https://www.twitch.tv/embed/${id}/chat?parent=${host}`;
    return "";
  }

  function loadChat(s: string) {
    const url: any = getVideoIDFromUrl(s);
    if (!url) return;
    setActiveChat((p) => [
      ...p,
      { text: `${url.type === "twitch" ? "TW_" : "YT_"}${url.id}`, IFrameEle: undefined },
    ]);
  }

  const persistLayout = (tl = tlChatPanelSize, w1 = videoPanelWidth1, w2 = videoPanelWidth2) =>
    writeJSON("Holodex-TLClient", {
      tlChatPanelSize: tl,
      videoPanelWidth1: w1,
      videoPanelWidth2: w2,
    });

  function mainPanelsLayout(l: Record<string, number>) {
    const size = l["tlclient-main"];
    if (!activeChat.length || !size) return;
    if (activeChat.length < 2) {
      setVideoPanelWidth1(size);
      persistLayout(tlChatPanelSize, size, videoPanelWidth2);
    } else {
      setVideoPanelWidth2(size);
      persistLayout(tlChatPanelSize, videoPanelWidth1, size);
    }
  }

  function videoStackLayout(l: Record<string, number>) {
    const t = l["tlclient-translations"];
    if (!t) return;
    setTlChatPanelSize(t);
    persistLayout(t);
  }

  const handleVideoClicked = (v: any) => {
    setVideoSelectDialog(false);
    setMainStreamLink(v.type === "placeholder" ? v.link : `https://youtube.com/watch?v=${v.id}`);
  };

  const checkLoginValidity = () => appStore.loginVerify({ bounceToLogin: true });
  const changeUsernameClick = () => {
    openUserMenu();
    router.push("/");
  };
  const shiftProfileUp = () => swapProfile(-1);
  const shiftProfileDown = () => swapProfile(1);
  const loadVideo = () => setVidPlayer(true);
  const unloadVideo = () => setVidPlayer(false);
  const unloadAll = () => setActiveChat([]);

  const updateProfileField = (field: string, value: string) =>
    setProfile((p) => p.map((item, i) => (i === profileIdx ? { ...item, [field]: value } : item)));

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") return addEntry();
    if (e.ctrlKey && /^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return profileJump(Number(e.key));
    }
    if (e.ctrlKey || !["Tab", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    if (e.key === "ArrowUp") profileUp();
    else if (e.key === "ArrowDown") profileDown(false);
    else if (e.shiftKey) profileJump(0);
    else profileDown(true);
  }

  const parsedMain = getVideoIDFromUrl(mainStreamLink) as any;
  const currentProfile = profile[profileIdx] || profile[0] || defaultProfile[0];

  return (
    <section className="flex h-screen max-h-screen flex-col gap-4 px-3 py-3">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Button nativeButton={false} render={<Link href="/" />} size="sm" variant="outline">
          <Home className="size-4" />
          {t("component.mainNav.home")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setModalMode(3);
            setModalNexus(true);
          }}
        >
          {t("views.tlClient.menu.setting")}
        </Button>
        <Button
          nativeButton={false}
          render={
            <Link
              href={`/scripteditor?video=${encodeURIComponent(video.id ? `YT_${video.id}` : mainStreamLink)}`}
            />
          }
          size="sm"
          variant="outline"
        >
          {t("component.videoCard.openScriptEditor")}
        </Button>
        <div className="mx-auto hidden md:block" />
        {!vidPlayer ? (
          <Button size="sm" variant="outline" onClick={loadVideo}>
            {t("views.tlClient.menu.loadVideo")}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={unloadVideo}>
            {t("views.tlClient.menu.unloadVideo")}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setModalMode(4);
            setModalNexus(true);
            setActiveURLStream("");
          }}
        >
          {t("views.tlClient.menu.loadChat")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setModalMode(5);
            setModalNexus(true);
          }}
        >
          {t("views.tlClient.menu.unloadChat")}
        </Button>
      </Card>

      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1 gap-3"
        onLayoutChanged={mainPanelsLayout}
      >
        <ResizablePanel
          id="tlclient-main"
          defaultSize={activeChat.length > 0 ? currentVideoPanelWidth : 100}
          minSize={activeChat.length > 0 ? 33 : undefined}
          maxSize={activeChat.length > 0 ? 75 : undefined}
          className="min-h-0"
        >
          <Card className="relative flex h-full min-h-0 flex-col overflow-hidden p-0">
            {vidPlayer && parsedMain ? (
              <ResizablePanelGroup
                orientation="vertical"
                className="min-h-0 flex-1"
                onLayoutChanged={videoStackLayout}
              >
                <ResizablePanel
                  id="tlclient-player"
                  defaultSize={100 - tlChatPanelSize}
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
                  defaultSize={tlChatPanelSize}
                  minSize={20}
                  className="min-h-0"
                >
                  {!isLoading ? (
                    <LiveTranslations
                      tlLang={TLLang.value}
                      tlClient
                      video={mainLinkIsCustom ? { id: mainStreamLink, isCustom: true } : video}
                      className={cn("h-full", liveTlStickBottom && "flex-col-reverse")}
                      useLocalSubtitleToggle={false}
                    />
                  ) : null}
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : !isLoading ? (
              <LiveTranslations
                tlLang={TLLang.value}
                tlClient
                video={mainLinkIsCustom ? { id: mainStreamLink, isCustom: true } : video}
                className={cn("h-full", liveTlStickBottom && "flex-col-reverse")}
                useLocalSubtitleToggle={false}
              />
            ) : null}
            {profileDisplay && activeChat.length > 1 ? (
              <Card className="absolute bottom-1 right-1 flex flex-col gap-1 p-3 text-xs">
                {profile.map((prf, index) => (
                  <span
                    key={`profilecard${index}`}
                    className={index === profileIdx ? "font-medium text-primary" : ""}
                  >
                    {index === profileIdx ? <span>&gt; </span> : null}
                    {index > 0 ? <Kbd>Ctrl-{index}</Kbd> : null}
                    {index === 0 ? <Kbd>Ctrl-{index} | Shift⇧-Tab↹</Kbd> : null}
                    {` ${prf.Name}`}
                  </span>
                ))}
              </Card>
            ) : null}
          </Card>
        </ResizablePanel>

        {activeChat.length > 0 ? <ResizableHandle withHandle /> : null}

        {activeChat.length > 0 ? (
          <ResizablePanel
            id="tlclient-chat"
            defaultSize={100 - currentVideoPanelWidth}
            minSize={25}
            className="min-h-0"
          >
            <Card
              className={cn(
                "relative grid h-full min-h-0 grid-flow-col overflow-hidden p-0",
                activeChat.length < 4 ? "grid-rows-1" : "grid-rows-2",
              )}
            >
              {activeChat.map((ChatURL, index) => (
                <div key={ChatURL.text} className="flex min-h-0 flex-col border-b last:border-b-0">
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{ChatURL.text}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => closeChat(index)}
                    >
                      <CircleX className="size-4" />
                    </Button>
                  </div>
                  <iframe
                    className="h-full min-h-0 w-full flex-1"
                    src={URLExtender(ChatURL.text)}
                    frameBorder={0}
                    onLoad={(event) => IFrameLoaded(event, ChatURL.text)}
                  />
                </div>
              ))}
              {profileDisplay && activeChat.length < 2 ? (
                <Card className="absolute bottom-1 right-1 flex flex-col gap-1 p-3 text-xs">
                  {profile.map((prf, index) => (
                    <span
                      key={`profilecard${index}`}
                      className={index === profileIdx ? "font-medium text-primary" : ""}
                    >
                      {index === profileIdx ? <span>&gt; </span> : null}
                      {index > 0 ? <Kbd>Ctrl-{index}</Kbd> : null}
                      {index === 0 ? <Kbd>Ctrl-{index} | Shift⇧-Tab↹</Kbd> : null}
                      {index === Math.max(1, (profileIdx + 1) % profile.length) ? (
                        <Kbd className="ml-1">Tab↹</Kbd>
                      ) : null}
                      {` ${prf.Name}`}
                    </span>
                  ))}
                </Card>
              ) : null}
            </Card>
          </ResizablePanel>
        ) : null}
      </ResizablePanelGroup>

      <Card className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-md border px-3 py-2">
            <span className="shrink-0 text-sm text-muted-foreground">{currentProfile.Prefix}</span>
            <Input
              value={inputString}
              className="border-0 bg-transparent px-0 shadow-none focus:ring-0"
              placeholder={t("views.tlClient.tlControl.inputPlaceholder")}
              onChange={(event) => setInputString(event.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            <span className="shrink-0 text-sm text-muted-foreground">{currentProfile.Suffix}</span>
          </div>
          <Button className="lg:self-start" onClick={addEntry}>
            {t("views.tlClient.tlControl.enterBtn")}
          </Button>
          <Button
            variant="outline"
            className="lg:self-start"
            onClick={() => setTLSetting(!TLSetting)}
          >
            {TLSetting
              ? t("views.tlClient.tlControl.hideSetting")
              : t("views.tlClient.tlControl.showSetting")}
            <Settings className="size-4" />
          </Button>
        </div>

        {TLSetting ? (
          <div className="mt-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">
                  {t("views.tlClient.tlControl.currentProfileSettings", {
                    name: currentProfile.Name,
                  })}
                </div>
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
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setTLSetting(false)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
              <Field className="gap-2">
                <FieldLabel htmlFor="tlclient-profile-prefix">
                  {t("views.tlClient.tlControl.prefix")}
                </FieldLabel>
                <Input
                  id="tlclient-profile-prefix"
                  value={currentProfile.Prefix}
                  onChange={(event) => updateProfileField("Prefix", event.target.value)}
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="tlclient-profile-suffix">
                  {t("views.tlClient.tlControl.suffix")}
                </FieldLabel>
                <Input
                  id="tlclient-profile-suffix"
                  value={currentProfile.Suffix}
                  onChange={(event) => updateProfileField("Suffix", event.target.value)}
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="tlclient-local-prefix">
                  {t("views.tlClient.tlControl.localPrefix")}
                </FieldLabel>
                <Input
                  id="tlclient-local-prefix"
                  value={localPrefix}
                  onChange={(event) => setLocalPrefix(event.target.value)}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setModalMode(1);
                  setModalNexus(true);
                  setAddProfileNameString(`Profile ${profile.length}`);
                }}
              >
                {t("views.tlClient.tlControl.addProfile")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setModalMode(2);
                  setModalNexus(true);
                }}
              >
                {t("views.tlClient.tlControl.removeProfile")} ({currentProfile.Name})
              </Button>
              <Button variant="secondary" onClick={shiftProfileUp}>
                {t("views.tlClient.tlControl.shiftUp")}
              </Button>
              <Button variant="secondary" onClick={shiftProfileDown}>
                {t("views.tlClient.tlControl.shiftDown")}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog
        open={modalNexus}
        onOpenChange={(o) => (o ? setModalNexus(true) : modalOutsideClick())}
      >
        <DialogContent className="max-w-[600px] p-0">
          {modalMode === 1 ? (
            <div className="space-y-5 p-6">
              <h2 className="text-lg font-normal">{t("views.tlClient.addProfilePanel.title")}</h2>
              <Input
                value={addProfileNameString}
                placeholder={t("views.tlClient.addProfilePanel.inputLabel")}
                onChange={(event) => setAddProfileNameString(event.target.value)}
              />
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setModalNexus(false)}>
                  {t("views.tlClient.cancelBtn")}
                </Button>
                <Button className="ml-auto" onClick={addProfile}>
                  {t("views.tlClient.okBtn")}
                </Button>
              </div>
            </div>
          ) : modalMode === 2 ? (
            <div className="space-y-5 p-6">
              <h2 className="text-lg font-normal">
                {`${t("views.tlClient.removeProfileTitle")} ${currentProfile.Name}`}.
              </h2>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setModalNexus(false)}>
                  {t("views.tlClient.cancelBtn")}
                </Button>
                <Button className="ml-auto" onClick={deleteProfile}>
                  {t("views.tlClient.okBtn")}
                </Button>
              </div>
            </div>
          ) : modalMode === 3 ? (
            <div className="space-y-5 p-6">
              <div>
                <h2 className="text-lg font-normal">{t("views.tlClient.settingPanel.title")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("views.watch.uploadPanel.usernameText") +
                    " : " +
                    userdata.user?.username +
                    " "}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 align-baseline text-xs underline underline-offset-4"
                    onClick={changeUsernameClick}
                  >
                    {t("views.watch.uploadPanel.usernameChange")}
                  </Button>
                </p>
              </div>
              <Field className="gap-2">
                <FieldLabel htmlFor="tlclient-language">
                  {t("views.watch.uploadPanel.tlLang")}
                </FieldLabel>
                <Select
                  value={TLLang.value}
                  onValueChange={(value) => {
                    const next = TL_LANGS.find((item) => item.value === value) || TL_LANGS[0];
                    setTLLang(next);
                    setLocalPrefix(`[${next.value}] `);
                  }}
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
                    onChange={(event) => setMainStreamLink(event.target.value)}
                  />
                </Field>
                <span className="text-sm text-muted-foreground">{t("component.common.or")}</span>
                <Button variant="secondary" onClick={() => setVideoSelectDialog(true)}>
                  {t("views.tlClient.settingPanel.findVideo")}
                </Button>
              </div>
              <Field className="gap-3">
                <FieldLabel>{t("views.tlClient.settingPanel.collabLink")}</FieldLabel>
                {collabLinks.map((AuxLink, index) => (
                  <div key={index} className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => deleteAuxLink(index)}>
                      <MinusCircle className="size-4" />
                    </Button>
                    <Input
                      value={AuxLink}
                      className="flex-1"
                      onChange={(event) =>
                        setCollabLinks((prev) =>
                          prev.map((item, idx) => (idx === index ? event.target.value : item)),
                        )
                      }
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCollabLinks((prev) => [...prev, ""])}
                    >
                      <CirclePlus className="size-4" />
                    </Button>
                  </div>
                ))}
              </Field>
              <div className="flex justify-center">
                <Button onClick={settingOKClick}>{t("views.tlClient.okBtn")}</Button>
              </div>
            </div>
          ) : modalMode === 4 ? (
            <div className="space-y-5 p-6">
              <h2 className="text-lg font-normal">{t("views.tlClient.loadChatPanel.title")}</h2>
              <Input
                value={activeURLStream}
                placeholder={t("views.tlClient.loadChatPanel.inputLabel")}
                onChange={(event) => setActiveURLStream(event.target.value)}
              />
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setModalNexus(false)}>
                  {t("views.tlClient.cancelBtn")}
                </Button>
                <Button
                  className="ml-auto"
                  onClick={() => {
                    loadChat(activeURLStream);
                    setModalNexus(false);
                  }}
                >
                  {t("views.tlClient.okBtn")}
                </Button>
              </div>
            </div>
          ) : modalMode === 5 ? (
            <div className="space-y-5 p-6">
              <h2 className="text-lg font-normal">{t("views.tlClient.unloadChatTitle")}</h2>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setModalNexus(false)}>
                  {t("views.tlClient.cancelBtn")}
                </Button>
                <Button
                  className="ml-auto"
                  onClick={() => {
                    unloadAll();
                    setModalNexus(false);
                  }}
                >
                  {t("views.tlClient.okBtn")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={videoSelectDialog} onOpenChange={setVideoSelectDialog}>
        <DialogContent className="w-[min(94vw,30rem)] p-0 sm:w-auto sm:max-w-[75vw]">
          <VideoSelector isActive={videoSelectDialog} onVideoClicked={handleVideoClicked} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
