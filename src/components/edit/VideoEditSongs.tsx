"use client";

import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { SongItem } from "@/components/media/SongItem";
import { SongSearch } from "@/components/media/SongSearch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import * as icons from "@/lib/icons";
import { Gauge, Plus, RotateCcw } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { formatDuration, secondsToHuman } from "@/lib/time";

function RelativeTimestampEditor({
  value,
  test,
  onInput,
  onSeekTo,
}: {
  value: number;
  test: number;
  onInput?: (value: number) => void;
  onSeekTo?: (value: number) => void;
}) {
  const t = useTranslations();
  const [newVal, setNewVal] = useState(value);
  const tl = useRef<HTMLDivElement | null>(null);
  const min = Math.max(0, value - 6);
  const max = Math.max(0, value + 6);
  function tryPlay(e: React.MouseEvent) {
    const rect = tl.current!.getBoundingClientRect();
    onSeekTo?.(((e.clientX - rect.left) / rect.width) * (max - min) + min);
  }
  return (
    <div className="group mb-4 -mx-2.5">
      {/* Mouse shortcut for seeking; the start/duration fields cover keyboard editing. */}
      <div
        ref={tl}
        role="presentation"
        className="relative cursor-pointer pt-6.25"
        onClick={tryPlay}
      >
        <Progress
          className="mx-2 mb-1.5 mt-5 h-2"
          value={((Number(test) - min) * 100.0) / (max - min)}
        />
        <div className="pointer-events-none absolute left-1/2 top-1 block h-5 -translate-x-1/2 border-l-2 border-border pl-1 text-[9px] opacity-0 group-hover:opacity-100">
          {t("editor.music.playFromHere")}
        </div>
      </div>
      <div className="relative mb-2">
        <Slider
          className="mt-3"
          value={[newVal]}
          min={min}
          max={max}
          step={1}
          onValueChange={(next) => {
            const v = Array.isArray(next) ? (next[0] ?? value) : next;
            setNewVal(v);
            onInput?.(v);
          }}
        />
        <div className="mt-1 text-center text-xs text-muted-foreground">
          {newVal === value
            ? formatDuration(value * 1000)
            : `${(newVal - value) > 0 ? "+" : ""}${newVal - value}s`}
        </div>
      </div>
      <span className="float-right text-xs font-light opacity-0 group-hover:opacity-70">
        {t("editor.music.timestampEditorHint")}
      </span>
    </div>
  );
}

function humanToSeconds(str: string) {
  const p = str.split(":");
  let s = 0;
  let m = 1;
  while (p.length > 0) {
    s += m * parseInt(p.pop()!, 10);
    m *= 60;
  }
  return s;
}
function maskTimestamp(s: string) {
  const p = s.split(":").join("").split("");
  const out: string[] = [];
  while (p.length > 0 && p[0] === "0") p.shift();
  while (p.length > 0) {
    if (p.length === 1) {
      out.unshift(`${p}`);
      break;
    }
    const swap = p.pop();
    out.unshift(p.pop()! + swap);
  }
  return out.join(":");
}
const sortSongs = (songs: any[]) => [...(songs || [])].sort((a, b) => a.start - b.start);
const startTimeRegex = /^\d+([:]\d+)?([:]\d+)?$/;
const endTimeRegex = /^\+\d+$|^\d+(:\d+)?(:\d+)?$/;
function getEmptySong(video: any) {
  return {
    song: null,
    itunesid: null,
    start: 0,
    end: 12,
    name: "",
    original_artist: "",
    amUrl: null,
    art: null,
    video_id: video.id,
    channel_id: video.channel.id,
    creator_id: null,
    channel: { name: video.channel.name, english_name: video.channel.english_name },
    available_at: video.available_at,
  };
}

// The video's song entries, sorted by start time.
function useVideoSongList(channelId: string, videoId: string) {
  const [songList, setSongList] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .songListByVideo(channelId, videoId, false)
      .then(({ data }: any) => {
        if (!cancelled) setSongList(sortSongs(data));
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [channelId, videoId]);
  async function refreshSongList() {
    setSongList(sortSongs((await api.songListByVideo(channelId, videoId, false)).data));
  }
  return { songList, refreshSongList };
}

function mountTwitter() {
  const s = document.createElement("script");
  s.src = "https://platform.twitter.com/widgets.js";
  s.async = true;
  document.head.appendChild(s);
}

// "Add song" heading with a help button that opens the announcement tweet.
function AddSongHeader() {
  const t = useTranslations();
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">{t("editor.music.titles.addSong")}</span>
        <Separator className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setHelpOpen(true);
            mountTwitter();
          }}
        >
          <icons.CircleHelp className="h-4 w-4" />
          <span>{t("editor.music.titles.help")}</span>
        </Button>
      </div>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogTitle className="sr-only">{t("editor.music.titles.help")}</DialogTitle>
          <blockquote className="twitter-tweet">
            <p lang="en" dir="ltr">
              Easily create Music entries on Holodex, coming soon! 🎵🎶{" "}
              <a href="https://t.co/1KJXYDcJjo">pic.twitter.com/1KJXYDcJjo</a>
            </p>
            &mdash; Holodex (@holodex){" "}
            <a href="https://twitter.com/holodex/status/1371290072058785797?ref_src=twsrc%5Etfw">
              March 15, 2021
            </a>
          </blockquote>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CurrentTimeButton({
  currentTime,
  disabled,
  onClick,
}: {
  currentTime: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const t = useTranslations();
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      title={t("editor.music.setToCurrentTime", { arg0: secondsToHuman(currentTime) })}
      onClick={onClick}
    >
      <Gauge className="h-4 w-4 rotate-90" />
      {formatDuration(currentTime * 1000)}
    </Button>
  );
}

type SongFieldProps = {
  current: any;
  currentTime: number;
  onTimeJump?: VideoEditSongsProps["onTimeJump"];
};

function StartTimeField({
  current,
  currentTime,
  onTimeJump,
  startInput,
  onStartInput,
  onStart,
}: SongFieldProps & {
  startInput: string;
  onStartInput: (value: string) => void;
  onStart: (start: number) => void;
}) {
  return (
    <div className="md:col-span-6">
      <div className="flex items-start gap-2">
        <CurrentTimeButton
          currentTime={currentTime}
          onClick={() => onStartInput(secondsToHuman(currentTime))}
        />
        <Input
          value={startInput}
          placeholder="12:31"
          aria-invalid={!startTimeRegex.test(startInput)}
          onChange={(e) => onStartInput(e.target.value)}
        />
      </div>
      <RelativeTimestampEditor
        value={Number(current.start)}
        test={currentTime}
        onInput={(x) => {
          onStart(x);
          onTimeJump?.(x, true);
        }}
        onSeekTo={(x) => onTimeJump?.(x, true)}
      />
    </div>
  );
}

// End as a duration from the start (or an absolute time), with shortcuts for the player's time
// and the iTunes track length.
function EndTimeField({
  current,
  currentTime,
  onTimeJump,
  onEndInput,
  onEnd,
}: SongFieldProps & { onEndInput: (value: string) => void; onEnd: (end: number) => void }) {
  const t = useTranslations();
  const currentEndTime = `${current.end - current.start}`;
  const trackSeconds = current.song?.trackTimeMillis ? current.song.trackTimeMillis / 1000 : 0;
  return (
    <div className="md:col-span-6">
      <div className="flex items-start gap-2">
        <CurrentTimeButton
          currentTime={currentTime}
          disabled={currentTime < current.start + 10}
          onClick={() => {
            onEndInput(`${currentTime - current.start}`);
            onTimeJump?.(currentTime - 3, true, false, currentTime);
          }}
        />
        {trackSeconds ? (
          <Button
            type="button"
            variant="secondary"
            title={t("editor.music.inheritItunesMusic", { arg0: `+${Math.ceil(trackSeconds)}` })}
            onClick={() => {
              onEndInput(`+${Math.ceil(trackSeconds)}`);
              onTimeJump?.(
                current.start + trackSeconds - 3,
                true,
                false,
                current.start + trackSeconds,
              );
            }}
          >
            <Plus className="h-4 w-4" />
            {formatDuration(current.start * 1000 + current.song.trackTimeMillis)}
          </Button>
        ) : null}
        <Input
          value={currentEndTime}
          placeholder="312"
          aria-invalid={!endTimeRegex.test(currentEndTime)}
          onChange={(e) => onEndInput(e.target.value)}
        />
      </div>
      <RelativeTimestampEditor
        value={Number(current.end)}
        test={currentTime}
        onInput={(x) => {
          onEnd(x);
          onTimeJump?.(x - 3, true, false, x);
        }}
        onSeekTo={(x) => onTimeJump?.(x, true)}
      />
    </div>
  );
}

// Add/update, reset and the Apple Music link, plus the permission notice for entries the user
// may not change.
function SongActions({
  current,
  label,
  canSave,
  privilegeSufficient,
  onSave,
  onReset,
}: {
  current: any;
  label: string;
  canSave: boolean;
  privilegeSufficient: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  const t = useTranslations();
  return (
    <>
      <div className="md:col-span-8">
        <Button
          type="button"
          className="w-full"
          disabled={!canSave || !privilegeSufficient}
          onClick={onSave}
        >
          {label}
        </Button>
      </div>
      <div className="md:col-span-1">
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          aria-label={t("views.library.selectionReset")}
          onClick={onReset}
        >
          <RotateCcw className="size-5" />
        </Button>
      </div>
      <div className="md:col-span-3">
        <Button
          nativeButton={false}
          render={(props) => (
            <a {...props} href={current.amUrl || "#"} rel="noopener noreferrer" target="_blank" />
          )}
          variant="secondary"
          disabled={!current.amUrl}
          className="justify-start whitespace-normal text-left"
        >
          <img
            src="https://apple-resources.s3.amazonaws.com/medusa/production/images/5f600674c4f022000191d6c4/en-us-large@1x.png"
            className="h-6 w-6 rounded-sm object-cover"
            alt=""
          />
          <span>{t("editor.music.listenOnAppleMusic")}</span>
        </Button>
      </div>
      {!canSave && !privilegeSufficient ? (
        <Alert variant="destructive" className="md:col-span-12">
          <AlertDescription
            dangerouslySetInnerHTML={{ __html: t.raw("editor.music.permission") }}
          />
        </Alert>
      ) : null}
    </>
  );
}

function SongListSection({
  title,
  songList,
  onRemove,
  onEdit,
  onPlayNow,
}: {
  title: string;
  songList: any[];
  onRemove: (song: any) => void;
  onEdit: (song: any) => void;
  onPlayNow: (song: any) => void;
}) {
  const t = useTranslations();
  return (
    <>
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">
          {t("editor.music.titles.songList", { arg0: title })}
        </span>
        <Separator className="flex-1" />
      </div>
      <ScrollArea className="max-h-[45vh] min-h-[30vh]">
        <div className="space-y-2">
          {songList.map((song) => (
            <SongItem
              key={song.name}
              song={song}
              detailed
              hoverIcon={icons.Pencil}
              artworkHoverIcon={icons.Play}
              onRemove={onRemove}
              onPlay={onEdit}
              onPlayNow={onPlayNow}
            />
          ))}
        </div>
      </ScrollArea>
    </>
  );
}

// An existing entry can only be changed by its creator, an editor or an admin.
function canEditSong(songList: any[], current: any, user: any) {
  const isUpdate = songList.find((m) => m.name === current.name);
  return (
    !isUpdate ||
    (isUpdate &&
      (user?.role === "admin" ||
        user?.role === "editor" ||
        (user?.id && +current.creator_id === +user.id)))
  );
}

// Song fields from an iTunes search result.
function itunesFields(item: any) {
  return {
    song: item,
    itunesid: item.trackId,
    name: item.trackName,
    original_artist: item.artistName,
    amUrl: item.trackViewUrl,
    art: item.artworkUrl100,
  };
}

export type VideoEditSongsHandle = {
  setStartTime: (time: number) => void;
  setSongCandidate: (timeframe: any, songdata?: any) => void;
};

type VideoEditSongsProps = {
  id?: string;
  video: any;
  currentTime?: number;
  onTimeJump?: (time: number, playNow?: boolean, updateStart?: boolean, stopAt?: number) => void;
};

export const VideoEditSongs = forwardRef<VideoEditSongsHandle, VideoEditSongsProps>(
  function VideoEditSongs({ id, video, currentTime = 0, onTimeJump }, ref) {
    const t = useTranslations();
    const app = useAppState();
    const [current, setCurrent] = useState<any>(() => getEmptySong(video));
    const { songList, refreshSongList } = useVideoSongList(video.channel.id, video.id);
    const [currentStartTimeInput, setCurrentStartTimeInput] = useState("");
    const privilegeSufficient = useMemo(
      () => canEditSong(songList, current, app.userdata?.user),
      [songList, current, app.userdata?.user],
    );
    const canSave = current.end - current.start > 13 && current.name;
    const addOrUpdate = songList.find((m) => m.name === current.name)
      ? t("editor.music.update")
      : t("editor.music.add");
    function setStartInput(val: string) {
      const masked = maskTimestamp(val);
      setCurrentStartTimeInput(masked);
      if (startTimeRegex.test(masked)) {
        const duration = current.end - current.start;
        const start = humanToSeconds(masked);
        setCurrent((c: any) => ({ ...c, start, end: start + duration }));
      }
    }
    function setEndInput(val: string) {
      if (!endTimeRegex.test(val)) return;
      setCurrent((c: any) => ({
        ...c,
        end: val.includes(":") ? humanToSeconds(val) : c.start + +val,
      }));
    }
    function processSearch(item: any) {
      if (item)
        setCurrent((c: any) => ({
          ...c,
          ...itunesFields(item),
          end:
            !c.end || c.end < 10 || c.end < c.start + 10
              ? c.start + Math.ceil(item.trackTimeMillis / 1000)
              : c.end,
        }));
      else setCurrent((c: any) => ({ ...c, song: null, itunesid: -1, amUrl: null, art: null }));
    }
    async function addSong() {
      await api.tryCreateSong(current, app.userdata.jwt);
      setCurrent(getEmptySong(video));
      await refreshSongList();
    }
    function reset() {
      setCurrent(getEmptySong(video));
      refreshSongList();
    }
    async function removeSong(song: any) {
      await api.deleteSong(song, app.userdata.jwt);
      refreshSongList();
    }

    useImperativeHandle(ref, () => ({
      setStartTime: (time: number) => {
        setStartInput(secondsToHuman(time));
      },
      setSongCandidate: (timeframe: any, songdata?: any) => {
        const start = Number(timeframe?.start_time ?? timeframe?.start ?? currentTime ?? 0);
        const end = Number(timeframe?.end_time ?? timeframe?.end ?? start + 12);
        if (songdata) processSearch(songdata);
        setCurrent((c: any) => ({
          ...c,
          ...(songdata ? itunesFields(songdata) : {}),
          start,
          end: end > start ? end : start + 12,
        }));
        setCurrentStartTimeInput(secondsToHuman(start));
      },
    }));

    return (
      <div id={id} className="space-y-5">
        <AddSongHeader />
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-10">
            <SongSearch value={current.song} onInput={processSearch} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Track ID</Label>
            <Input value={current.itunesid || "N/A"} disabled />
          </div>
          <div className="space-y-2 md:col-span-6">
            <Label>{t("editor.music.trackNameInput")}</Label>
            <Input
              value={current.name}
              onChange={(e) => setCurrent((c: any) => ({ ...c, name: e.target.value }))}
              placeholder={t("editor.music.trackNameInput")}
            />
          </div>
          <div className="space-y-2 md:col-span-6">
            <Label>{t("editor.music.originalArtistInput")}</Label>
            <Input
              value={current.original_artist}
              onChange={(e) => setCurrent((c: any) => ({ ...c, original_artist: e.target.value }))}
              placeholder={t("editor.music.originalArtistInput")}
            />
          </div>
          <StartTimeField
            current={current}
            currentTime={currentTime}
            onTimeJump={onTimeJump}
            startInput={currentStartTimeInput}
            onStartInput={setStartInput}
            onStart={(x) => {
              setCurrent((c: any) => ({ ...c, start: x }));
              setCurrentStartTimeInput(secondsToHuman(x));
            }}
          />
          <EndTimeField
            current={current}
            currentTime={currentTime}
            onTimeJump={onTimeJump}
            onEndInput={setEndInput}
            onEnd={(x) => setCurrent((c: any) => ({ ...c, end: x }))}
          />
          <SongActions
            current={current}
            label={addOrUpdate}
            canSave={!!canSave}
            privilegeSufficient={!!privilegeSufficient}
            onSave={addSong}
            onReset={reset}
          />
        </div>
        <SongListSection
          title={video.title}
          songList={songList}
          onRemove={removeSong}
          onEdit={(x: any) => {
            onTimeJump?.(x.start);
            setCurrent(structuredClone(x));
            setCurrentStartTimeInput(secondsToHuman(x.start));
          }}
          onPlayNow={(x: any) => onTimeJump?.(x.start, true)}
        />
      </div>
    );
  },
);
