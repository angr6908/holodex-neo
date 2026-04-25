"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { mdiClose, mdiCloseCircle, mdiCog, mdiCogOff, mdiHome, mdiMinusCircle, mdiPlusCircle } from "@mdi/js";
import { api } from "@/lib/api";
import { TL_LANGS, VIDEO_URL_REGEX } from "@/lib/consts";
import { getVideoIDFromUrl } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { LiveTranslations } from "@/components/chat/LiveTranslations";
import { VideoSelector } from "@/components/multiview/VideoSelector";
import { YoutubePlayer } from "@/components/player/YoutubePlayer";
import { TwitchPlayer } from "@/components/player/TwitchPlayer";
import { openUserMenu } from "@/lib/navigation-events";

const defaultProfile = [{
  Name: "Default",
  Prefix: "",
  Suffix: "",
  useCC: false,
  CC: "#000000",
  useOC: false,
  OC: "#000000",
}];

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function TLClientPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appStore = useAppState();
  const [profile, setProfile] = useState<any[]>(defaultProfile);
  const [mainStreamLink, setMainStreamLink] = useState("");
  const [TLSetting, setTLSetting] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [profileIdx, setProfileIdx] = useState(0);
  const [profileDisplay, setProfileDisplay] = useState(false);
  const profileDisplayTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [inputString, setInputString] = useState("");
  const [localPrefix, setLocalPrefix] = useState(`[${TL_LANGS[0].value}] `);
  const [modalNexus, setModalNexus] = useState(true);
  const [modalMode, setModalMode] = useState(3);
  const [addProfileNameString, setAddProfileNameString] = useState("");
  const [TLLang, setTLLang] = useState<any>(TL_LANGS[0]);
  const [collabLinks, setCollabLinks] = useState<string[]>([""]);
  const [videoSelectDialog, setVideoSelectDialog] = useState(false);
  const [activeChat, setActiveChat] = useState<Array<{ text: string; IFrameEle?: HTMLIFrameElement | null }>>([]);
  const [activeURLStream, setActiveURLStream] = useState("");
  const [vidPlayer, setVidPlayer] = useState(false);
  const [tlChatHeight, setTlChatHeight] = useState(200);
  const [videoPanelWidth1, setVideoPanelWidth1] = useState(60);
  const [videoPanelWidth2, setVideoPanelWidth2] = useState(40);
  const [resizeActive, setResizeActive] = useState(false);
  const [resizeMode, setResizeMode] = useState(0);
  const [resizePos, setResizePos] = useState(0);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | false>(false);
  const [menuBool, setMenuBool] = useState(false);
  const [video, setVideo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  const mainLinkIsCustom = !video?.id;
  const activeChatGridRow = activeChat.length < 4 ? { gridTemplateRows: "1fr" } : { gridTemplateRows: "1fr 1fr" };
  const liveTlStickBottom = appStore.settings.liveTlStickBottom;
  const userdata = appStore.userdata;

  useEffect(() => {
    document.title = "TLClient - Holodex";
    setProfile(readStorage("tldex-profiles", defaultProfile));
    setMainStreamLink(readStorage("tldex-lastlink", ""));
    init();
    const defaultSetting = localStorage.getItem("Holodex-TLClient");
    if (defaultSetting) {
      const parsed = JSON.parse(defaultSetting);
      if (parsed.tlChatHeight) setTlChatHeight(parsed.tlChatHeight);
      if (parsed.videoPanelWidth1) setVideoPanelWidth1(parsed.videoPanelWidth1);
      if (parsed.videoPanelWidth2) setVideoPanelWidth2(parsed.videoPanelWidth2);
    }
  }, []);

  useEffect(() => { writeStorage("tldex-profiles", profile); }, [profile]);
  useEffect(() => { writeStorage("tldex-lastlink", mainStreamLink); }, [mainStreamLink]);

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

  useEffect(() => () => { if (profileDisplayTimer.current) clearInterval(profileDisplayTimer.current); }, []);

  function handleModalOpen(open: boolean) {
    if (!open) modalNexusOutsideClick();
    else setModalNexus(true);
  }

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
    setActiveChat((prev) => prev.map((item) => item.text === target ? { ...item, IFrameEle: event.currentTarget } : item));
    switch (target.slice(0, 3)) {
      case "YT_": {
        const eventWindow = event.currentTarget.contentWindow;
        if (eventWindow) {
          setTimeout(() => {
            eventWindow.postMessage({ n: "HolodexSync", d: "Initiate" }, "https://www.youtube.com");
          }, 5000);
        }
        break;
      }
      case "TW_": {
        event.currentTarget.contentWindow?.postMessage({ n: "HolodexSync", d: "Initiate" }, "https://www.twitch.tv");
        break;
      }
      default:
        break;
    }
  }

  function addEntry() {
    activeChat.forEach((e) => {
      switch (e.text.slice(0, 3)) {
        case "YT_":
          e.IFrameEle?.contentWindow?.postMessage({ n: "HolodexSync", d: localPrefix + profile[profileIdx].Prefix + inputString + profile[profileIdx].Suffix }, "https://www.youtube.com");
          break;
        case "TW_":
          e.IFrameEle?.contentWindow?.postMessage({ n: "HolodexSync", d: localPrefix + profile[profileIdx].Prefix + inputString + profile[profileIdx].Suffix }, "https://www.twitch.tv");
          break;
        default:
          break;
      }
    });

    const bodydt = {
      name: userdata.user.username,
      message: profile[profileIdx].Prefix + inputString + profile[profileIdx].Suffix,
      cc: profile[profileIdx].useCC ? profile[profileIdx].CC : "",
      oc: profile[profileIdx].useOC ? profile[profileIdx].OC : "",
      source: "user",
    };

    api.postTL({ videoId: video?.id || "custom", jwt: userdata.jwt, lang: TLLang.value, ...(!video?.id && { custom_video_id: mainStreamLink }), body: bodydt }).then(({ status, data }: any) => {
      if (status !== 200) console.error(data);
    }).catch((err: any) => console.error(err));

    collabLinks.forEach((link) => {
      if (!link) return;
      const ytVideoId = link.match(VIDEO_URL_REGEX)?.groups?.id;
      api.postTL({ videoId: ytVideoId || "custom", jwt: userdata.jwt, lang: TLLang.value, ...(!ytVideoId && { custom_video_id: link }), body: bodydt }).then(({ status, data }: any) => {
        if (status !== 200) {
          console.error(data);
          setErrorMessage(data);
          setShowErrorAlert(true);
        }
      }).catch((err: any) => {
        console.error(err);
        setErrorMessage(err);
        setShowErrorAlert(true);
      });
    });

    setInputString("");
  }

  function deleteAuxLink(idx: number) {
    if (collabLinks.length !== 1) setCollabLinks((prev) => prev.filter((_, index) => index !== idx));
  }

  function modalNexusOutsideClick() {
    if (modalMode !== 3) setModalNexus(false);
  }

  async function settingOKClick() {
    const ytId = mainStreamLink.match(VIDEO_URL_REGEX)?.groups?.id || mainStreamLink;
    setIsLoading(true);
    setVideo({});
    if (ytId && ytId !== mainStreamLink) {
      api.video(ytId, TLLang.value).then(({ data }: any) => setVideo(data)).catch(() => setVideo({ id: ytId })).finally(() => setIsLoading(false));
    } else {
      setVideo({});
      setIsLoading(false);
    }

    setLocalPrefix(`[${TLLang.value}] `);
    setModalNexus(false);
    if (firstLoad) {
      loadChat(mainStreamLink);
      loadVideo();
      collabLinks.forEach((e) => loadChat(e));
      setFirstLoad(false);
    }
  }

  function shiftProfileUp() {
    if (profileIdx > 1) {
      setProfile((prev) => {
        const next = [...prev];
        const profileContainer = JSON.parse(JSON.stringify(next[profileIdx - 1]));
        next[profileIdx - 1] = next[profileIdx];
        next[profileIdx] = profileContainer;
        return next;
      });
      setProfileIdx((idx) => idx - 1);
    }
    showProfileList();
  }

  function shiftProfileDown() {
    if (profileIdx !== 0 && profileIdx < profile.length - 1) {
      setProfile((prev) => {
        const next = [...prev];
        const profileContainer = JSON.parse(JSON.stringify(next[profileIdx + 1]));
        next[profileIdx + 1] = next[profileIdx];
        next[profileIdx] = profileContainer;
        return next;
      });
      setProfileIdx((idx) => idx + 1);
    }
    showProfileList();
  }

  function profileUp() {
    setProfileIdx((idx) => idx === 0 ? profile.length - 1 : idx - 1);
    showProfileList();
  }

  function profileDown(isTab: boolean) {
    setProfileIdx((idx) => idx === profile.length - 1 ? (isTab ? 1 : 0) : idx + 1);
    showProfileList();
  }

  function profileJump(idx: number) {
    if (idx < profile.length) setProfileIdx(idx);
    showProfileList();
  }

  function profileJumpToDefault() {
    setProfileIdx(0);
    showProfileList();
  }

  function addProfile() {
    let name = addProfileNameString;
    if (name.trim() === "") name = `Profile ${profile.length}`;
    setProfile((prev) => [...prev, { Name: name, Prefix: "", Suffix: "", useCC: false, CC: "#000000", useOC: false, OC: "#000000" }]);
    setProfileIdx(profile.length);
    setModalNexus(false);
    showProfileList();
  }

  function deleteProfile() {
    if (profileIdx !== 0) {
      const removeIdx = profileIdx;
      setProfileIdx((idx) => idx - 1);
      setProfile((prev) => prev.filter((_, idx) => idx !== removeIdx));
    }
    setModalNexus(false);
    showProfileList();
  }

  function showProfileList() {
    if (!profileDisplay) setProfileDisplay(true);
    if (profileDisplayTimer.current) clearInterval(profileDisplayTimer.current);
    profileDisplayTimer.current = setInterval(() => {
      setProfileDisplay(false);
      if (profileDisplayTimer.current) clearInterval(profileDisplayTimer.current);
    }, 3000);
  }

  function unloadAll() { setActiveChat([]); }
  function closeActiveChat(idx: number) { setActiveChat((prev) => prev.filter((_, index) => index !== idx)); }

  function URLExtender(s: string) {
    switch (s.slice(0, 3)) {
      case "YT_": return `https://www.youtube.com/live_chat?v=${s.slice(3)}&embed_domain=${window.location.hostname}`;
      case "TW_": return `https://www.twitch.tv/embed/${s.slice(3)}/chat?parent=${window.location.hostname}`;
      default: return "";
    }
  }

  function loadChat(s: string) {
    const StreamURL: any = getVideoIDFromUrl(s);
    if (StreamURL) {
      switch (StreamURL.type) {
        case "twitch":
          setActiveChat((prev) => [...prev, { text: `TW_${StreamURL.id}`, IFrameEle: undefined }]);
          break;
        default:
          setActiveChat((prev) => [...prev, { text: `YT_${StreamURL.id}`, IFrameEle: undefined }]);
          break;
      }
    }
  }

  function loadVideo() { setVidPlayer(true); }
  function unloadVideo() { setVidPlayer(false); }

  function persistLayout(nextTl = tlChatHeight, next1 = videoPanelWidth1, next2 = videoPanelWidth2) {
    localStorage.setItem("Holodex-TLClient", JSON.stringify({ tlChatHeight: nextTl, videoPanelWidth1: next1, videoPanelWidth2: next2 }));
  }

  function resizeMouseLeave(mode: number) {
    if (mode === resizeMode) {
      setResizeActive(false);
      persistLayout();
    }
  }

  function resizeMouseDown(event: React.MouseEvent, resizeSwitch: number) {
    if (!resizeActive) {
      setResizeActive(true);
      setResizeMode(resizeSwitch);
      setResizePos(resizeSwitch === 0 ? event.clientY : event.clientX);
    }
  }

  function resizeMouseUp() {
    setResizeActive(false);
    persistLayout();
  }

  function resizeMouseMove(event: React.MouseEvent) {
    if (resizeActive) {
      if (resizeMode === 0) {
        const yChange = event.clientY - resizePos;
        setResizePos(event.clientY);
        if (tlChatHeight - yChange < 100) return;
        setTlChatHeight((h) => h - yChange);
      } else {
        const xChange = ((event.clientX - resizePos) * 100) / window.innerWidth;
        setResizePos(event.clientX);
        if (activeChat.length < 2) {
          if (videoPanelWidth1 + xChange > 75 || videoPanelWidth1 + xChange < 33) return;
          setVideoPanelWidth1((w) => w + xChange);
        } else {
          if (videoPanelWidth2 + xChange > 75 || videoPanelWidth2 + xChange < 33) return;
          setVideoPanelWidth2((w) => w + xChange);
        }
      }
    }
  }

  async function checkLoginValidity() { appStore.loginVerify({ bounceToLogin: true }); }
  function changeUsernameClick() { openUserMenu(); router.push("/"); }
  function handleVideoClicked(selectedVideo: any) {
    setVideoSelectDialog(false);
    setMainStreamLink(selectedVideo.type === "placeholder" ? selectedVideo.link : `https://youtube.com/watch?v=${selectedVideo.id}`);
  }

  function updateProfileField(field: string, value: string) {
    setProfile((prev) => prev.map((item, idx) => idx === profileIdx ? { ...item, [field]: value } : item));
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") addEntry();
    if (event.key === "ArrowUp" && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); profileUp(); }
    if (event.key === "ArrowDown" && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); profileDown(false); }
    if (event.key === "Tab" && !event.shiftKey) { event.preventDefault(); profileDown(true); }
    if (event.key === "Tab" && event.shiftKey) { event.preventDefault(); profileJumpToDefault(); }
    if (event.ctrlKey && /^[0-9]$/.test(event.key)) { event.preventDefault(); profileJump(Number(event.key)); }
  }

  const parsedMain = getVideoIDFromUrl(mainStreamLink) as any;
  const currentProfile = profile[profileIdx] || profile[0] || defaultProfile[0];

  return (
    <section className="flex h-screen max-h-screen flex-col gap-4 px-3 py-3">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Button as={Link} size="sm" variant="outline" href="/">
          <Icon icon={mdiHome} size="sm" />
          {t("component.mainNav.home")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setModalMode(3); setModalNexus(true); }}>
          {t("views.tlClient.menu.setting")}
        </Button>
        <Button as={Link} size="sm" variant="outline" href={`/scripteditor?video=${encodeURIComponent(video.id ? `YT_${video.id}` : mainStreamLink)}`}>
          {t("component.videoCard.openScriptEditor")}
        </Button>
        <div className="mx-auto hidden md:block" />
        {!vidPlayer ? <Button size="sm" variant="outline" onClick={loadVideo}>{t("views.tlClient.menu.loadVideo")}</Button> : <Button size="sm" variant="outline" onClick={unloadVideo}>{t("views.tlClient.menu.unloadVideo")}</Button>}
        <Button size="sm" variant="outline" onClick={() => { setModalMode(4); setModalNexus(true); setActiveURLStream(""); }}>
          {t("views.tlClient.menu.loadChat")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setModalMode(5); setModalNexus(true); }}>
          {t("views.tlClient.menu.unloadChat")}
        </Button>
      </Card>

      <div className="flex min-h-0 flex-1 items-stretch gap-3" onClick={() => setMenuBool(false)} onMouseMove={resizeMouseMove} onMouseLeave={() => resizeMouseLeave(1)} onMouseUp={resizeMouseUp}>
        <div className="glass-panel relative flex min-h-0 flex-col overflow-hidden rounded-[calc(var(--radius)+6px)]" style={{ width: `${activeChat.length < 2 ? videoPanelWidth1 : videoPanelWidth2}%` }} onMouseLeave={() => resizeMouseLeave(0)}>
          {resizeActive ? <div className="absolute inset-0 z-10 bg-transparent" /> : null}
          {vidPlayer && parsedMain ? (
            <div className="min-h-0 flex-1 overflow-hidden border-b border-white/10">
              <div id="player" className="h-full w-full">
                {parsedMain.type !== "twitch" ? <YoutubePlayer videoId={parsedMain.id} /> : <TwitchPlayer channel={parsedMain.id} />}
              </div>
            </div>
          ) : null}
          {vidPlayer ? (
            <button type="button" className="flex h-2 cursor-s-resize items-center justify-center bg-white/6" onMouseDown={(event) => resizeMouseDown(event, 0)}>
              <span className="h-[3px] min-w-10 rounded-full bg-white/30" />
            </button>
          ) : null}
          {!isLoading ? (
            <LiveTranslations
              tlLang={TLLang.value}
              tlClient
              video={mainLinkIsCustom ? { id: mainStreamLink, isCustom: true } : video}
              className={`${liveTlStickBottom ? "stick-bottom" : ""}`}
              style={{ height: vidPlayer ? `${tlChatHeight}px` : "100%" }}
              useLocalSubtitleToggle={false}
            />
          ) : null}
          {profileDisplay && activeChat.length > 1 ? (
            <div className="ProfileListCard glass-panel flex flex-col gap-1 rounded-xl px-3 py-2 text-xs text-slate-200">
              {profile.map((prf, index) => <span key={`profilecard${index}`} className={index === profileIdx ? "font-medium text-sky-300" : ""}>{index === profileIdx ? <span>&gt; </span> : null}{index > 0 ? <kbd>Ctrl-{index}</kbd> : null}{index === 0 ? <kbd>Ctrl-{index} | Shift⇧-Tab↹</kbd> : null}{" " + prf.Name}</span>)}
            </div>
          ) : null}
        </div>

        {activeChat.length > 0 ? (
          <button type="button" className="flex w-[7px] cursor-e-resize items-center justify-center" onMouseDown={(event) => resizeMouseDown(event, 1)}>
            <span className="my-auto h-[10%] min-h-10 w-[3px] rounded-full bg-white/30" />
          </button>
        ) : null}

        {activeChat.length > 0 ? (
          <div className="ChatPanelContainer glass-panel relative grid min-h-0 flex-1 overflow-hidden rounded-[calc(var(--radius)+6px)]" style={activeChatGridRow}>
            {resizeActive ? <div className="absolute inset-0 z-10 bg-transparent" /> : null}
            {activeChat.map((ChatURL, index) => (
              <div key={ChatURL.text} className="flex min-h-0 flex-col border-b border-white/8 last:border-b-0">
                <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-200">
                  <span>{ChatURL.text}</span>
                  <button type="button" className="text-slate-400 hover:text-white" onClick={() => closeActiveChat(index)}>
                    <Icon icon={mdiCloseCircle} size="sm" />
                  </button>
                </div>
                <iframe className="activeChatIFrame min-h-0 flex-1" src={URLExtender(ChatURL.text)} frameBorder={0} onLoad={(event) => IFrameLoaded(event, ChatURL.text)} />
              </div>
            ))}
            {profileDisplay && activeChat.length < 2 ? (
              <div className="ProfileListCard glass-panel flex flex-col gap-1 rounded-xl px-3 py-2 text-xs text-slate-200">
                {profile.map((prf, index) => <span key={`profilecard${index}`} className={index === profileIdx ? "font-medium text-sky-300" : ""}>{index === profileIdx ? <span>&gt; </span> : null}{index > 0 ? <kbd>Ctrl-{index}</kbd> : null}{index === 0 ? <kbd>Ctrl-{index} | Shift⇧-Tab↹</kbd> : null}{index === Math.max(1, (profileIdx + 1) % profile.length) ? <kbd className="ml-1">Tab↹</kbd> : null}{" " + prf.Name}</span>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2">
            <span className="shrink-0 text-sm text-slate-400">{currentProfile.Prefix}</span>
            <Input value={inputString} className="border-0 bg-transparent px-0 shadow-none focus:ring-0" placeholder="Type TL Here <Enter key to send>" onChange={(event) => setInputString(event.target.value)} onKeyDown={handleInputKeyDown} />
            <span className="shrink-0 text-sm text-slate-400">{currentProfile.Suffix}</span>
          </div>
          <Button className="lg:self-start" onClick={addEntry}>{t("views.tlClient.tlControl.enterBtn")}</Button>
          <Button variant="outline" className="lg:self-start" onClick={() => setTLSetting(!TLSetting)}>
            {TLSetting ? t("views.tlClient.tlControl.hideSetting") : t("views.tlClient.tlControl.showSetting")}
            <Icon icon={TLSetting ? mdiCogOff : mdiCog} size="sm" />
          </Button>
        </div>

        {TLSetting ? (
          <div className="mt-3 rounded-[calc(var(--radius)+6px)] border border-white/10 bg-white/4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">Current Profile [{currentProfile.Name}] Settings</div>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <div>While typing in TL box</div>
                  <div><kbd>Up⇧</kbd> or <kbd>Down⇩</kbd> to change Profiles</div>
                  <div><kbd>Ctrl+[0~9]</kbd> to quick switch to Profile 0-9</div>
                  <div><kbd>Tab↹</kbd> to quick switch between Profiles 1-9 (0 is special)</div>
                  <div><kbd>Shift⇧-Tab↹</kbd> to quick switch to Profile 0</div>
                </div>
              </div>
              <button type="button" className="text-slate-400 hover:text-white" onClick={() => setTLSetting(false)}><Icon icon={mdiClose} size="sm" /></button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
              <label className="space-y-2"><span className="block text-sm font-medium text-slate-300">{t("views.tlClient.tlControl.prefix")}</span><Input value={currentProfile.Prefix} onChange={(event) => updateProfileField("Prefix", event.target.value)} /></label>
              <label className="space-y-2"><span className="block text-sm font-medium text-slate-300">{t("views.tlClient.tlControl.suffix")}</span><Input value={currentProfile.Suffix} onChange={(event) => updateProfileField("Suffix", event.target.value)} /></label>
              <label className="space-y-2"><span className="block text-sm font-medium text-slate-300">{t("views.tlClient.tlControl.localPrefix")}</span><Input value={localPrefix} onChange={(event) => setLocalPrefix(event.target.value)} /></label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setModalMode(1); setModalNexus(true); setAddProfileNameString(`Profile ${profile.length}`); }}>{t("views.tlClient.tlControl.addProfile")}</Button>
              <Button variant="secondary" onClick={() => { setModalMode(2); setModalNexus(true); }}>{t("views.tlClient.tlControl.removeProfile")} ({currentProfile.Name})</Button>
              <Button variant="secondary" onClick={shiftProfileUp}>{t("views.tlClient.tlControl.shiftUp")}</Button>
              <Button variant="secondary" onClick={shiftProfileDown}>{t("views.tlClient.tlControl.shiftDown")}</Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog open={modalNexus} className="max-w-[600px]" onOpenChange={handleModalOpen}>
        {modalMode === 1 ? (
          <div className="space-y-5 p-6">
            <h2 className="text-lg font-semibold text-white">{t("views.tlClient.addProfilePanel.title")}</h2>
            <Input value={addProfileNameString} placeholder={t("views.tlClient.addProfilePanel.inputLabel")} onChange={(event) => setAddProfileNameString(event.target.value)} />
            <div className="flex items-center gap-3"><Button variant="ghost" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button className="ml-auto" onClick={addProfile}>{t("views.tlClient.okBtn")}</Button></div>
          </div>
        ) : modalMode === 2 ? (
          <div className="space-y-5 p-6"><h2 className="text-lg font-semibold text-white">{t("views.tlClient.removeProfileTitle") + " " + currentProfile.Name}.</h2><div className="flex items-center gap-3"><Button variant="ghost" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button className="ml-auto" onClick={deleteProfile}>{t("views.tlClient.okBtn")}</Button></div></div>
        ) : modalMode === 3 ? (
          <div className="space-y-5 p-6">
            <div><h2 className="text-lg font-semibold text-white">{t("views.tlClient.settingPanel.title")}</h2><p className="mt-2 text-sm text-slate-400">{t("views.watch.uploadPanel.usernameText") + " : " + userdata.user?.username + " "}<a className="underline underline-offset-4 hover:text-sky-300" onClick={changeUsernameClick}>{t("views.watch.uploadPanel.usernameChange")}</a></p></div>
            <label className="block space-y-2"><span className="text-sm font-medium text-slate-300">{t("views.watch.uploadPanel.tlLang")}</span><select value={TLLang.value} className="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20" onChange={(event) => { const next = TL_LANGS.find((item) => item.value === event.target.value) || TL_LANGS[0]; setTLLang(next); setLocalPrefix(`[${next.value}] `); }}>{TL_LANGS.map((item) => <option key={item.value} value={item.value} className="bg-slate-950">{item.text + " (" + item.value + ")"}</option>)}</select></label>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end"><label className="flex-1 space-y-2"><span className="block text-sm font-medium text-slate-300">{t("views.tlClient.settingPanel.mainStreamLink")}</span><Input value={mainStreamLink} placeholder="https://..." onChange={(event) => setMainStreamLink(event.target.value)} /></label><span className="text-sm text-slate-500">or</span><Button variant="secondary" onClick={() => setVideoSelectDialog(true)}>Find Video</Button></div>
            <div className="space-y-3"><div className="text-sm font-medium text-slate-300">{t("views.tlClient.settingPanel.collabLink")}</div>{collabLinks.map((AuxLink, index) => <div key={index} className="flex gap-2"><Button variant="outline" size="icon" onClick={() => deleteAuxLink(index)}><Icon icon={mdiMinusCircle} size="sm" /></Button><Input value={AuxLink} className="flex-1" onChange={(event) => setCollabLinks((prev) => prev.map((item, idx) => idx === index ? event.target.value : item))} /><Button variant="outline" size="icon" onClick={() => setCollabLinks((prev) => [...prev, ""])}><Icon icon={mdiPlusCircle} size="sm" /></Button></div>)}</div>
            <div className="flex justify-center"><Button onClick={settingOKClick}>{t("views.tlClient.okBtn")}</Button></div>
          </div>
        ) : modalMode === 4 ? (
          <div className="space-y-5 p-6"><h2 className="text-lg font-semibold text-white">{t("views.tlClient.loadChatPanel.title")}</h2><Input value={activeURLStream} placeholder={t("views.tlClient.loadChatPanel.inputLabel")} onChange={(event) => setActiveURLStream(event.target.value)} /><div className="flex items-center gap-3"><Button variant="ghost" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button className="ml-auto" onClick={() => { loadChat(activeURLStream); setModalNexus(false); }}>{t("views.tlClient.okBtn")}</Button></div></div>
        ) : modalMode === 5 ? (
          <div className="space-y-5 p-6"><h2 className="text-lg font-semibold text-white">{t("views.tlClient.unloadChatTitle")}</h2><div className="flex items-center gap-3"><Button variant="ghost" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button className="ml-auto" onClick={() => { unloadAll(); setModalNexus(false); }}>{t("views.tlClient.okBtn")}</Button></div></div>
        ) : null}
      </Dialog>

      <Dialog open={videoSelectDialog} className="w-[min(94vw,30rem)] sm:w-auto sm:max-w-[75vw]" onOpenChange={setVideoSelectDialog}>
        <VideoSelector isActive={videoSelectDialog} onVideoClicked={handleVideoClicked} />
      </Dialog>

      {errorMessage && showErrorAlert ? (
        <div className="fixed bottom-4 right-4 z-[120] rounded-2xl border border-rose-400/30 bg-rose-500/90 px-4 py-3 text-sm text-white shadow-2xl">
          <div className="flex items-center gap-3"><span>{errorMessage}</span><button type="button" className="text-white/80 hover:text-white" onClick={() => setShowErrorAlert(false)}><Icon icon={mdiClose} size="sm" /></button></div>
        </div>
      ) : null}
    </section>
  );
}
