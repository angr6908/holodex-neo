"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mdiCog, mdiCogOff, mdiKeyboard, mdiPlay, mdiStop } from "@mdi/js";
import { api } from "@/lib/api";
import { TL_LANGS, VIDEO_URL_REGEX } from "@/lib/consts";
import { videoCodeParser } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Entrytr } from "@/components/tlscripteditor/Entrytr";
import { EnhancedEntry } from "@/components/tlscripteditor/EnhancedEntry";
import { ScriptEditorExportToFile } from "@/components/tlscripteditor/ExportToFile";
import { ImportFile } from "@/components/tlscripteditor/ImportFile";
import * as icons from "@/lib/icons";
import { openUserMenu } from "@/lib/navigation-events";

const defaultProfile = [{ Name: "Default", Prefix: "", Suffix: "", useCC: false, CC: "#000000", useOC: false, OC: "#000000" }];

function formatTs(raw: number): string {
  let timeRaw = Math.max(0, Math.floor(raw || 0));
  let s = "";
  const hh = Math.floor(timeRaw / 3600000); timeRaw -= hh * 3600000;
  s += (hh < 10 ? "0" : "") + hh + ":";
  const mm = Math.floor(timeRaw / 60000); timeRaw -= mm * 60000;
  s += (mm < 10 ? "0" : "") + mm + ":";
  const ss = Math.floor(timeRaw / 1000); timeRaw -= ss * 1000;
  s += (ss < 10 ? "0" : "") + ss + ".";
  s += timeRaw > 100 ? String(timeRaw).slice(0, 2) : timeRaw > 10 ? "0" + String(timeRaw).slice(0, 1) : "00";
  return s;
}

function cloneProfile(profile: any[]) {
  return JSON.parse(JSON.stringify(profile));
}

export function TLScriptEditorPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appStore = useAppState();
  const profileDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useRef<any>(null);
  const manualTimerTick = useRef(Date.now());
  const transactionLog = useRef<any[]>([]);
  const entriesRef = useRef<any[]>([]);
  const videoDataRef = useRef<any>(undefined);
  const TLLangRef = useRef<any>(TL_LANGS[0]);
  const activeURLStreamRef = useRef("");
  const userdataRef = useRef(appStore.userdata);
  const selectedEntryRef = useRef(-1);
  const timelineDiv = useRef<HTMLDivElement | null>(null);
  const timeCanvas1 = useRef<HTMLCanvasElement | null>(null);
  const timeCanvas2 = useRef<HTMLCanvasElement | null>(null);
  const timeCanvas3 = useRef<HTMLCanvasElement | null>(null);
  const timelineActive = useRef(false);
  const resizeMode = useRef(0);
  const xPos = useRef(0);
  const [modalNexus, setModalNexus] = useState(true);
  const [modalMode, setModalMode] = useState(5);
  const [activeURLInput, setActiveURLInput] = useState("");
  const [activeURLStream, setActiveURLStream] = useState("");
  const [TLLang, setTLLang] = useState<any>(TL_LANGS[0]);
  const [videoData, setVideoData] = useState<any>(undefined);
  const [entries, setEntries] = useState<any[]>([]);
  const [profile, setProfile] = useState<any[]>(defaultProfile);
  const [profileIdx, setProfileIdx] = useState(0);
  const [profileDisplay, setProfileDisplay] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(-1);
  const [displayEntry, setDisplayEntry] = useState(0);
  const [vidPlayer, setVidPlayer] = useState(false);
  const [timerTime, setTimerTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [barCount, setBarCount] = useState(0);
  const [menuBool, setMenuBool] = useState(false);
  const [importPanelShow, setImportPanelShow] = useState(false);
  const [TLSetting, setTLSetting] = useState(true);
  const [inputString, setInputString] = useState("");
  const [addProfileNameString, setAddProfileNameString] = useState("");
  const [offsetInput, setOffsetInput] = useState<number | string>(0);
  const [linkInput, setLinkInput] = useState("");
  const [colourDialogue, setColourDialogue] = useState(false);
  const [colourPick, setColourPick] = useState(0);
  const [colourTemp, setColourTemp] = useState("");
  const [editorMode, setEditorMode] = useState(false);
  const secToPx = 100;
  const secPerBar = 60;
  const barHeight = 25;

  const profileListPicker = useMemo(() => profile.map((item, idx) => ({ name: item.Name, idx })), [profile]);
  const selected = entries[selectedEntry];
  const timeStampStart = selected ? formatTs(selected.Time) : "00:00:00.00";
  const timeStampEnd = selected ? formatTs(selected.Time + selected.Duration) : "00:00:00.00";
  const textStyle = {
    WebkitTextFillColor: profile[profileIdx]?.CC === "" ? "unset" : profile[profileIdx]?.CC,
    WebkitTextStrokeColor: profile[profileIdx]?.OC === "" ? "unset" : profile[profileIdx]?.OC,
    WebkitTextStrokeWidth: profile[profileIdx]?.OC === "" ? "0px" : "1px",
  } as React.CSSProperties;
  const textStyle2 = selected ? {
    WebkitTextFillColor: profile[selected.Profile]?.useCC ? profile[selected.Profile].CC : "unset",
    WebkitTextStrokeColor: profile[selected.Profile]?.useOC ? profile[selected.Profile].OC : "unset",
    WebkitTextStrokeWidth: profile[selected.Profile]?.useOC ? "1px" : "0px",
  } as React.CSSProperties : {};
  const timerPrint = formatTs(timerTime);
  const timelineEntries = useMemo(() => {
    const visible: Array<{ entry: any; idx: number }> = [];
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (entry.Time + entry.Duration > (barCount + 3.0) * secPerBar * 1000) {
        if (entry.Time < (barCount + 3.0) * secPerBar * 1000) visible.push({ entry, idx: i });
        break;
      } else if (entry.Time + entry.Duration > barCount * secPerBar * 1000) {
        visible.push({ entry, idx: i });
      }
    }
    return visible;
  }, [entries, barCount]);

  function loadVideo(link = activeURLInput) {
    setActiveURLStream(link);
    setVidPlayer(true);
    const checker = window.setInterval(() => {
      const playerDiv = document.getElementById("player");
      if (!playerDiv) return;
      window.clearInterval(checker);
      if (timerActive) setTimerActive(false);
      const ytId = link.match(VIDEO_URL_REGEX)?.groups?.id;
      if (ytId) loadVideoYT(ytId);
    }, 1000);
  }

  function reloadEntries(videoObj = videoDataRef.current, link = activeURLStreamRef.current) {
    if (!videoObj) return;
    const isCustom = videoObj.id === "custom";
    return api.chatHistory(videoObj.id, {
      lang: TLLangRef.current.value,
      verified: 0,
      moderator: 0,
      vtuber: 0,
      limit: 100000,
      mode: 1,
      ...(userdataRef.current.user?.role === "user" && { creator_id: userdataRef.current.user.id }),
      ...(isCustom && { custom_video_id: videoObj.custom_video_id || link }),
    }).then(({ data }: any) => {
      const filtered = data
        .filter((e: any) => !videoObj?.start_actual || e.timestamp >= videoObj.start_actual)
        .map((e: any) => {
          const timestampShifted = e.timestamp - (videoObj?.start_actual || data?.[0]?.timestamp || 0);
          return { ...e, timestampShifted };
        });
      const next = filtered.map((e: any, index: number) => ({
        id: e.id,
        Time: e.timestampShifted,
        realTime: +e.timestamp,
        SText: e.message,
        Profile: 0,
        Duration: e.duration ? Number(e.duration) : index === filtered.length - 1 ? 3000 : filtered[index + 1].timestamp - e.timestamp,
      }));
      entriesRef.current = next;
      setEntries(next);
      setSelectedEntry(-1);
      setDisplayEntry(-1);
    }).catch(console.error);
  }

  function logChange(id: any) {
    if (transactionLog.current.filter((e) => e.id === id).length === 0) transactionLog.current.push({ type: "Change", id });
  }

  function markDelete(id: any) {
    let checkNew = transactionLog.current.filter((e) => e.id === id);
    if (checkNew.length === 0) {
      transactionLog.current.push({ type: "Delete", id });
      return;
    }
    checkNew = checkNew.filter((e) => e.type === "Change");
    transactionLog.current = transactionLog.current.filter((e) => e.id !== id);
    if (checkNew.length !== 0) transactionLog.current.push({ type: "Delete", id });
  }

  function getEntryByID(id: any, entryList = entriesRef.current) {
    return entryList.find((entry) => entry.id === id);
  }

  function processLog(forget = false, entryList = entriesRef.current, videoObj = videoDataRef.current) {
    if (transactionLog.current.length === 0) return;
    if (!videoObj) return;
    const logCopy = transactionLog.current.splice(0, transactionLog.current.length);
    const processedLog: any[] = [];
    logCopy.forEach((e) => {
      if (e.type === "Delete") {
        processedLog.push({ type: "Delete", data: { id: e.id } });
      } else if (e.type === "Change") {
        const entry = getEntryByID(e.id, entryList);
        if (entry) processedLog.push({ type: "Change", data: { lang: TLLangRef.current.value, id: entry.id, name: userdataRef.current.user?.username, timestamp: Math.floor(videoObj.start_actual ? videoObj.start_actual + entry.Time : entry.realTime), message: entry.SText, duration: Math.floor(entry.Duration) } });
      } else if (e.type === "Add") {
        const entry = getEntryByID(e.id, entryList);
        if (entry) processedLog.push({ type: "Add", data: { tempid: entry.id, name: userdataRef.current.user?.username, timestamp: Math.floor(videoObj.start_actual ? videoObj.start_actual + entry.Time : entry.realTime), message: entry.SText, duration: Math.floor(entry.Duration) } });
      }
    });
    const isCustom = videoObj.id === "custom";
    const postTLOption = { videoId: videoObj.id, jwt: userdataRef.current.jwt!, body: processedLog, lang: TLLangRef.current.value, ...(isCustom && { custom_video_id: videoObj.custom_video_id || activeURLStreamRef.current }), override: editorMode };
    if (forget) { api.postTLLog(postTLOption).catch(console.error); return; }
    api.postTLLog(postTLOption).then(({ status, data }: any) => {
      if (status === 200 && Array.isArray(data)) {
        setEntries((prev) => {
          const next = prev.map((entry) => {
            const addResult = data.find((res: any) => res.type === "Add" && res.tempid === entry.id);
            return addResult ? { ...entry, id: addResult.res.id } : entry;
          });
          entriesRef.current = next;
          return next;
        });
        data.forEach((res: any) => {
          if (res.type === "Add") transactionLog.current.forEach((e) => { if (e.id === res.tempid) e.id = res.res.id; });
        });
      }
    }).catch((err: any) => {
      console.error(err);
      alert(`Failed to save: ${err}`);
    });
  }

  function continuousTime() {
    setDisplayEntry(-1);
    setSelectedEntry(-1);
    setEntries((prev) => {
      const next = prev.map((entry, index) => {
        if (index === prev.length - 1) return entry;
        if (entry.Time + entry.Duration < prev[index + 1].Time) {
          logChange(entry.id);
          return { ...entry, Duration: prev[index + 1].Time - entry.Time };
        }
        return entry;
      });
      entriesRef.current = next;
      processLog(false, next);
      return next;
    });
  }

  function addEntry() {
    const currentProfile = profile[profileIdx] || profile[0];
    const dt = {
      id: Date.now(),
      Time: timerTime,
      Duration: 3000,
      SText: `${currentProfile.Prefix || ""}${inputString}${currentProfile.Suffix || ""}`,
      Profile: profileIdx,
      realTime: timerTime,
    };
    const next = cloneProfile(entriesRef.current);
    let inserted = false;
    for (let i = 0; i < next.length; i += 1) {
      if (next[i].Time > dt.Time) {
        if (i > 0) {
          next[i - 1].Duration = dt.Time - next[i - 1].Time;
          logChange(next[i - 1].id);
        }
        if (i < next.length) dt.Duration = next[i].Time - dt.Time;
        next.splice(i, 0, dt);
        setDisplayEntry(i);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      if (next.length !== 0) {
        next[next.length - 1].Duration = dt.Time - next[next.length - 1].Time;
        logChange(next[next.length - 1].id);
      }
      next.push(dt);
      setDisplayEntry(next.length - 1);
    }
    transactionLog.current.push({ type: "Add", id: dt.id });
    entriesRef.current = next;
    setEntries(next);
    setInputString("");
  }

  function deleteEntry() {
    if (selectedEntry < 0) return;
    const deleted = entriesRef.current[selectedEntry];
    if (!deleted) return;
    const next = entriesRef.current.filter((_, index) => index !== selectedEntry);
    markDelete(deleted.id);
    entriesRef.current = next;
    setEntries(next);
    setDisplayEntry(-1);
    setSelectedEntry(-1);
  }

  function clearAll() {
    setDisplayEntry(-1);
    setSelectedEntry(-1);
    entriesRef.current.forEach((entry) => markDelete(entry.id));
    entriesRef.current = [];
    setEntries([]);
    processLog(false, []);
    setModalNexus(false);
  }

  function setStartEntry() {
    if (selectedEntry < 0 || selectedEntry >= entriesRef.current.length) return;
    setDisplayEntry(-1);
    for (let idx = 0; idx < selectedEntry; idx += 1) {
      transactionLog.current.push({ type: "Delete", id: idx });
    }
    const keep = entriesRef.current.slice(selectedEntry);
    const timeCut = keep[0]?.Time || 0;
    const next = keep.map((entry) => {
      logChange(entry.id);
      return { ...entry, Time: entry.Time - timeCut };
    });
    entriesRef.current = next;
    setEntries(next);
    setSelectedEntry(-1);
  }

  function shiftTime() {
    const offset = Number.parseFloat(String(offsetInput));
    if (Number.isNaN(offset)) { alert("Invalid offset"); return; }
    const next = entriesRef.current.map((entry) => ({ ...entry, Time: Math.max(entry.Time + offset * 1000, 0), realTime: Math.max(Number.parseFloat(entry.realTime) + offset * 1000, 0) }));
    next.forEach((entry) => logChange(entry.id));
    entriesRef.current = next;
    setEntries(next);
    setOffsetInput(0);
  }

  function showProfileList() {
    setProfileDisplay(true);
    if (profileDisplayTimer.current) clearTimeout(profileDisplayTimer.current);
    profileDisplayTimer.current = setTimeout(() => setProfileDisplay(false), 3000);
  }

  function profileJump(idx: number) {
    if (idx >= profile.length) return;
    setProfileIdx(idx);
    showProfileList();
  }
  function profileJumpToDefault() { profileJump(0); }
  function profileDown(isTab = false) {
    setProfileIdx((idx) => {
      if (idx === profile.length - 1) return isTab ? 1 : 0;
      return idx + 1;
    });
    showProfileList();
  }
  function profileUp() {
    setProfileIdx((idx) => (idx === 0 ? profile.length - 1 : idx - 1));
    showProfileList();
  }
  function shiftProfileUp() {
    if (profileIdx <= 1) { showProfileList(); return; }
    setProfile((prev) => {
      const next = cloneProfile(prev);
      [next[profileIdx - 1], next[profileIdx]] = [next[profileIdx], next[profileIdx - 1]];
      return next;
    });
    setProfileIdx((idx) => idx - 1);
    showProfileList();
  }
  function shiftProfileDown() {
    if (profileIdx === 0 || profileIdx >= profile.length - 1) { showProfileList(); return; }
    setProfile((prev) => {
      const next = cloneProfile(prev);
      [next[profileIdx + 1], next[profileIdx]] = [next[profileIdx], next[profileIdx + 1]];
      return next;
    });
    setProfileIdx((idx) => idx + 1);
    showProfileList();
  }
  function addProfile() {
    const nextName = addProfileNameString.trim() || `Profile ${profile.length}`;
    setProfile((prev) => [...prev, { Name: nextName, Prefix: "", Suffix: "", useCC: false, CC: "#000000", useOC: false, OC: "#000000" }]);
    setProfileIdx(profile.length);
    setModalNexus(false);
    showProfileList();
  }
  function deleteProfile() {
    if (profileIdx !== 0) {
      const deletedIdx = profileIdx;
      setEntries((prev) => {
        const next = prev.map((entry) => (entry.Profile === deletedIdx ? { ...entry, Profile: 0 } : entry));
        entriesRef.current = next;
        return next;
      });
      setProfile((prev) => prev.filter((_, idx) => idx !== deletedIdx));
      setProfileIdx((idx) => Math.max(0, idx - 1));
    }
    setModalNexus(false);
    showProfileList();
  }

  function updateProfile(index: number, patch: any) {
    setProfile((prev) => prev.map((item, idx) => idx === index ? { ...item, ...patch } : item));
  }
  function colourPickerClose() {
    if (colourPick === 1) updateProfile(profileIdx, { CC: colourTemp });
    else if (colourPick === 2) updateProfile(profileIdx, { OC: colourTemp });
    setColourDialogue(false);
  }
  function colourPickerOK() { setColourDialogue(false); }
  function changeUsernameClick() { openUserMenu(); router.push("/"); }
  async function settingOKClick() {
    if (!activeURLStream) return;
    setActiveURLInput(activeURLStream);
    let vidData: any = {
      id: "custom",
      custom_video_id: activeURLStream,
      start_actual: null,
      status: null,
      title: activeURLStream,
    };
    setVideoData(vidData);
    try {
      const parseVideoID = activeURLStream.match(VIDEO_URL_REGEX)?.groups?.id;
      if (parseVideoID) {
        vidData = (await api.video(parseVideoID, TLLang.value)).data;
        if (vidData) {
          vidData = {
            id: parseVideoID,
            status: vidData.status,
            start_actual: !vidData.start_actual ? Date.parse(vidData.available_at) : Date.parse(vidData.start_actual),
            title: vidData.title,
          };
          setVideoData(vidData);
        }
      }
    } catch (e) {
      console.error(e);
    }

    setEntries([]);
    entriesRef.current = [];
    await reloadEntries(vidData, activeURLStream);

    if (vidPlayer) {
      unloadVideo();
      setTimeout(() => loadVideo(activeURLStream), 1000);
    } else {
      loadVideo(activeURLStream);
    }
    setModalNexus(false);
  }
  function updateEntry(index: number, patch: any) {
    const current = entriesRef.current[index];
    if (!current) return;
    const next = entriesRef.current.map((entry, idx) => idx === index ? { ...entry, ...patch } : entry);
    logChange(current.id);
    entriesRef.current = next;
    setEntries(next);
  }

  function processImportData({ entriesData, profileData }: { entriesData: any[]; profileData: any[] }) {
    setDisplayEntry(-1);
    setSelectedEntry(-1);
    entriesRef.current.forEach((entry) => markDelete(entry.id));

    const importedProfiles = profileData.map((item) => ({ ...item }));
    const importedEntries = entriesData.map((item) => ({ ...item }));
    const next: any[] = [];
    const nextProfile = cloneProfile(defaultProfile);
    for (let i = 1; importedProfiles.length > 0; i += 1) {
      const dt = importedProfiles.splice(0, 1)[0];
      dt.Name = `Profile${i.toString()}`;
      nextProfile.push(dt);
    }
    for (let i = 0; importedEntries.length > 0; i += 1) {
      const dt = importedEntries.splice(0, 1)[0];
      dt.id = `I${i.toString()}`;
      dt.Profile += 1;
      next.push(dt);
      transactionLog.current.push({ type: "Add", id: dt.id });
    }
    setProfile(nextProfile);
    setProfileIdx(0);
    entriesRef.current = next;
    setEntries(next);
    processLog(false, next);
  }
  function unloadVideo() {
    setVidPlayer(false);
    setTimerActive(false);
    if (player.current?.destroy) player.current.destroy();
    player.current = null;
  }

  function loadVideoYT(videoId: string) {
    const win = window as any;
    const start = () => {
      if (!document.getElementById("player")) return;
      if (player.current?.destroy) player.current.destroy();
      player.current = new win.YT.Player("player", {
        videoId,
        playerVars: { playsinline: 1 },
        events: { onReady: () => setTimerActive(true) },
      });
    };
    if (win.YT?.Player) { start(); return; }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
    Object.assign(window as any, { onYouTubeIframeAPIReady: () => start() });
  }

  function seekVideo(time: number) {
    if (vidPlayer && player.current?.seekTo) {
      player.current.seekTo((player.current.getCurrentTime?.() || 0) + time / 1000, true);
    } else if (timerTime + time < 0) {
      setTimerTime(0);
    } else {
      setTimerTime((value) => value + time);
    }
  }

  function ctrlSpace() {
    if (vidPlayer && player.current?.getPlayerState) {
      if (player.current.getPlayerState() !== 1) timerTimeStart();
      else timerTimeStop();
    } else if (timerActive) timerTimeStop();
    else timerTimeStart();
  }

  function timerTimeStop() {
    if (vidPlayer && player.current?.pauseVideo) player.current.pauseVideo();
    else setTimerActive(false);
  }
  function timerTimeStart() {
    if (vidPlayer && player.current?.playVideo) player.current.playVideo();
    else if (!timerActive) setTimerActive(true);
  }

  function secToTimeString(secInput: number, msOutput = true, full = false): string {
    let sec = secInput;
    let ms = Math.floor((sec % 1) * 100).toString();
    if (ms.length === 1) ms = `0${ms}`;
    sec = Math.floor(sec);
    const h = Math.floor(sec / 60 / 60);
    sec -= h * 60 * 60;
    const m = Math.floor(sec / 60);
    sec -= m * 60;
    let stamp = h.toString();
    if (stamp.length === 1) stamp = `0${stamp}`;
    stamp = `${stamp}:${`0${m.toString()}`.slice(-2)}:${`0${sec.toString()}`.slice(-2)}.${ms}`;
    if (full) return msOutput ? stamp : stamp.slice(0, stamp.length - 3);
    for (let i = 0; i < 3; i += 1) {
      if (stamp.slice(0, 2) !== "00") break;
      stamp = stamp.slice(3);
    }
    if (stamp[0] === "0") stamp = stamp.slice(1);
    return msOutput ? stamp : stamp.slice(0, stamp.length - 3);
  }

  function renderTimelineCanvas(canvas: HTMLCanvasElement | null, idx: number) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = secToPx * secPerBar;
    canvas.height = barHeight;
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    ctx.font = "14px Ubuntu";
    ctx.lineWidth = 0.35;
    const step = secToPx <= 60 ? 10 : secToPx <= 100 ? 2 : 1;
    for (let x = 0; x / 10 < secPerBar; x += step) {
      if (secToPx <= 60 || x % 10 === 0) {
        ctx.beginPath();
        ctx.moveTo((x * secToPx) / 10, 0);
        ctx.lineTo((x * secToPx) / 10, barHeight);
        ctx.stroke();
        ctx.fillText(secToTimeString(x / 10 + idx * secPerBar + barCount * secPerBar, false, false), (x * secToPx) / 10 + 5, barHeight);
      } else {
        ctx.beginPath();
        ctx.moveTo((x * secToPx) / 10, 0);
        ctx.lineTo((x * secToPx) / 10, (barHeight * 2.0) / 5.0);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function cardFiller(index: number) {
    const current = timelineEntries[index]?.entry;
    if (!current) return 0;
    if (index === 0) {
      if (current.Time / 1000 < secPerBar * barCount) return 0;
      return (current.Time / 1000 - secPerBar * barCount) * secToPx;
    }
    const previous = timelineEntries[index - 1].entry;
    return ((current.Time - previous.Time - previous.Duration) / 1000) * secToPx;
  }

  function cardWidth(index: number) {
    const current = timelineEntries[index]?.entry;
    if (!current) return 0;
    if (index === 0 && current.Time / 1000 < secPerBar * barCount) return ((current.Duration + current.Time) / 1000 - secPerBar * barCount) * secToPx;
    if (index === timelineEntries.length - 1 && (current.Duration + current.Time) / 1000 > secPerBar * (barCount + 3)) return (secPerBar * (barCount + 3) - current.Time / 1000) * secToPx;
    return (current.Duration / 1000) * secToPx;
  }

  function stopTimelineDrag() {
    if (timelineActive.current) {
      const entry = entriesRef.current[selectedEntryRef.current];
      if (entry) logChange(entry.id);
    }
    timelineActive.current = false;
  }

  function rulerMouseDown(event: React.MouseEvent, idx: number, nextResizeMode: number) {
    if (timelineActive.current) return;
    event.preventDefault();
    setSelectedEntry(idx);
    selectedEntryRef.current = idx;
    timelineActive.current = true;
    xPos.current = event.clientX;
    resizeMode.current = nextResizeMode;
  }

  function rulerMouseMove(event: React.MouseEvent) {
    if (!timelineActive.current) return;
    const selectedIdx = selectedEntryRef.current;
    const currentEntries = cloneProfile(entriesRef.current);
    if (!currentEntries[selectedIdx]) { timelineActive.current = false; return; }
    const xChange = ((event.clientX - xPos.current) / secToPx) * 1000;
    switch (resizeMode.current) {
      case 0: {
        if (currentEntries[selectedIdx].Duration - xChange < 300) { timelineActive.current = false; return; }
        if (currentEntries[selectedIdx].Time + xChange < secPerBar * barCount * 1000) { timelineActive.current = false; return; }
        if (selectedIdx > 0 && currentEntries[selectedIdx].Time + xChange < currentEntries[selectedIdx - 1].Time + currentEntries[selectedIdx - 1].Duration) {
          if (currentEntries[selectedIdx - 1].Duration + xChange > 300) currentEntries[selectedIdx - 1].Duration += xChange;
          else { timelineActive.current = false; return; }
        }
        currentEntries[selectedIdx].Duration -= xChange;
        currentEntries[selectedIdx].Time += xChange;
        break;
      }
      case 1: {
        if (currentEntries[selectedIdx].Duration - xChange < 300) { timelineActive.current = false; return; }
        if (selectedIdx > 0 && currentEntries[selectedIdx].Time + xChange < currentEntries[selectedIdx - 1].Time + currentEntries[selectedIdx - 1].Duration) {
          if (currentEntries[selectedIdx - 1].Duration + xChange > 300) currentEntries[selectedIdx - 1].Duration += xChange;
          else { timelineActive.current = false; return; }
        }
        if (selectedIdx < currentEntries.length - 1 && currentEntries[selectedIdx].Time + currentEntries[selectedIdx].Duration + xChange > currentEntries[selectedIdx + 1].Time) {
          if (currentEntries[selectedIdx + 1].Duration - xChange > 300) {
            currentEntries[selectedIdx + 1].Duration -= xChange;
            currentEntries[selectedIdx + 1].Time = currentEntries[selectedIdx].Time + currentEntries[selectedIdx].Duration + xChange;
          } else { timelineActive.current = false; return; }
        }
        if (currentEntries[selectedIdx].Time + xChange > 0) currentEntries[selectedIdx].Time += xChange;
        else currentEntries[selectedIdx].Time = 0;
        break;
      }
      case 2: {
        if (currentEntries[selectedIdx].Duration + xChange < 300) { timelineActive.current = false; return; }
        if (selectedIdx < currentEntries.length - 1 && currentEntries[selectedIdx].Time + currentEntries[selectedIdx].Duration + xChange > currentEntries[selectedIdx + 1].Time) {
          if (currentEntries[selectedIdx + 1].Duration - xChange > 300) {
            currentEntries[selectedIdx + 1].Duration -= xChange;
            currentEntries[selectedIdx + 1].Time = currentEntries[selectedIdx].Time + currentEntries[selectedIdx].Duration + xChange;
          } else { timelineActive.current = false; return; }
        }
        currentEntries[selectedIdx].Duration += xChange;
        break;
      }
      default:
        break;
    }
    xPos.current = event.clientX;
    entriesRef.current = currentEntries;
    setEntries(currentEntries);
  }

  function handleControlKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp" && !event.ctrlKey) { event.preventDefault(); profileUp(); }
    else if (event.key === "ArrowDown" && !event.ctrlKey) { event.preventDefault(); profileDown(false); }
    else if (event.key === "Tab" && event.shiftKey) { event.preventDefault(); profileJumpToDefault(); }
    else if (event.key === "Tab") { event.preventDefault(); profileDown(true); }
    else if (event.ctrlKey && event.key === " ") { event.preventDefault(); ctrlSpace(); }
    else if (event.ctrlKey && event.key === "ArrowLeft") { event.preventDefault(); seekVideo(-3000); }
    else if (event.ctrlKey && event.key === "ArrowRight") { event.preventDefault(); seekVideo(3000); }
    else if (event.ctrlKey && /^[0-9]$/.test(event.key)) { event.preventDefault(); profileJump(Number(event.key)); }
  }

  useEffect(() => {
    document.title = "TLScriptEditor - Holodex";
    appStore.loginVerify({ bounceToLogin: true });
    renderTimelineCanvas(timeCanvas1.current, 0);
    renderTimelineCanvas(timeCanvas2.current, 1);
    renderTimelineCanvas(timeCanvas3.current, 2);
    const video = searchParams.get("video") || "";
    if (video) {
      setActiveURLStream(videoCodeParser(video));
    }
    setModalNexus(true);
    setModalMode(5);
    setEditorMode(false);
  }, [searchParams]);

  useEffect(() => {
    if (!timerActive) return;
    manualTimerTick.current = Date.now();
    const id = setInterval(() => {
      if (vidPlayer && player.current?.getCurrentTime) {
        setTimerTime(player.current.getCurrentTime() * 1000);
        return;
      }
      const now = Date.now();
      const delta = now - manualTimerTick.current;
      manualTimerTick.current = now;
      if (delta < 1000) setTimerTime((time) => time + delta);
    }, vidPlayer ? 100 : 1000 / 30);
    return () => clearInterval(id);
  }, [timerActive, vidPlayer]);

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { selectedEntryRef.current = selectedEntry; }, [selectedEntry]);
  useEffect(() => { videoDataRef.current = videoData; }, [videoData]);
  useEffect(() => { TLLangRef.current = TLLang; }, [TLLang]);
  useEffect(() => { activeURLStreamRef.current = activeURLStream; }, [activeURLStream]);
  useEffect(() => { userdataRef.current = appStore.userdata; }, [appStore.userdata]);

  useEffect(() => {
    if (timelineEntries.length === 0) { setDisplayEntry(-1); return; }
    if (timerTime < timelineEntries[0].entry.Time) { setDisplayEntry(-1); return; }
    const current = entries[displayEntry];
    if (current && timerTime > current.Time && current.Time + current.Duration > timerTime) return;
    for (let i = timelineEntries.length - 1; i >= 0; i -= 1) {
      if (timerTime > timelineEntries[i].entry.Time) {
        setDisplayEntry(timelineEntries[i].idx);
        return;
      }
    }
  }, [timerTime, entries, timelineEntries, displayEntry]);

  useEffect(() => {
    renderTimelineCanvas(timeCanvas1.current, 0);
    renderTimelineCanvas(timeCanvas2.current, 1);
    renderTimelineCanvas(timeCanvas3.current, 2);
  }, [barCount]);

  useEffect(() => {
    setBarCount((currentBarCount) => {
      const deltaBar = timerTime / 1000 / secPerBar - currentBarCount;
      if (deltaBar > 3 || deltaBar < 0) {
        const nextBarCount = Math.floor(timerTime / 1000 / secPerBar);
        return nextBarCount > 0 ? nextBarCount - 1 : 0;
      }
      if (deltaBar > 2) return currentBarCount + 1;
      if (deltaBar < 1 && currentBarCount > 0) return currentBarCount - 1;
      return currentBarCount;
    });
  }, [timerTime]);

  useEffect(() => {
    if (timelineDiv.current) timelineDiv.current.scrollLeft = (timerTime / 1000 - barCount * secPerBar) * secToPx;
  }, [timerTime, barCount]);

  useEffect(() => {
    const logger = setInterval(() => processLog(false), 15 * 1000);
    return () => {
      clearInterval(logger);
      if (profileDisplayTimer.current) clearTimeout(profileDisplayTimer.current);
      unloadVideo();
      processLog(true);
    };
  }, []);


  return (
    <div className="flex h-screen max-h-screen px-3" onKeyDown={(event) => { if (event.ctrlKey && event.key.toLowerCase() === "s") { event.preventDefault(); processLog(); } }}>
      <div className="flex h-full w-full flex-col">
        <div className="tl-topbar mb-2 flex min-h-[42px] flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[color:var(--color-secondary)]/20 px-2 py-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/")}><Icon icon={icons.mdiHome} size="sm" /></Button>
          <Button variant="outline" size="sm" onClick={() => { setModalMode(5); setModalNexus(true); }}>{t("views.tlClient.menu.setting")}</Button>
          <Button variant="outline" size="sm" onClick={processLog}>{t("views.scriptEditor.menu.save")} <code>Ctrl-S</code></Button>
          <Button variant="outline" size="sm" onClick={() => { setModalMode(6); setModalNexus(true); }}>{t("views.scriptEditor.menu.exportFile")}</Button>
          <Button variant="outline" size="sm" onClick={() => setImportPanelShow(true)}>{t("views.scriptEditor.menu.importFile")}</Button>
          <Button variant="outline" size="sm" onClick={continuousTime}>{t("views.scriptEditor.menu.continuousEnd")}</Button>
          <Button variant="outline" size="sm" onClick={() => { setModalMode(9); setModalNexus(true); }}>Time Shift</Button>
          {videoData && videoData.id === "custom" ? <Button variant="outline" size="sm" onClick={() => { setModalMode(10); setModalNexus(true); setLinkInput(activeURLStream); }}>Change Custom Link</Button> : null}
          <Button variant="destructive" size="sm" onClick={() => { setModalMode(7); setModalNexus(true); }}>{t("views.scriptEditor.menu.clearAll")}</Button>
        </div>

        <div className="flex h-full flex-row items-stretch gap-3" style={{ height: "100%" }} onClick={() => setMenuBool(false)}>
          <Card className="grow overflow-hidden p-0">
            <table className="w-full border-collapse text-sm" width="auto">
              <thead onClick={() => setSelectedEntry(-1)}>
                <tr><th className="text-left">{t("views.scriptEditor.table.headerStart")}</th><th className="text-left">{t("views.scriptEditor.table.headerEnd")}</th><th className="text-left">{t("views.scriptEditor.table.headerProfile")}</th><th className="text-left" style={{ width: "100%" }}>{t("views.scriptEditor.table.headerText")}</th><th>{!vidPlayer ? <div className="ControlBox flex flex-row items-center gap-2"><Button variant="outline" size="sm" onClick={timerTimeStop}><Icon icon={mdiStop} size="sm" /></Button><span>{timerPrint}</span><Button variant="outline" size="sm" onClick={timerTimeStart}><Icon icon={mdiPlay} size="sm" /></Button></div> : null}</th></tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => selectedEntry !== index ? (
                  <Entrytr key={`entry-${index}`} time={entry.Time} duration={entry.Duration} stext={entry.SText} profileName={profile[entry.Profile]?.Name || profile[0].Name} cc={profile[entry.Profile]?.useCC ? profile[entry.Profile].CC : ""} oc={profile[entry.Profile]?.useOC ? profile[entry.Profile].OC : ""} useRealTime={videoData?.id === "custom"} realTime={entry.realTime} onClick={() => setSelectedEntry(index)} />
                ) : (
                  <Fragment key={`editing-${index}`}>
                    <tr><td>{timeStampStart}</td><td>{timeStampEnd}</td><td><select value={entry.Profile} className="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20" onChange={(event) => { const nextProfile = Number(event.target.value); setProfileIdx(nextProfile); updateEntry(index, { Profile: nextProfile }); showProfileList(); }}>{profileListPicker.map((item) => <option key={item.idx} value={item.idx} className="bg-slate-900">{item.name}</option>)}</select></td><td colSpan={2}><Input value={entry.SText} className="font-semibold" style={textStyle2} onChange={(event) => updateEntry(index, { SText: event.target.value })} /></td></tr>
                    <tr><td colSpan={5}><div className="flex flex-row justify-around gap-2 py-3"><Button variant="outline" size="sm" onClick={() => { setModalMode(4); setModalNexus(true); }}>{t("views.scriptEditor.table.setAsStart")}</Button><Button variant="destructive" size="sm" onClick={deleteEntry}>{t("views.scriptEditor.table.deleteEntry")}</Button></div></td></tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
            {profileDisplay ? <Card className="ProfileListCard flex flex-col">{profile.map((prf, index) => <span key={`profilecard${index}`} className={index === profileIdx ? "font-medium text-[color:var(--color-primary)]" : ""}>{index === profileIdx ? "> " : ""}{index > 0 ? <kbd>Ctrl-{index}</kbd> : null}{index === 0 ? <kbd>Ctrl-{index} | Shift⇧-Tab↹</kbd> : null}{" " + prf.Name}</span>)}</Card> : null}
          </Card>
          {vidPlayer ? <Card className="flex h-full w-1/2 flex-col p-0"><div id="player" className="h-full w-full" /><div className="flex flex-row justify-center">{displayEntry >= 0 && displayEntry < entries.length ? <EnhancedEntry stext={entries[displayEntry].SText} cc={profile[entries[displayEntry].Profile]?.useCC ? profile[entries[displayEntry].Profile].CC : ""} oc={profile[entries[displayEntry].Profile]?.useOC ? profile[entries[displayEntry].Profile].OC : ""} /> : null}</div><div className="flex flex-row justify-center gap-2 px-4 py-3"><Button variant="outline" size="sm" onClick={timerTimeStop}><Icon icon={mdiStop} size="sm" /></Button><span>{timerPrint}</span><Button variant="outline" size="sm" onClick={timerTimeStart}><Icon icon={mdiPlay} size="sm" /></Button></div></Card> : null}
        </div>

        <div onClick={() => setMenuBool(false)} onKeyDown={handleControlKeyDown}>
          <div className="flex items-baseline">
            <Card className="mb-1 flex flex-col pb-[7px]">
              <Card className="relative">
                <div className="Marker" />
                <div ref={timelineDiv} className="TimelineContainer" style={{ scrollBehavior: "unset" }}>
                  <Card className="TimelineInnerContainer" style={{ width: 3 * secToPx * secPerBar }}>
                    <canvas ref={timeCanvas1} style={{ height: barHeight, width: secToPx * secPerBar }} />
                    <canvas ref={timeCanvas2} style={{ height: barHeight, width: secToPx * secPerBar }} />
                    <canvas ref={timeCanvas3} style={{ marginRight: "auto", height: barHeight, width: secToPx * secPerBar }} />
                  </Card>
                  <div className="flex flex-row" style={{ marginLeft: "40%", width: 3 * secToPx * secPerBar }} onMouseLeave={stopTimelineDrag} onMouseUp={stopTimelineDrag} onMouseMove={rulerMouseMove}>
                    {timelineEntries.map(({ entry, idx }, index) => {
                      const filler = cardFiller(index);
                      const width = cardWidth(index);
                      return <Fragment key={`timecard-${entry.id || idx}`}><div style={{ width: filler }} /><Card className="Timecard flex flex-row items-center rounded-lg border border-white/10 p-0 shadow-md" style={{ fontSize: 15, width }}><div style={{ width: 3, backgroundColor: "transparent", height: "100%", cursor: "ew-resize" }} onMouseDown={(event) => rulerMouseDown(event, idx, 0)} /><EnhancedEntry stext={entry.SText} cc={profile[entry.Profile]?.useCC ? profile[entry.Profile].CC : ""} oc={profile[entry.Profile]?.useOC ? profile[entry.Profile].OC : ""} className="TimecardText" onMouseDown={(event) => rulerMouseDown(event, idx, 1)} /><div style={{ width: 3, backgroundColor: "transparent", height: "100%", cursor: "ew-resize" }} onMouseDown={(event) => rulerMouseDown(event, idx, 2)} /></Card></Fragment>;
                    })}
                  </div>
                </div>
              </Card>
            </Card>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="mt-1 opacity-80">{profile[profileIdx]?.Prefix}</span>
              <Input value={inputString} className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" placeholder="Type TL Here <Enter key to send>" onChange={(event) => setInputString(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addEntry(); }} />
              <span className="mt-1 opacity-80">{profile[profileIdx]?.Suffix}</span>
            </div>
            <Button size="lg" className="lg:mx-2" onClick={addEntry}>{t("views.tlClient.tlControl.enterBtn")}</Button>
            <Button variant="secondary" size="lg" onClick={() => setTLSetting((value) => !value)}>{TLSetting ? t("views.tlClient.tlControl.hideSetting") : t("views.tlClient.tlControl.showSetting")}<Icon icon={TLSetting ? mdiCogOff : mdiCog} size="sm" /></Button>
          </div>
          {TLSetting ? <Card className="mt-2 space-y-5 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-semibold text-white">Current Profile [{profile[profileIdx]?.Name}] Settings</div><div className="mt-2 text-xs leading-6 text-slate-400"><span className="mr-2">While typing in TL box:</span><kbd>Up⇧</kbd> / <kbd>Down⇩</kbd>, <kbd>Ctrl+[0~9]</kbd>, <kbd>Tab↹</kbd>, <kbd>Shift⇧-Tab↹</kbd></div></div><div className="flex items-center gap-2"><Icon icon={mdiKeyboard} size="sm" className="text-slate-400" /><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTLSetting(false)}><Icon icon={icons.mdiClose} size="sm" /></Button></div></div><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><Input value={profile[profileIdx]?.Prefix || ""} className="flex-1" placeholder={t("views.tlClient.tlControl.prefix")} onChange={(event) => updateProfile(profileIdx, { Prefix: event.target.value })} /><Input value={profile[profileIdx]?.Suffix || ""} className="flex-1" placeholder={t("views.tlClient.tlControl.suffix")} onChange={(event) => updateProfile(profileIdx, { Suffix: event.target.value })} /></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { setModalMode(1); setModalNexus(true); setAddProfileNameString(`Profile ${profile.length}`); }}>{t("views.tlClient.tlControl.addProfile")}</Button><Button variant="outline" size="sm" onClick={() => { setModalMode(2); setModalNexus(true); }}>{t("views.tlClient.tlControl.removeProfile")}</Button><Button variant="outline" size="sm" onClick={shiftProfileUp}>{t("views.tlClient.tlControl.shiftUp")}</Button><Button variant="outline" size="sm" onClick={shiftProfileDown}>{t("views.tlClient.tlControl.shiftDown")}</Button></div></Card> : null}
        </div>
      </div>

      <Dialog open={colourDialogue} className="max-w-sm p-0" onOpenChange={(open) => { if (!open) colourPickerClose(); else setColourDialogue(open); }}><Card className="space-y-5 p-5"><label className="flex flex-col gap-2 text-sm"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{colourPick === 1 ? t("views.tlClient.tlControl.fontColour") : t("views.tlClient.tlControl.outlineColour")}</span>{colourPick === 1 || colourPick === 2 ? <input value={colourPick === 1 ? profile[profileIdx]?.CC : profile[profileIdx]?.OC} type="color" className="h-12 w-full rounded-xl border border-white/10 bg-white/5 p-1" onChange={(event) => updateProfile(profileIdx, colourPick === 1 ? { CC: event.target.value, useCC: true } : { OC: event.target.value, useOC: true })} /> : null}</label><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold" style={textStyle}>{t("views.tlClient.pangram")}</div><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={colourPickerClose}>{t("views.tlClient.cancelBtn")}</Button><Button size="sm" onClick={colourPickerOK}>{t("views.tlClient.okBtn")}</Button></div></Card></Dialog>
      <ImportFile show={importPanelShow} onOpenChange={setImportPanelShow} onBounceDataBack={processImportData} />
      <Dialog open={modalNexus} className={modalMode === 7 ? "max-w-sm p-0" : "max-w-2xl p-0"} onOpenChange={(open) => { if (open) setModalNexus(true); else if (modalMode !== 5) setModalNexus(false); }}>
        {modalMode === 1 ? <Card className="space-y-5 p-5"><div className="text-lg font-semibold text-white">{t("views.tlClient.addProfilePanel.title")}</div><Input value={addProfileNameString} placeholder={t("views.tlClient.addProfilePanel.inputLabel")} onChange={(event) => setAddProfileNameString(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button size="sm" onClick={addProfile}>{t("views.tlClient.okBtn")}</Button></div></Card> : modalMode === 2 ? <Card className="space-y-5 p-5"><div className="text-lg font-semibold text-white">{`${t("views.tlClient.removeProfileTitle")} ${profile[profileIdx]?.Name}.`}</div><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button size="sm" onClick={deleteProfile}>{t("views.tlClient.okBtn")}</Button></div></Card> : modalMode === 3 ? <Card className="space-y-5 p-5"><div className="text-lg font-semibold text-white">{t("views.scriptEditor.loadVideoPanel.title")}</div><Input value={activeURLInput} placeholder={t("views.scriptEditor.loadVideoPanel.inputLabel")} onChange={(event) => setActiveURLInput(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button size="sm" onClick={() => { setActiveURLStream(activeURLInput); loadVideo(activeURLInput); setModalNexus(false); }}>{t("views.tlClient.okBtn")}</Button></div></Card> : modalMode === 4 ? <Card className="space-y-5 p-5"><div className="text-lg font-semibold text-white" style={{ wordBreak: "normal" }}>{t("views.scriptEditor.setStartTitle")}</div><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button size="sm" onClick={() => { setStartEntry(); setModalNexus(false); }}>{t("views.tlClient.okBtn")}</Button></div></Card> : modalMode === 5 ? <Card className="space-y-5 p-5"><div className="text-lg font-semibold text-white">{t("views.tlClient.settingPanel.title")}</div><div className="text-sm text-slate-400">{`${t("views.watch.uploadPanel.usernameText")} : ${appStore.userdata.user?.username || ""} `}<a className="text-xs underline" onClick={changeUsernameClick}>{t("views.watch.uploadPanel.usernameChange")}</a></div><label className="flex flex-col gap-2 text-sm"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("views.watch.uploadPanel.tlLang")}</span><select value={TLLang.value} className="h-11 rounded-2xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20" onChange={(event) => setTLLang(TL_LANGS.find((item) => item.value === event.target.value) || TL_LANGS[0])}>{TL_LANGS.map((item) => <option key={item.value} value={item.value} className="bg-slate-900">{item.text} ({item.value})</option>)}</select></label><Input value={activeURLStream} placeholder={t("views.tlClient.settingPanel.mainStreamLink")} onChange={(event) => setActiveURLStream(event.target.value)} /><div className="flex justify-center"><Button size="sm" onClick={settingOKClick}>{t("views.tlClient.okBtn")}</Button></div></Card> : modalMode === 6 ? <Card className="p-0"><ScriptEditorExportToFile entries={entries} profile={profile} title={`${appStore.userdata.user?.username || ""} - ${videoData?.title || activeURLStream || "Holodex"}`} /></Card> : modalMode === 7 ? <Card className="space-y-5 p-5"><div className="text-lg font-semibold text-white">{t("views.scriptEditor.menu.clearAll")}</div><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button variant="destructive" size="sm" onClick={clearAll}>{t("views.tlClient.okBtn")}</Button></div></Card> : modalMode === 9 ? <Card className="space-y-5 p-5"><div className="text-lg font-semibold text-white">Time Shift</div><label className="flex flex-col gap-2 text-sm"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Offset</span><div className="flex items-center gap-2"><Input value={offsetInput} className="flex-1" type="number" onChange={(event) => setOffsetInput(event.target.value)} /><span className="text-slate-400">sec</span></div></label><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button size="sm" onClick={() => { setModalNexus(false); shiftTime(); }}>{t("views.tlClient.okBtn")}</Button></div></Card> : modalMode === 10 ? <Card className="space-y-5 p-5"><div className="text-lg font-semibold text-white">Change stream link</div><Input value={linkInput} placeholder="New link" onChange={(event) => setLinkInput(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setModalNexus(false)}>{t("views.tlClient.cancelBtn")}</Button><Button size="sm" onClick={() => setModalNexus(false)}>{t("views.tlClient.okBtn")}</Button></div></Card> : null}
      </Dialog>
    </div>
  );
}
