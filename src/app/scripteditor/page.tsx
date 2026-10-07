"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fragment, Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ImportFile } from "@/components/tl/ScriptEditorImportFile";
import { ScriptEditorExportToFile, TlEntryRow } from "@/components/tl/ScriptEditorParts";
import { TlProfileLegend } from "@/components/tl/TlProfileLegend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
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
import { api } from "@/lib/api";
import { openUserMenu } from "@/lib/browser";
import { TL_LANGS, VIDEO_URL_REGEX } from "@/lib/consts";
import { videoCodeParser } from "@/lib/functions";
import * as icons from "@/lib/icons";
import { Keyboard, Play, Settings, Square } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import {
  formatTlRulerTimestamp,
  formatTlTimestamp,
  newTlProfileId,
  withTlProfileIds,
} from "@/lib/tl-format";

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

function EnhancedEntry({
  stext = "",
  className = "",
  onMouseDown,
}: {
  stext?: string;
  className?: string;
  onMouseDown?: React.MouseEventHandler<HTMLSpanElement>;
}) {
  return (
    // Pointer-only drag handle; entries are edited from the table for keyboard users.
    <span
      role="presentation"
      className={`mx-1 my-0.5 break-words text-center font-normal ${className}`.trim()}
      onMouseDown={onMouseDown}
    >
      {stext}
    </span>
  );
}

const secToPx = 100;
const secPerBar = 60;
const barHeight = 25;

// Draws one minute-long ruler bar; `idx` is the bar's position after the first visible one.
function renderTimelineCanvas(canvas: HTMLCanvasElement | null, idx: number, barCount: number) {
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
      ctx.fillText(
        formatTlRulerTimestamp(x / 10 + idx * secPerBar + barCount * secPerBar),
        (x * secToPx) / 10 + 5,
        barHeight,
      );
    } else {
      ctx.beginPath();
      ctx.moveTo((x * secToPx) / 10, 0);
      ctx.lineTo((x * secToPx) / 10, (barHeight * 2.0) / 5.0);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Index of the first visible ruler bar for the timer position. It only jumps when the timer
// moves far, and otherwise steps one bar at a time so the timeline scrolls smoothly.
function nextBarCount(currentBarCount: number, timerTime: number) {
  const deltaBar = timerTime / 1000 / secPerBar - currentBarCount;
  if (deltaBar > 3 || deltaBar < 0) {
    const jumped = Math.floor(timerTime / 1000 / secPerBar);
    return jumped > 0 ? jumped - 1 : 0;
  }
  if (deltaBar > 2) return currentBarCount + 1;
  if (deltaBar < 1 && currentBarCount > 0) return currentBarCount - 1;
  return currentBarCount;
}

function EditorMenu({
  isCustom,
  onHome,
  onSettings,
  onSave,
  onExport,
  onImport,
  onContinuous,
  onTimeShift,
  onChangeLink,
  onClearAll,
}: {
  isCustom: boolean;
  onHome: () => void;
  onSettings: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onContinuous: () => void;
  onTimeShift: () => void;
  onChangeLink: () => void;
  onClearAll: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="mb-2 flex min-h-[42px] flex-wrap items-center gap-2 rounded-2xl border px-2 py-2 [&>*:not(:first-child):not(:last-child)]:mx-[3px] [&>*]:normal-case">
      <Button variant="outline" size="sm" onClick={onHome}>
        <icons.Home className="size-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={onSettings}>
        {t("views.tlClient.menu.setting")}
      </Button>
      <Button variant="outline" size="sm" onClick={onSave}>
        {t("views.scriptEditor.menu.save")} <Kbd>Ctrl-S</Kbd>
      </Button>
      <Button variant="outline" size="sm" onClick={onExport}>
        {t("views.scriptEditor.menu.exportFile")}
      </Button>
      <Button variant="outline" size="sm" onClick={onImport}>
        {t("views.scriptEditor.menu.importFile")}
      </Button>
      <Button variant="outline" size="sm" onClick={onContinuous}>
        {t("views.scriptEditor.menu.continuousEnd")}
      </Button>
      <Button variant="outline" size="sm" onClick={onTimeShift}>
        {t("views.scriptEditor.menu.timeShift")}
      </Button>
      {isCustom ? (
        <Button variant="outline" size="sm" onClick={onChangeLink}>
          {t("views.scriptEditor.menu.changeCustomLink")}
        </Button>
      ) : null}
      <Button variant="destructive" size="sm" onClick={onClearAll}>
        {t("views.scriptEditor.menu.clearAll")}
      </Button>
    </div>
  );
}

// Stop / elapsed time / play for the manual timer (or the player when one is loaded).
function TimerControls({
  className,
  time,
  onStop,
  onStart,
}: {
  className: string;
  time: string;
  onStop: () => void;
  onStart: () => void;
}) {
  return (
    <div className={className}>
      <Button variant="outline" size="sm" onClick={onStop}>
        <Square className="size-4" />
      </Button>
      <span>{time}</span>
      <Button variant="outline" size="sm" onClick={onStart}>
        <Play className="size-4" />
      </Button>
    </div>
  );
}

// The selected entry, expanded: profile picker, text, and set-as-start / delete actions.
function EditingEntryRows({
  entry,
  timeStampStart,
  timeStampEnd,
  profileOptions,
  onProfile,
  onText,
  onSetStart,
  onDelete,
}: {
  entry: any;
  timeStampStart: string;
  timeStampEnd: string;
  profileOptions: { name: string; idx: number }[];
  onProfile: (profile: number) => void;
  onText: (text: string) => void;
  onSetStart: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations();
  return (
    <>
      <TableRow>
        <TableCell>{timeStampStart}</TableCell>
        <TableCell>{timeStampEnd}</TableCell>
        <TableCell>
          <Select value={String(entry.Profile)} onValueChange={(value) => onProfile(Number(value))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profileOptions.map((item) => (
                <SelectItem key={item.idx} value={String(item.idx)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell colSpan={2}>
          <Input
            value={entry.SText}
            className="font-normal"
            onChange={(event) => onText(event.target.value)}
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5}>
          <div className="flex flex-row justify-around gap-2 py-3">
            <Button variant="outline" size="sm" onClick={onSetStart}>
              {t("views.scriptEditor.table.setAsStart")}
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              {t("views.scriptEditor.table.deleteEntry")}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}

function EntryTable({
  entries,
  selectedEntry,
  onSelect,
  profile,
  profileOptions,
  useRealTime,
  timeStampStart,
  timeStampEnd,
  timerControls,
  onEntryProfile,
  onEntryText,
  onSetStart,
  onDelete,
  legend,
}: {
  entries: any[];
  selectedEntry: number;
  onSelect: (index: number) => void;
  profile: any[];
  profileOptions: { name: string; idx: number }[];
  useRealTime: boolean;
  timeStampStart: string;
  timeStampEnd: string;
  timerControls: React.ReactNode;
  onEntryProfile: (index: number, profile: number) => void;
  onEntryText: (index: number, text: string) => void;
  onSetStart: () => void;
  onDelete: () => void;
  legend: React.ReactNode;
}) {
  const t = useTranslations();
  return (
    <Card className="grow overflow-hidden p-0">
      <Table className="w-full border-collapse" width="auto">
        <TableHeader className="[&_tr]:border-b-0" onClick={() => onSelect(-1)}>
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead>{t("views.scriptEditor.table.headerStart")}</TableHead>
            <TableHead>{t("views.scriptEditor.table.headerEnd")}</TableHead>
            <TableHead>{t("views.scriptEditor.table.headerProfile")}</TableHead>
            <TableHead className="w-full">{t("views.scriptEditor.table.headerText")}</TableHead>
            <TableHead>{timerControls}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, index) =>
            selectedEntry !== index ? (
              <TlEntryRow
                key={`entry-${entry.id}`}
                variant="editor"
                time={entry.Time}
                duration={entry.Duration}
                stext={entry.SText}
                profileName={profile[entry.Profile]?.Name || profile[0].Name}
                cc={profile[entry.Profile]?.useCC ? profile[entry.Profile].CC : ""}
                oc={profile[entry.Profile]?.useOC ? profile[entry.Profile].OC : ""}
                useRealTime={useRealTime}
                realTime={entry.realTime}
                onClick={() => onSelect(index)}
              />
            ) : (
              <Fragment key={`editing-${entry.id}`}>
                <EditingEntryRows
                  entry={entry}
                  timeStampStart={timeStampStart}
                  timeStampEnd={timeStampEnd}
                  profileOptions={profileOptions}
                  onProfile={(next) => onEntryProfile(index, next)}
                  onText={(text) => onEntryText(index, text)}
                  onSetStart={onSetStart}
                  onDelete={onDelete}
                />
              </Fragment>
            ),
          )}
        </TableBody>
      </Table>
      {legend}
    </Card>
  );
}

// The YouTube player (mounted into #player by the IFrame API), the current line under it and
// the timer controls.
function PlayerPanel({ caption, controls }: { caption: string | null; controls: React.ReactNode }) {
  return (
    <Card className="flex h-full w-1/2 flex-col p-0">
      <div
        id="player"
        className="h-full w-full [&>div]:h-full [&>div]:w-full [&>div>iframe]:h-full [&>div>iframe]:w-full [&>iframe]:h-full [&>iframe]:w-full"
      />
      <div className="flex flex-row justify-center">
        {caption !== null ? <EnhancedEntry stext={caption} /> : null}
      </div>
      {controls}
    </Card>
  );
}

// Three minute-long ruler bars with the entries that fall on them; entries are dragged by their
// middle and resized from either edge. The playhead sits at 40% of the width.
function TimelineStrip({
  timelineRef,
  canvasRefs,
  entries,
  onStopDrag,
  onDragMove,
  onDragStart,
}: {
  timelineRef: React.RefObject<HTMLDivElement | null>;
  canvasRefs: React.RefObject<HTMLCanvasElement | null>[];
  entries: Array<{ entry: any; idx: number }>;
  onStopDrag: () => void;
  onDragMove: (event: React.MouseEvent) => void;
  onDragStart: (event: React.MouseEvent, idx: number, mode: number) => void;
}) {
  return (
    <div className="flex items-baseline">
      <Card className="mb-1 flex flex-col pb-1.75">
        <Card className="relative">
          <div className="absolute left-[calc(40%_-_2px)] top-0 z-[1] h-full w-1 bg-primary" />
          <div
            ref={timelineRef}
            className="flex scroll-auto flex-col overflow-x-hidden border-y-2 border-border pt-1.75"
          >
            <Card className="w-[18000px]">
              <canvas
                ref={canvasRefs[0]}
                width={secToPx * secPerBar}
                height={barHeight}
                className="h-[25px] w-[6000px]"
              />
              <canvas
                ref={canvasRefs[1]}
                width={secToPx * secPerBar}
                height={barHeight}
                className="h-[25px] w-[6000px]"
              />
              <canvas
                ref={canvasRefs[2]}
                width={secToPx * secPerBar}
                height={barHeight}
                className="mr-auto h-[25px] w-[6000px]"
              />
            </Card>
            {/* Mouse-only timeline dragging; the handlers catch events from the entries. */}
            <div
              role="presentation"
              className="ml-[40%] flex w-[18000px] flex-row gap-1"
              onMouseLeave={onStopDrag}
              onMouseUp={onStopDrag}
              onMouseMove={onDragMove}
            >
              {entries.map(({ entry, idx }) => (
                <Card
                  key={`timecard-${entry.id || idx}`}
                  className="flex min-w-32 flex-row items-center rounded-lg border border-border p-0 text-[15px] shadow-md"
                >
                  <div
                    role="presentation"
                    className="h-full w-[3px] cursor-ew-resize bg-transparent"
                    onMouseDown={(event) => onDragStart(event, idx, 0)}
                  />
                  <EnhancedEntry
                    stext={entry.SText}
                    className="max-h-[3em] w-full cursor-grab"
                    onMouseDown={(event) => onDragStart(event, idx, 1)}
                  />
                  <div
                    role="presentation"
                    className="h-full w-[3px] cursor-ew-resize bg-transparent"
                    onMouseDown={(event) => onDragStart(event, idx, 2)}
                  />
                </Card>
              ))}
            </div>
          </div>
        </Card>
      </Card>
    </div>
  );
}

function EditorInputBar({
  prefix,
  suffix,
  value,
  onChange,
  onSend,
  settingsShown,
  onToggleSettings,
}: {
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  settingsShown: boolean;
  onToggleSettings: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex flex-1 items-center gap-2 rounded-2xl border px-3 py-2">
        <span className="mt-1 opacity-80">{prefix}</span>
        <Input
          value={value}
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          placeholder={t("views.tlClient.tlControl.inputPlaceholder")}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) onSend();
          }}
        />
        <span className="mt-1 opacity-80">{suffix}</span>
      </div>
      <Button size="lg" className="lg:mx-2" onClick={onSend}>
        {t("views.tlClient.tlControl.enterBtn")}
      </Button>
      <Button variant="secondary" size="lg" onClick={onToggleSettings}>
        {settingsShown
          ? t("views.tlClient.tlControl.hideSetting")
          : t("views.tlClient.tlControl.showSetting")}
        <Settings className="size-4" />
      </Button>
    </div>
  );
}

function EditorProfileSettings({
  profile,
  onClose,
  onPrefix,
  onSuffix,
  onAddProfile,
  onRemoveProfile,
  onShiftUp,
  onShiftDown,
}: {
  profile: any;
  onClose: () => void;
  onPrefix: (value: string) => void;
  onSuffix: (value: string) => void;
  onAddProfile: () => void;
  onRemoveProfile: () => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
}) {
  const t = useTranslations();
  return (
    <Card className="mt-2 space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-normal">
            {t("views.tlClient.tlControl.currentProfileSettings", { name: profile?.Name })}
          </div>
          <div className="mt-2 text-xs leading-6 text-muted-foreground">
            <span className="mr-2">{t("views.tlClient.shortcuts.whileTyping")}</span>
            <Kbd>Up⇧</Kbd> / <Kbd>Down⇩</Kbd>, <Kbd>Ctrl+[0~9]</Kbd>, <Kbd>Tab↹</Kbd>,{" "}
            <Kbd>Shift⇧-Tab↹</Kbd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Keyboard className="size-4" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("component.common.close")}
            onClick={onClose}
          >
            <icons.XIcon className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          value={profile?.Prefix || ""}
          className="flex-1"
          placeholder={t("views.tlClient.tlControl.prefix")}
          onChange={(event) => onPrefix(event.target.value)}
        />
        <Input
          value={profile?.Suffix || ""}
          className="flex-1"
          placeholder={t("views.tlClient.tlControl.suffix")}
          onChange={(event) => onSuffix(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onAddProfile}>
          {t("views.tlClient.tlControl.addProfile")}
        </Button>
        <Button variant="outline" size="sm" onClick={onRemoveProfile}>
          {t("views.tlClient.tlControl.removeProfile")}
        </Button>
        <Button variant="outline" size="sm" onClick={onShiftUp}>
          {t("views.tlClient.tlControl.shiftUp")}
        </Button>
        <Button variant="outline" size="sm" onClick={onShiftDown}>
          {t("views.tlClient.tlControl.shiftDown")}
        </Button>
      </div>
    </Card>
  );
}

// A dialog card: title, optional content, then cancel / OK (OK is red for destructive actions).
function EditorConfirmCard({
  title,
  children,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  children?: React.ReactNode;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations();
  return (
    <Card className="space-y-5 p-5">
      <div className="text-lg font-normal">{title}</div>
      {children}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t("views.tlClient.cancelBtn")}
        </Button>
        <Button variant={destructive ? "destructive" : "default"} size="sm" onClick={onConfirm}>
          {t("views.tlClient.okBtn")}
        </Button>
      </div>
    </Card>
  );
}

// Choosing the TL language and the stream (video link or custom id) to edit.
function EditorSettingsPanel({
  username,
  tlLang,
  onTlLang,
  link,
  onLink,
  onChangeUsername,
  onConfirm,
}: {
  username: string;
  tlLang: any;
  onTlLang: (lang: any) => void;
  link: string;
  onLink: (value: string) => void;
  onChangeUsername: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations();
  return (
    <Card className="space-y-5 p-5">
      <div className="text-lg font-normal">{t("views.tlClient.settingPanel.title")}</div>
      <div className="text-sm text-muted-foreground">
        {`${t("views.watch.uploadPanel.usernameText")} : ${username} `}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-xs underline"
          onClick={onChangeUsername}
        >
          {t("views.watch.uploadPanel.usernameChange")}
        </Button>
      </div>
      <Label className="flex flex-col items-stretch gap-2 text-sm font-normal leading-normal select-auto">
        <span>{t("views.watch.uploadPanel.tlLang")}</span>
        <Select
          value={tlLang.value}
          onValueChange={(value) =>
            onTlLang(TL_LANGS.find((item) => item.value === value) || TL_LANGS[0])
          }
        >
          <SelectTrigger className="w-full">
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
      </Label>
      <Input
        value={link}
        placeholder={t("views.tlClient.settingPanel.mainStreamLink")}
        onChange={(event) => onLink(event.target.value)}
      />
      <div className="flex justify-center">
        <Button size="sm" onClick={onConfirm}>
          {t("views.tlClient.okBtn")}
        </Button>
      </div>
    </Card>
  );
}

// The editor's dialog: 1 add profile, 2 remove profile, 4 set start, 5 settings, 6 export,
// 7 clear all, 9 time shift, 10 change custom link.
function EditorDialog({
  open,
  mode,
  onOpenChange,
  onClose,
  profileName,
  newProfileName,
  onNewProfileName,
  onAddProfile,
  onDeleteProfile,
  onSetStart,
  onClearAll,
  offset,
  onOffset,
  onShiftTime,
  link,
  onLink,
  settings,
  exportPanel,
}: {
  open: boolean;
  mode: number;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  profileName?: string;
  newProfileName: string;
  onNewProfileName: (value: string) => void;
  onAddProfile: () => void;
  onDeleteProfile: () => void;
  onSetStart: () => void;
  onClearAll: () => void;
  offset: number | string;
  onOffset: (value: string) => void;
  onShiftTime: () => void;
  link: string;
  onLink: (value: string) => void;
  settings: React.ReactNode;
  exportPanel: React.ReactNode;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={mode === 7 ? "max-w-sm p-0" : "max-w-2xl p-0"}>
        {mode === 1 ? (
          <EditorConfirmCard
            title={t("views.tlClient.addProfilePanel.title")}
            onCancel={onClose}
            onConfirm={onAddProfile}
          >
            <Input
              value={newProfileName}
              placeholder={t("views.tlClient.addProfilePanel.inputLabel")}
              onChange={(event) => onNewProfileName(event.target.value)}
            />
          </EditorConfirmCard>
        ) : null}
        {mode === 2 ? (
          <EditorConfirmCard
            title={`${t("views.tlClient.removeProfileTitle")} ${profileName}.`}
            onCancel={onClose}
            onConfirm={onDeleteProfile}
          />
        ) : null}
        {mode === 4 ? (
          <EditorConfirmCard
            title={t("views.scriptEditor.setStartTitle")}
            onCancel={onClose}
            onConfirm={() => {
              onSetStart();
              onClose();
            }}
          />
        ) : null}
        {mode === 5 ? settings : null}
        {mode === 6 ? <Card className="p-0">{exportPanel}</Card> : null}
        {mode === 7 ? (
          <EditorConfirmCard
            title={t("views.scriptEditor.menu.clearAll")}
            destructive
            onCancel={onClose}
            onConfirm={onClearAll}
          />
        ) : null}
        {mode === 9 ? (
          <EditorConfirmCard
            title={t("views.scriptEditor.menu.timeShift")}
            onCancel={onClose}
            onConfirm={() => {
              onClose();
              onShiftTime();
            }}
          >
            <Label className="flex flex-col items-stretch gap-2 text-sm font-normal leading-normal select-auto">
              <span>{t("views.scriptEditor.timeShift.offset")}</span>
              <div className="flex items-center gap-2">
                <Input
                  value={offset}
                  className="flex-1"
                  type="number"
                  onChange={(event) => onOffset(event.target.value)}
                />
                <span className="text-muted-foreground">
                  {t("views.scriptEditor.timeShift.seconds")}
                </span>
              </div>
            </Label>
          </EditorConfirmCard>
        ) : null}
        {mode === 10 ? (
          <EditorConfirmCard
            title={t("views.tlManager.changeStreamLink")}
            onCancel={onClose}
            onConfirm={onClose}
          >
            <Input
              value={link}
              placeholder={t("views.tlManager.newLink")}
              onChange={(event) => onLink(event.target.value)}
            />
          </EditorConfirmCard>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function TLScriptEditorPage() {
  return (
    <Suspense fallback={null}>
      <TLScriptEditor />
    </Suspense>
  );
}

// Script entries from the TL history: times relative to the stream start (or the first line),
// each lasting until the next unless it has its own duration.
function entriesFromHistory(data: any[], videoObj: any) {
  const filtered = data
    .filter((e: any) => !videoObj?.start_actual || e.timestamp >= videoObj.start_actual)
    .map((e: any) => {
      const timestampShifted = e.timestamp - (videoObj?.start_actual || data?.[0]?.timestamp || 0);
      return { ...e, timestampShifted };
    });
  return filtered.map((e: any, index: number) => ({
    id: e.id,
    Time: e.timestampShifted,
    realTime: +e.timestamp,
    SText: e.message,
    Profile: 0,
    Duration: e.duration
      ? Number(e.duration)
      : index === filtered.length - 1
        ? 3000
        : filtered[index + 1].timestamp - e.timestamp,
  }));
}

// The pending Add/Change/Delete log as the API's request body (entries no longer present are
// skipped).
function logRequestBody(
  log: any[],
  entryList: any[],
  { videoObj, lang, username }: { videoObj: any; lang: string; username?: string },
) {
  const timestampOf = (entry: any) =>
    Math.floor(videoObj.start_actual ? videoObj.start_actual + entry.Time : entry.realTime);
  // First entry per id, as a lookup.
  const byId = new Map<any, any>();
  for (const item of entryList) if (!byId.has(item.id)) byId.set(item.id, item);
  const body: any[] = [];
  for (const e of log) {
    if (e.type === "Delete") {
      body.push({ type: "Delete", data: { id: e.id } });
      continue;
    }
    const entry = byId.get(e.id);
    if (!entry) continue;
    if (e.type === "Change")
      body.push({
        type: "Change",
        data: {
          lang,
          id: entry.id,
          name: username,
          timestamp: timestampOf(entry),
          message: entry.SText,
          duration: Math.floor(entry.Duration),
        },
      });
    else if (e.type === "Add")
      body.push({
        type: "Add",
        data: {
          tempid: entry.id,
          name: username,
          timestamp: timestampOf(entry),
          message: entry.SText,
          duration: Math.floor(entry.Duration),
        },
      });
  }
  return body;
}

// Inserts `dt` in time order. The entry before it is cut to end where it starts (its id is
// returned so the change gets saved), and `dt` lasts until the next entry when there is one.
function withEntryInserted(entries: any[], dt: any) {
  const next = structuredClone(entries);
  const i = next.findIndex((entry: any) => entry.Time > dt.Time);
  const index = i === -1 ? next.length : i;
  const before = next[index - 1];
  if (before) before.Duration = dt.Time - before.Time;
  if (i !== -1) dt.Duration = next[i].Time - dt.Time;
  next.splice(index, 0, dt);
  return { next, index, trimmedId: before?.id };
}

const MIN_ENTRY_MS = 300;

// Applies a timeline drag of `xChange` ms to entry `idx` (mode 0: left edge, 1: whole entry,
// 2: right edge), pushing neighbours out of the way. Mutates `entries`; returns false (the drag
// stops) when that would shrink any entry under 300ms or move the left edge off the visible bars.
function dragTimelineEntry(
  entries: any[],
  idx: number,
  xChange: number,
  mode: number,
  visibleStartMs: number,
) {
  const entry = entries[idx];
  const prev = entries[idx - 1];
  const next = entries[idx + 1];
  const overlapsPrev = () => !!prev && entry.Time + xChange < prev.Time + prev.Duration;
  const overlapsNext = () => !!next && entry.Time + entry.Duration + xChange > next.Time;
  // Shrinks the previous entry to make room; false when it would get too short.
  const pushPrev = () => {
    if (!overlapsPrev()) return true;
    if (prev.Duration + xChange <= MIN_ENTRY_MS) return false;
    prev.Duration += xChange;
    return true;
  };
  // Starts the next entry later to make room; false when it would get too short.
  const pushNext = () => {
    if (!overlapsNext()) return true;
    if (next.Duration - xChange <= MIN_ENTRY_MS) return false;
    next.Duration -= xChange;
    next.Time = entry.Time + entry.Duration + xChange;
    return true;
  };
  if (mode === 0) {
    if (entry.Duration - xChange < MIN_ENTRY_MS) return false;
    if (entry.Time + xChange < visibleStartMs) return false;
    if (!pushPrev()) return false;
    entry.Duration -= xChange;
    entry.Time += xChange;
  } else if (mode === 1) {
    if (entry.Duration - xChange < MIN_ENTRY_MS) return false;
    if (!pushPrev() || !pushNext()) return false;
    entry.Time = entry.Time + xChange > 0 ? entry.Time + xChange : 0;
  } else if (mode === 2) {
    if (entry.Duration + xChange < MIN_ENTRY_MS) return false;
    if (!pushNext()) return false;
    entry.Duration += xChange;
  }
  return true;
}

// TL profiles for this session, the active one, and the legend shown briefly on every switch.
function useEditorProfiles() {
  const [profile, setProfile] = useState<any[]>(defaultProfile);
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
    setProfileDisplay(true);
    if (profileDisplayTimer.current) clearTimeout(profileDisplayTimer.current);
    profileDisplayTimer.current = setTimeout(() => setProfileDisplay(false), 3000);
  }
  function jump(idx: number) {
    if (idx < profile.length) setProfileIdx(idx);
    showProfileList();
  }
  function down(isTab = false) {
    setProfileIdx((idx) => (idx === profile.length - 1 ? (isTab ? 1 : 0) : idx + 1));
    showProfileList();
  }
  function up() {
    setProfileIdx((idx) => (idx === 0 ? profile.length - 1 : idx - 1));
    showProfileList();
  }
  // Moves the active profile one place; the default profile (index 0) stays first.
  function swap(dir: -1 | 1) {
    if (
      (dir === -1 && profileIdx <= 1) ||
      (dir === 1 && (profileIdx === 0 || profileIdx >= profile.length - 1))
    ) {
      showProfileList();
      return;
    }
    setProfile((prev) => {
      const next = structuredClone(prev);
      [next[profileIdx + dir], next[profileIdx]] = [next[profileIdx], next[profileIdx + dir]];
      return next;
    });
    setProfileIdx((idx) => idx + dir);
    showProfileList();
  }
  function add(rawName: string) {
    const nextName = rawName.trim() || `Profile ${profile.length}`;
    setProfile((prev) => [
      ...prev,
      {
        id: newTlProfileId(),
        Name: nextName,
        Prefix: "",
        Suffix: "",
        useCC: false,
        CC: "#000000",
        useOC: false,
        OC: "#000000",
      },
    ]);
    setProfileIdx(profile.length);
    showProfileList();
  }
  // Removes the active profile (never the default); `onRemoved` gets its index first.
  function remove(onRemoved: (index: number) => void) {
    if (profileIdx !== 0) {
      const deletedIdx = profileIdx;
      onRemoved(deletedIdx);
      setProfile((prev) => prev.filter((_, idx) => idx !== deletedIdx));
      setProfileIdx((idx) => Math.max(0, idx - 1));
    }
    showProfileList();
  }
  // Imported profiles follow the default one, renamed Profile1, Profile2, ...
  function replaceWithImported(profileData: any[]) {
    const nextProfile = structuredClone(defaultProfile);
    profileData.forEach((item, i) => {
      nextProfile.push({ ...item, Name: `Profile${i + 1}` });
    });
    setProfile(withTlProfileIds(nextProfile));
    setProfileIdx(0);
  }
  function update(index: number, patch: any) {
    setProfile((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }
  return {
    profile,
    setProfile,
    profileIdx,
    setProfileIdx,
    profileDisplay,
    showProfileList,
    jump,
    down,
    up,
    swap,
    add,
    remove,
    replaceWithImported,
    update,
  };
}

type ApiRefs = {
  videoDataRef: React.RefObject<any>;
  TLLangRef: React.RefObject<any>;
  userdataRef: React.RefObject<any>;
  activeURLStreamRef: React.RefObject<string>;
  /** The entry shown under the player; edits that move entries reset it. */
  setDisplayEntry: (index: number) => void;
};

// The script's entries plus the log of unsaved Add/Change/Delete operations, which is posted
// (and Add temp ids swapped for real ones) by processLog.
function useScriptEntries({
  videoDataRef,
  TLLangRef,
  userdataRef,
  activeURLStreamRef,
  setDisplayEntry,
}: ApiRefs) {
  const transactionLog = useRef<any[]>([]);
  const entriesRef = useRef<any[]>([]);
  const selectedEntryRef = useRef(-1);
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState(-1);

  useEffect(() => {
    entriesRef.current = entries;
    selectedEntryRef.current = selectedEntry;
  }, [entries, selectedEntry]);

  function replace(next: any[]) {
    entriesRef.current = next;
    setEntries(next);
  }

  function reload(videoObj = videoDataRef.current, link = activeURLStreamRef.current) {
    if (!videoObj) return;
    const isCustom = videoObj.id === "custom";
    return api
      .chatHistory(videoObj.id, {
        lang: TLLangRef.current.value,
        verified: 0,
        moderator: 0,
        vtuber: 0,
        limit: 100000,
        mode: 1,
        ...(userdataRef.current.user?.role === "user" && {
          creator_id: userdataRef.current.user.id,
        }),
        ...(isCustom && { custom_video_id: videoObj.custom_video_id || link }),
      })
      .then(({ data }: any) => {
        replace(entriesFromHistory(data, videoObj));
        setSelectedEntry(-1);
        setDisplayEntry(-1);
      })
      .catch(console.error);
  }

  function logChange(id: any) {
    if (transactionLog.current.filter((e) => e.id === id).length === 0)
      transactionLog.current.push({ type: "Change", id });
  }

  function markDelete(id: any) {
    const existing = transactionLog.current.filter((e) => e.id === id);
    if (!existing.length) {
      transactionLog.current.push({ type: "Delete", id });
      return;
    }
    transactionLog.current = transactionLog.current.filter((e) => e.id !== id);
    if (existing.some((e) => e.type === "Change"))
      transactionLog.current.push({ type: "Delete", id });
  }

  function processLog(
    forget = false,
    entryList = entriesRef.current,
    videoObj = videoDataRef.current,
  ) {
    if (transactionLog.current.length === 0) return;
    if (!videoObj) return;
    const logCopy = transactionLog.current.splice(0, transactionLog.current.length);
    const processedLog = logRequestBody(logCopy, entryList, {
      videoObj,
      lang: TLLangRef.current.value,
      username: userdataRef.current.user?.username,
    });
    const isCustom = videoObj.id === "custom";
    const postTLOption = {
      videoId: videoObj.id,
      jwt: userdataRef.current.jwt!,
      body: processedLog,
      lang: TLLangRef.current.value,
      ...(isCustom && { custom_video_id: videoObj.custom_video_id || activeURLStreamRef.current }),
      override: false,
    };
    if (forget) {
      api.postTLLog(postTLOption).catch(console.error);
      return;
    }
    api
      .postTLLog(postTLOption)
      .then(({ status, data }: any) => {
        if (status === 200 && Array.isArray(data)) {
          const next = entriesRef.current.map((entry) => {
            const addResult = data.find(
              (res: any) => res.type === "Add" && res.tempid === entry.id,
            );
            return addResult ? { ...entry, id: addResult.res.id } : entry;
          });
          replace(next);
          data.forEach((res: any) => {
            if (res.type === "Add")
              transactionLog.current.forEach((e) => {
                if (e.id === res.tempid) e.id = res.res.id;
              });
          });
        }
      })
      .catch((err: any) => {
        console.error(err);
        alert(`Failed to save: ${err}`);
      });
  }

  // Stretches each entry to the next one's start, closing gaps.
  function continuousTime() {
    setDisplayEntry(-1);
    setSelectedEntry(-1);
    const prev = entriesRef.current;
    const next = prev.map((entry, index) => {
      if (index === prev.length - 1) return entry;
      if (entry.Time + entry.Duration < prev[index + 1].Time) {
        logChange(entry.id);
        return { ...entry, Duration: prev[index + 1].Time - entry.Time };
      }
      return entry;
    });
    replace(next);
    processLog(false, next);
  }

  function add(dt: any) {
    const { next, index, trimmedId } = withEntryInserted(entriesRef.current, dt);
    if (trimmedId !== undefined) logChange(trimmedId);
    setDisplayEntry(index);
    transactionLog.current.push({ type: "Add", id: dt.id });
    replace(next);
  }

  function deleteSelected() {
    if (selectedEntry < 0) return;
    const deleted = entriesRef.current[selectedEntry];
    if (!deleted) return;
    const next = entriesRef.current.filter((_, index) => index !== selectedEntry);
    markDelete(deleted.id);
    replace(next);
    setDisplayEntry(-1);
    setSelectedEntry(-1);
  }

  function clearAll() {
    setDisplayEntry(-1);
    setSelectedEntry(-1);
    entriesRef.current.forEach((entry) => {
      markDelete(entry.id);
    });
    replace([]);
    processLog(false, []);
  }

  // Drops everything before the selected entry and makes it start at 0.
  function startAtSelected() {
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
    replace(next);
    setSelectedEntry(-1);
  }

  function shiftAll(offset: number) {
    const next = entriesRef.current.map((entry) => ({
      ...entry,
      Time: Math.max(entry.Time + offset * 1000, 0),
      realTime: Math.max(Number.parseFloat(entry.realTime) + offset * 1000, 0),
    }));
    next.forEach((entry) => {
      logChange(entry.id);
    });
    replace(next);
  }

  function update(index: number, patch: any) {
    const current = entriesRef.current[index];
    if (!current) return;
    const next = entriesRef.current.map((entry, idx) =>
      idx === index ? { ...entry, ...patch } : entry,
    );
    logChange(current.id);
    replace(next);
  }

  // Replaces the script with imported entries (their profiles shift past the default one).
  function importEntries(entriesData: any[]) {
    setDisplayEntry(-1);
    setSelectedEntry(-1);
    entriesRef.current.forEach((entry) => {
      markDelete(entry.id);
    });
    const next: any[] = [];
    entriesData.forEach((item, i) => {
      const dt = { ...item, id: `I${i}`, Profile: item.Profile + 1 };
      next.push(dt);
      transactionLog.current.push({ type: "Add", id: dt.id });
    });
    return next;
  }

  return {
    entries,
    entriesRef,
    selectedEntry,
    setSelectedEntry,
    selectedEntryRef,
    replace,
    reload,
    logChange,
    processLog,
    continuousTime,
    add,
    deleteSelected,
    clearAll,
    startAtSelected,
    shiftAll,
    update,
    importEntries,
  };
}

type ScriptEntries = ReturnType<typeof useScriptEntries>;

// The YouTube player (when a video is loaded) or a manual stopwatch, driving `timerTime` (ms).
function usePlaybackTimer() {
  const player = useRef<any>(null);
  const manualTimerTick = useRef(0);
  const [vidPlayer, setVidPlayer] = useState(false);
  const [timerTime, setTimerTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    if (!timerActive) return;
    manualTimerTick.current = Date.now();
    const id = setInterval(
      () => {
        if (vidPlayer && player.current?.getCurrentTime) {
          setTimerTime(player.current.getCurrentTime() * 1000);
          return;
        }
        const now = Date.now();
        const delta = now - manualTimerTick.current;
        manualTimerTick.current = now;
        if (delta < 1000) setTimerTime((time) => time + delta);
      },
      vidPlayer ? 100 : 250,
    );
    return () => clearInterval(id);
  }, [timerActive, vidPlayer]);

  function unload() {
    setVidPlayer(false);
    setTimerActive(false);
    if (player.current?.destroy) player.current.destroy();
    player.current = null;
  }

  function loadYT(videoId: string) {
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
    if (win.YT?.Player) {
      start();
      return;
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
    Object.assign(window as any, { onYouTubeIframeAPIReady: () => start() });
  }

  // Shows the player panel, then creates the player once its #player element exists.
  function load(link: string) {
    setVidPlayer(true);
    const checker = window.setInterval(() => {
      const playerDiv = document.getElementById("player");
      if (!playerDiv) return;
      window.clearInterval(checker);
      if (timerActive) setTimerActive(false);
      const ytId = link.match(VIDEO_URL_REGEX)?.groups?.id;
      if (ytId) loadYT(ytId);
    }, 1000);
  }

  function seek(time: number) {
    if (vidPlayer && player.current?.seekTo) {
      player.current.seekTo((player.current.getCurrentTime?.() || 0) + time / 1000, true);
    } else if (timerTime + time < 0) {
      setTimerTime(0);
    } else {
      setTimerTime((value) => value + time);
    }
  }

  const stop = () =>
    vidPlayer && player.current?.pauseVideo ? player.current.pauseVideo() : setTimerActive(false);
  const start = () =>
    vidPlayer && player.current?.playVideo
      ? player.current.playVideo()
      : !timerActive && setTimerActive(true);
  function toggle() {
    const playing =
      vidPlayer && player.current?.getPlayerState
        ? player.current.getPlayerState() === 1
        : timerActive;
    if (playing) stop();
    else start();
  }

  return { vidPlayer, timerTime, load, unload, seek, stop, start, toggle };
}

// Dragging timeline entries: from the middle moves them, from an edge resizes them.
function useTimelineDrag(script: ScriptEntries, barCount: number) {
  const timelineActive = useRef(false);
  const resizeMode = useRef(0);
  const xPos = useRef(0);

  function stop() {
    if (timelineActive.current) {
      const entry = script.entriesRef.current[script.selectedEntryRef.current];
      if (entry) script.logChange(entry.id);
    }
    timelineActive.current = false;
  }

  function start(event: React.MouseEvent, idx: number, nextResizeMode: number) {
    if (timelineActive.current) return;
    event.preventDefault();
    script.setSelectedEntry(idx);
    script.selectedEntryRef.current = idx;
    timelineActive.current = true;
    xPos.current = event.clientX;
    resizeMode.current = nextResizeMode;
  }

  function move(event: React.MouseEvent) {
    if (!timelineActive.current) return;
    const selectedIdx = script.selectedEntryRef.current;
    const currentEntries = structuredClone(script.entriesRef.current);
    if (!currentEntries[selectedIdx]) {
      timelineActive.current = false;
      return;
    }
    const xChange = ((event.clientX - xPos.current) / secToPx) * 1000;
    const moved = dragTimelineEntry(
      currentEntries,
      selectedIdx,
      xChange,
      resizeMode.current,
      secPerBar * barCount * 1000,
    );
    if (!moved) {
      timelineActive.current = false;
      return;
    }
    xPos.current = event.clientX;
    script.replace(currentEntries);
  }

  return { stop, start, move };
}

// The ruler bars visible from `barCount` on, and the entries that fall on them.
function visibleTimelineEntries(entries: any[], barCount: number) {
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
}

// Which entry's text to show under the player for the timer position (-1: none). Keeps the
// current one while it still covers the timer.
function displayedEntryAt(
  timerTime: number,
  entries: any[],
  timelineEntries: Array<{ entry: any; idx: number }>,
  displayEntry: number,
) {
  if (timelineEntries.length === 0) return -1;
  if (timerTime < timelineEntries[0].entry.Time) return -1;
  const current = entries[displayEntry];
  if (current && timerTime > current.Time && current.Time + current.Duration > timerTime)
    return displayEntry;
  for (let i = timelineEntries.length - 1; i >= 0; i -= 1) {
    if (timerTime > timelineEntries[i].entry.Time) return timelineEntries[i].idx;
  }
  return displayEntry;
}

// A YouTube video's id, status, start time and title (the API's empty reply passes through).
async function fetchScriptVideo(videoId: string, lang: string) {
  const data = (await api.video(videoId, lang)).data;
  if (!data) return data;
  return {
    id: videoId,
    status: data.status,
    start_actual: !data.start_actual
      ? Date.parse(data.available_at)
      : Date.parse(data.start_actual),
    title: data.title,
  };
}

// The three ruler bars shown, following the timer (adjusted during render so the bars and the
// entries shown on them update in the same commit), drawn on canvases and scrolled so the
// playhead sits on the timer.
function useTimelineView(timerTime: number, entries: any[]) {
  const timelineDiv = useRef<HTMLDivElement | null>(null);
  const timeCanvas0 = useRef<HTMLCanvasElement | null>(null);
  const timeCanvas1 = useRef<HTMLCanvasElement | null>(null);
  const timeCanvas2 = useRef<HTMLCanvasElement | null>(null);
  const [barCount, setBarCount] = useState(0);
  const [barTimerTime, setBarTimerTime] = useState(timerTime);
  if (barTimerTime !== timerTime) {
    setBarTimerTime(timerTime);
    const next = nextBarCount(barCount, timerTime);
    if (next !== barCount) setBarCount(next);
  }
  const timelineEntries = useMemo(
    () => visibleTimelineEntries(entries, barCount),
    [entries, barCount],
  );

  useEffect(() => {
    [timeCanvas0.current, timeCanvas1.current, timeCanvas2.current].forEach((canvas, idx) => {
      renderTimelineCanvas(canvas, idx, barCount);
    });
  }, [barCount]);

  useEffect(() => {
    if (timelineDiv.current)
      timelineDiv.current.scrollLeft = (timerTime / 1000 - barCount * secPerBar) * secToPx;
  }, [timerTime, barCount]);

  return {
    barCount,
    timelineEntries,
    timelineDiv,
    canvasRefs: [timeCanvas0, timeCanvas1, timeCanvas2],
  };
}

// The TL input bar and, when shown, the active profile's settings.
function EditorControls({
  profile,
  input,
  onInput,
  onSend,
  settingsShown,
  onShowSettings,
  onPrefix,
  onSuffix,
  onAddProfile,
  onRemoveProfile,
  onShiftUp,
  onShiftDown,
}: {
  profile: any;
  input: string;
  onInput: (value: string) => void;
  onSend: () => void;
  settingsShown: boolean;
  onShowSettings: (update: (shown: boolean) => boolean) => void;
  onPrefix: (value: string) => void;
  onSuffix: (value: string) => void;
  onAddProfile: () => void;
  onRemoveProfile: () => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
}) {
  return (
    <>
      <EditorInputBar
        prefix={profile?.Prefix}
        suffix={profile?.Suffix}
        value={input}
        onChange={onInput}
        onSend={onSend}
        settingsShown={settingsShown}
        onToggleSettings={() => onShowSettings((value) => !value)}
      />
      {settingsShown ? (
        <EditorProfileSettings
          profile={profile}
          onClose={() => onShowSettings(() => false)}
          onPrefix={onPrefix}
          onSuffix={onSuffix}
          onAddProfile={onAddProfile}
          onRemoveProfile={onRemoveProfile}
          onShiftUp={onShiftUp}
          onShiftDown={onShiftDown}
        />
      ) : null}
    </>
  );
}

// Loads the script for a link: a YouTube video's TLs (timed from its start), or a custom id's.
async function openScriptSource(
  link: string,
  lang: string,
  setVideoData: (data: any) => void,
  script: ScriptEntries,
) {
  let vidData: any = {
    id: "custom",
    custom_video_id: link,
    start_actual: null,
    status: null,
    title: link,
  };
  setVideoData(vidData);
  try {
    const parseVideoID = link.match(VIDEO_URL_REGEX)?.groups?.id;
    if (parseVideoID) {
      vidData = await fetchScriptVideo(parseVideoID, lang);
      if (vidData) setVideoData(vidData);
    }
  } catch (e) {
    console.error(e);
  }
  script.replace([]);
  await script.reload(vidData, link);
}

// Profile switching (Up/Down, Tab/Shift-Tab, Ctrl+digit) and playback (Ctrl+Space,
// Ctrl+Left/Right to seek 3s).
function handleEditorKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  profiles: ReturnType<typeof useEditorProfiles>,
  playback: ReturnType<typeof usePlaybackTimer>,
) {
  const actions: [boolean, () => void][] = [
    [event.key === "ArrowUp" && !event.ctrlKey, profiles.up],
    [event.key === "ArrowDown" && !event.ctrlKey, () => profiles.down(false)],
    [event.key === "Tab" && event.shiftKey, () => profiles.jump(0)],
    [event.key === "Tab", () => profiles.down(true)],
    [event.ctrlKey && event.key === " ", playback.toggle],
    [event.ctrlKey && event.key === "ArrowLeft", () => playback.seek(-3000)],
    [event.ctrlKey && event.key === "ArrowRight", () => playback.seek(3000)],
    [event.ctrlKey && /^[0-9]$/.test(event.key), () => profiles.jump(Number(event.key))],
  ];
  const action = actions.find(([matches]) => matches)?.[1];
  if (!action) return;
  event.preventDefault();
  action();
}

// Which editor dialog is open (see EditorDialog); the settings dialog shows first.
function useEditorModal() {
  const [modalNexus, setModalNexus] = useState(true);
  const [modalMode, setModalMode] = useState(5);
  const openModal = (mode: number) => {
    setModalMode(mode);
    setModalNexus(true);
  };
  const closeModal = () => setModalNexus(false);
  return { modalNexus, setModalNexus, modalMode, openModal, closeModal };
}

// Refs mirroring the session values the save/reload handlers read, so timers and the unmount
// flush always see the latest ones.
function useSyncedRefs(values: {
  videoData: any;
  TLLang: any;
  activeURLStream: string;
  userdata: any;
}) {
  const videoDataRef = useRef<any>(values.videoData);
  const TLLangRef = useRef<any>(values.TLLang);
  const activeURLStreamRef = useRef(values.activeURLStream);
  const userdataRef = useRef(values.userdata);
  const { videoData, TLLang, activeURLStream, userdata } = values;
  useEffect(() => {
    videoDataRef.current = videoData;
    TLLangRef.current = TLLang;
    activeURLStreamRef.current = activeURLStream;
    userdataRef.current = userdata;
  }, [videoData, TLLang, activeURLStream, userdata]);
  return { videoDataRef, TLLangRef, activeURLStreamRef, userdataRef };
}

const selectionTimes = (selected: any) => ({
  timeStampStart: selected ? formatTlTimestamp(selected.Time) : "00:00:00.00",
  timeStampEnd: selected ? formatTlTimestamp(selected.Time + selected.Duration) : "00:00:00.00",
});

// Autosaves every 15s; on leaving, stops playback and sends what's left without waiting.
function useAutosave(script: ScriptEntries, playback: ReturnType<typeof usePlaybackTimer>) {
  const autosave = useEffectEvent(() => script.processLog(false));
  const flushOnLeave = useEffectEvent(() => {
    playback.unload();
    script.processLog(true);
  });
  useEffect(() => {
    const logger = setInterval(() => autosave(), 15 * 1000);
    return () => {
      clearInterval(logger);
      flushOnLeave();
    };
  }, []);
}

function EditorProfileLegend({
  show,
  profile,
  activeIndex,
}: {
  show: boolean;
  profile: any[];
  activeIndex: number;
}) {
  if (!show) return null;
  return (
    <Card className="absolute bottom-[5px] right-[5px] flex flex-col">
      <TlProfileLegend profiles={profile} activeIndex={activeIndex} />
    </Card>
  );
}

function TLScriptEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appStore = useAppState();
  const { modalNexus, setModalNexus, modalMode, openModal, closeModal } = useEditorModal();
  const [activeURLStream, setActiveURLStream] = useState("");
  const [TLLang, setTLLang] = useState<any>(TL_LANGS[0]);
  const [videoData, setVideoData] = useState<any>(undefined);
  const { videoDataRef, TLLangRef, activeURLStreamRef, userdataRef } = useSyncedRefs({
    videoData,
    TLLang,
    activeURLStream,
    userdata: appStore.userdata,
  });
  const [displayEntry, setDisplayEntry] = useState(0);
  const script = useScriptEntries({
    videoDataRef,
    TLLangRef,
    userdataRef,
    activeURLStreamRef,
    setDisplayEntry,
  });
  const { entries, selectedEntry } = script;
  const profiles = useEditorProfiles();
  const { profile, profileIdx, profileDisplay, setProfileIdx, showProfileList } = profiles;
  const playback = usePlaybackTimer();
  const { vidPlayer, timerTime } = playback;
  const [importPanelShow, setImportPanelShow] = useState(false);
  const [TLSetting, setTLSetting] = useState(true);
  const [inputString, setInputString] = useState("");
  const [addProfileNameString, setAddProfileNameString] = useState("");
  const [offsetInput, setOffsetInput] = useState<number | string>(0);
  const [linkInput, setLinkInput] = useState("");
  const timeline = useTimelineView(timerTime, entries);
  const { timelineEntries } = timeline;
  const drag = useTimelineDrag(script, timeline.barCount);

  const profileListPicker = useMemo(
    () => profile.map((item, idx) => ({ name: item.Name, idx })),
    [profile],
  );
  const { timeStampStart, timeStampEnd } = selectionTimes(entries[selectedEntry]);
  const timerPrint = formatTlTimestamp(timerTime);

  function loadVideo(link: string) {
    setActiveURLStream(link);
    playback.load(link);
  }

  function addEntry() {
    const currentProfile = profile[profileIdx] || profile[0];
    script.add({
      id: Date.now(),
      Time: timerTime,
      Duration: 3000,
      SText: `${currentProfile.Prefix || ""}${inputString}${currentProfile.Suffix || ""}`,
      Profile: profileIdx,
      realTime: timerTime,
    });
    setInputString("");
  }

  function clearAll() {
    script.clearAll();
    closeModal();
  }

  function shiftTime() {
    const offset = Number.parseFloat(String(offsetInput));
    if (Number.isNaN(offset)) {
      alert("Invalid offset");
      return;
    }
    script.shiftAll(offset);
    setOffsetInput(0);
  }

  function addProfile() {
    profiles.add(addProfileNameString);
    closeModal();
  }
  // Entries of a deleted profile fall back to the default one.
  function deleteProfile() {
    profiles.remove((deletedIdx) =>
      script.replace(
        script.entriesRef.current.map((entry) =>
          entry.Profile === deletedIdx ? { ...entry, Profile: 0 } : entry,
        ),
      ),
    );
    closeModal();
  }
  function changeUsernameClick() {
    openUserMenu();
    router.push("/");
  }
  async function settingOKClick() {
    if (!activeURLStream) return;
    await openScriptSource(activeURLStream, TLLang.value, setVideoData, script);

    if (vidPlayer) {
      playback.unload();
      setTimeout(() => loadVideo(activeURLStream), 1000);
    } else {
      loadVideo(activeURLStream);
    }
    closeModal();
  }

  function processImportData({
    entriesData,
    profileData,
  }: {
    entriesData: any[];
    profileData: any[];
  }) {
    const next = script.importEntries(entriesData);
    profiles.replaceWithImported(profileData);
    script.replace(next);
    script.processLog(false, next);
  }

  const openFromRoute = useEffectEvent((video: string) => {
    document.title = "TLScriptEditor - Holodex";
    appStore.loginVerify({ bounceToLogin: true });
    if (video) setActiveURLStream(videoCodeParser(video));
    openModal(5);
  });
  useEffect(() => {
    openFromRoute(searchParams.get("video") || "");
  }, [searchParams]);

  useEffect(() => {
    const next = displayedEntryAt(timerTime, entries, timelineEntries, displayEntry);
    if (next !== displayEntry) setDisplayEntry(next);
  }, [timerTime, entries, timelineEntries, displayEntry]);

  useAutosave(script, playback);

  return (
    <div
      className="flex h-screen max-h-screen px-3"
      onKeyDown={(event) => {
        if (event.ctrlKey && event.key.toLowerCase() === "s") {
          event.preventDefault();
          script.processLog();
        }
      }}
    >
      <div className="flex h-full w-full flex-col">
        <EditorMenu
          isCustom={videoData?.id === "custom"}
          onHome={() => router.push("/")}
          onSettings={() => openModal(5)}
          onSave={() => script.processLog()}
          onExport={() => openModal(6)}
          onImport={() => setImportPanelShow(true)}
          onContinuous={script.continuousTime}
          onTimeShift={() => openModal(9)}
          onChangeLink={() => {
            openModal(10);
            setLinkInput(activeURLStream);
          }}
          onClearAll={() => openModal(7)}
        />

        <div className="flex h-full flex-row items-stretch gap-3">
          <EntryTable
            entries={entries}
            selectedEntry={selectedEntry}
            onSelect={script.setSelectedEntry}
            profile={profile}
            profileOptions={profileListPicker}
            useRealTime={videoData?.id === "custom"}
            timeStampStart={timeStampStart}
            timeStampEnd={timeStampEnd}
            timerControls={
              !vidPlayer ? (
                <TimerControls
                  className="absolute right-[5px] top-[5px] z-[1] flex flex-row items-center gap-2"
                  time={timerPrint}
                  onStop={playback.stop}
                  onStart={playback.start}
                />
              ) : null
            }
            onEntryProfile={(index, nextProfile) => {
              setProfileIdx(nextProfile);
              script.update(index, { Profile: nextProfile });
              showProfileList();
            }}
            onEntryText={(index, text) => script.update(index, { SText: text })}
            onSetStart={() => openModal(4)}
            onDelete={script.deleteSelected}
            legend={
              <EditorProfileLegend
                show={profileDisplay}
                profile={profile}
                activeIndex={profileIdx}
              />
            }
          />
          {vidPlayer ? (
            <PlayerPanel
              caption={
                displayEntry >= 0 && displayEntry < entries.length
                  ? entries[displayEntry].SText
                  : null
              }
              controls={
                <TimerControls
                  className="flex flex-row justify-center gap-2 px-4 py-3"
                  time={timerPrint}
                  onStop={playback.stop}
                  onStart={playback.start}
                />
              }
            />
          ) : null}
        </div>

        <div onKeyDown={(event) => handleEditorKeyDown(event, profiles, playback)}>
          <TimelineStrip
            timelineRef={timeline.timelineDiv}
            canvasRefs={timeline.canvasRefs}
            entries={timelineEntries}
            onStopDrag={drag.stop}
            onDragMove={drag.move}
            onDragStart={drag.start}
          />
          <EditorControls
            profile={profile[profileIdx]}
            input={inputString}
            onInput={setInputString}
            onSend={addEntry}
            settingsShown={TLSetting}
            onShowSettings={setTLSetting}
            onPrefix={(value) => profiles.update(profileIdx, { Prefix: value })}
            onSuffix={(value) => profiles.update(profileIdx, { Suffix: value })}
            onAddProfile={() => {
              openModal(1);
              setAddProfileNameString(`Profile ${profile.length}`);
            }}
            onRemoveProfile={() => openModal(2)}
            onShiftUp={() => profiles.swap(-1)}
            onShiftDown={() => profiles.swap(1)}
          />
        </div>
      </div>

      <ImportFile
        show={importPanelShow}
        onOpenChange={setImportPanelShow}
        onBounceDataBack={processImportData}
      />
      <EditorDialog
        open={modalNexus}
        mode={modalMode}
        onOpenChange={(open) => {
          if (open) setModalNexus(true);
          else if (modalMode !== 5) closeModal();
        }}
        onClose={closeModal}
        profileName={profile[profileIdx]?.Name}
        newProfileName={addProfileNameString}
        onNewProfileName={setAddProfileNameString}
        onAddProfile={addProfile}
        onDeleteProfile={deleteProfile}
        onSetStart={script.startAtSelected}
        onClearAll={clearAll}
        offset={offsetInput}
        onOffset={setOffsetInput}
        onShiftTime={shiftTime}
        link={linkInput}
        onLink={setLinkInput}
        settings={
          <EditorSettingsPanel
            username={appStore.userdata.user?.username || ""}
            tlLang={TLLang}
            onTlLang={setTLLang}
            link={activeURLStream}
            onLink={setActiveURLStream}
            onChangeUsername={changeUsernameClick}
            onConfirm={settingOKClick}
          />
        }
        exportPanel={
          <ScriptEditorExportToFile
            entries={entries}
            profile={profile}
            title={`${appStore.userdata.user?.username || ""} - ${videoData?.title || activeURLStream || "Holodex"}`}
          />
        }
      />
    </div>
  );
}
