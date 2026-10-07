"use client";

import { jwtDecode } from "jwt-decode";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useEffectEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChannelAutocomplete } from "@/components/channel/ChannelAutocomplete";
import { VideoSelector } from "@/components/multiview/VideoSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VideoCard } from "@/components/video/VideoCard";
import { api } from "@/lib/api";
import { Check, MinusSquare, Pencil, SquarePlus } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { dayjs, formatRelativeTime } from "@/lib/time";

const TIMEZONES = [
  { text: "JST", value: "Asia/Tokyo" },
  { text: "PST", value: "America/Los_Angeles" },
  { text: "GMT", value: "Etc/GMT" },
];

export default function AddPlaceholderPage() {
  return (
    <Suspense fallback={null}>
      <AddPlaceholder />
    </Suspense>
  );
}

type Option = { text: string; value: string };
type Translate = ReturnType<typeof useTranslations>;

function decodeToken(raw: string | undefined) {
  try {
    return raw ? jwtDecode<any>(raw) : null;
  } catch {
    return null;
  }
}

// The start time as an ISO string, or null while the date/time is incomplete or invalid.
function toAvailableAt(liveDate: string, liveTime: string, timezone: string) {
  if (!(liveTime && timezone && liveDate)) return null;
  const parsed = dayjs.tz(`${liveDate} ${liveTime}`, timezone);
  return parsed.isValid() ? parsed.toISOString() : null;
}

const validUrl = (value: string) => /^https?:\/\/[\w-]+(\.[\w-]+)+\.?(\/\S*)?/.test(value);

function urlError(value: string, required: boolean, t: Translate) {
  if (!value) return required ? t("component.form.required") : "";
  return validUrl(value) ? "" : t("component.form.invalidUrl");
}

function placeholderValidation(
  f: {
    isEditor: boolean;
    creditName: string;
    channel: any;
    videoTitle: string;
    sourceUrl: string;
    thumbnail: string;
    placeholderType: string;
    certainty: string;
    liveDate: string;
    liveTime: string;
    availableAt: string | null;
    duration: number;
  },
  t: Translate,
): Record<string, string> {
  const required = (ok: unknown) => (ok ? "" : t("component.form.required"));
  return {
    creditName: required(!f.isEditor || f.creditName),
    channel: required(f.channel?.id),
    videoTitle: required(f.videoTitle),
    sourceUrl: urlError(f.sourceUrl, true, t),
    thumbnail: urlError(f.thumbnail, false, t),
    placeholderType: required(f.placeholderType),
    certainty: required(f.certainty),
    liveDate: required(f.liveDate),
    liveTime: !f.liveTime
      ? t("component.form.required")
      : f.availableAt
        ? ""
        : t("component.form.invalidTime"),
    duration: required(Number(f.duration) > 0),
  };
}

// Editors are credited by their chosen name; Discord-link users by their Discord identity.
function placeholderCredits(isEditor: boolean, creditName: string, userId: any, token: any) {
  if (isEditor) return { editor: { name: creditName, user: userId } };
  if (token) return { discord: { name: token.name, link: token.link, user: token.user } };
  return null;
}

// The video card preview, with sample values for whatever isn't filled in yet.
function previewVideo(f: {
  videoTitle: string;
  placeholderType: string;
  channel: any;
  thumbnail: string;
  availableAt: string | null;
  credits: any;
  certainty: string;
  sourceUrl: string;
}) {
  const now = dayjs().toISOString();
  return {
    title: f.videoTitle || "Example Title",
    placeholderType: f.placeholderType || "scheduled-yt-stream",
    channel: f.channel || {
      id: "ExampleIdThatDoesntExist",
      name: "<CHANNEL>",
      english_name: "<CHANNEL>",
    },
    thumbnail: f.thumbnail,
    type: "placeholder",
    status: "upcoming",
    start_scheduled: f.availableAt || now,
    available_at: f.availableAt || now,
    credits: f.credits || { discord: { user: "Discord User", link: "jctkgHBt4b" } },
    certainty: f.certainty,
    link: f.sourceUrl,
  };
}

// Field with its validation message; fields without validation leave data-invalid off.
function FormField({
  label,
  error,
  description,
  children,
}: {
  label: string;
  error?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={error === undefined ? undefined : !!error}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

function OptionSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// An input between "minus" and "plus" step buttons.
function StepperInput({
  value,
  onChange,
  type,
  onStep,
}: {
  value: string;
  onChange: (value: string) => void;
  type: "date" | "time";
  onStep: (amount: number) => void;
}) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="icon" onClick={() => onStep(-1)}>
        <MinusSquare className="h-4 w-4" />
      </Button>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        className="min-w-0"
      />
      <Button variant="secondary" size="icon" onClick={() => onStep(1)}>
        <SquarePlus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Who is editing: a valid Discord link, or a warning that only editors can add placeholders.
function EditorAccessAlert({
  isEditor,
  token,
  expired,
  guild,
  expiresIn,
}: {
  isEditor: boolean;
  token: any;
  expired: boolean;
  guild: string;
  expiresIn: string;
}) {
  const t = useTranslations();
  if (isEditor) return null;
  if (token && !expired)
    return (
      <Alert>
        <AlertDescription>
          {t("component.form.placeholder.editingAs", { user: token.user, guild, expiresIn })}
        </AlertDescription>
      </Alert>
    );
  return (
    <Alert variant="destructive">
      <AlertDescription>{t("component.form.placeholder.notEditor")}</AlertDescription>
    </Alert>
  );
}

function ExistingPlaceholderPicker({
  id,
  onIdChange,
  onLoad,
}: {
  id: string;
  onIdChange: (id: string) => void;
  onLoad: (id: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel>{t("component.form.placeholder.placeholderId")}</FieldLabel>
        <div className="flex gap-2">
          <Input
            value={id}
            onChange={(e) => onIdChange(e.target.value)}
            placeholder={t("component.form.placeholder.placeholderIdInput")}
          />
          <Button variant="secondary" onClick={() => onLoad(id)}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </Field>
      {!id ? (
        <VideoSelector
          onVideoClicked={(video: any) => {
            onIdChange(video.id);
            onLoad(video.id);
          }}
        />
      ) : null}
    </div>
  );
}

// The placeholder's editable fields, plus loading an existing placeholder into them.
function usePlaceholderForm(defaultCreditName: string) {
  const [channel, setChannel] = useState<any>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoTitleJP, setVideoTitleJP] = useState("");
  const [creditName, setCreditName] = useState(defaultCreditName);
  const [sourceUrl, setSourceUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [placeholderType, setPlaceholderType] = useState("");
  const [certainty, setCertainty] = useState("");
  const [liveDate, setLiveDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [liveTime, setLiveTime] = useState("");
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [duration, setDuration] = useState(60);

  function changeDate(amount: number, unit: "hour" | "day") {
    if (unit === "hour")
      setLiveTime(
        dayjs(`${liveDate} ${liveTime || "00:00"}`)
          .add(amount, unit)
          .format("HH:mm"),
      );
    else
      setLiveDate(
        dayjs(liveDate || dayjs().format("YYYY-MM-DD"))
          .add(amount, unit)
          .format("YYYY-MM-DD"),
      );
  }

  function applyPlaceholder(video: any) {
    setVideoTitle(video.title || "");
    setVideoTitleJP(video.jp_name || "");
    setSourceUrl(video.link || "");
    setThumbnail(video.thumbnail || "");
    setPlaceholderType(video.placeholderType || "");
    const vt = dayjs(video.start_scheduled).tz("Asia/Tokyo");
    setTimezone("Asia/Tokyo");
    setLiveDate(vt.format("YYYY-MM-DD"));
    setLiveTime(vt.format("HH:mm"));
    setDuration(video.duration / 60);
    setCertainty(video.certainty || "");
    setChannel(video.channel);
  }

  return {
    channel,
    setChannel,
    videoTitle,
    setVideoTitle,
    videoTitleJP,
    setVideoTitleJP,
    creditName,
    setCreditName,
    sourceUrl,
    setSourceUrl,
    thumbnail,
    setThumbnail,
    placeholderType,
    setPlaceholderType,
    certainty,
    setCertainty,
    liveDate,
    setLiveDate,
    liveTime,
    setLiveTime,
    timezone,
    setTimezone,
    duration,
    setDuration,
    changeDate,
    applyPlaceholder,
  };
}

type PlaceholderForm = ReturnType<typeof usePlaceholderForm>;

function CreditNameField({ form, error }: { form: PlaceholderForm; error: string }) {
  const t = useTranslations();
  return (
    <FormField
      label={t("component.form.placeholder.editorCreditName")}
      error={error}
      description={t("component.form.placeholder.editorCreditHint")}
    >
      <Input value={form.creditName} onChange={(e) => form.setCreditName(e.target.value)} />
    </FormField>
  );
}

function DetailsFields({
  form,
  validation,
}: {
  form: PlaceholderForm;
  validation: Record<string, string>;
}) {
  const t = useTranslations();
  const placeholderTypes = [
    { text: t("component.videoCard.typeScheduledYT"), value: "scheduled-yt-stream" },
    { text: t("component.videoCard.typeExternalStream"), value: "external-stream" },
    { text: t("component.videoCard.typeEventPlaceholder"), value: "event" },
  ];
  const certaintyChoices = [
    { text: t("component.form.certainty.certain"), value: "certain" },
    { text: t("component.form.certainty.likely"), value: "likely" },
  ];
  return (
    <>
      <FormField label={t("component.form.channel")} error={validation.channel}>
        <ChannelAutocomplete
          value={form.channel}
          onChange={form.setChannel}
          label={t("component.form.channel")}
        />
      </FormField>
      <FormField label={t("component.form.placeholder.videoTitle")} error={validation.videoTitle}>
        <Input value={form.videoTitle} onChange={(e) => form.setVideoTitle(e.target.value)} />
      </FormField>
      <FormField label={t("component.form.placeholder.japaneseVideoTitle")}>
        <Input value={form.videoTitleJP} onChange={(e) => form.setVideoTitleJP(e.target.value)} />
      </FormField>
      <FormField
        label={t("component.form.placeholder.sourceLink")}
        error={validation.sourceUrl}
        description={t("component.form.placeholder.sourceLinkHint")}
      >
        <Input
          value={form.sourceUrl}
          onChange={(e) => form.setSourceUrl(e.target.value)}
          type="url"
          placeholder={t("component.form.placeholder.sourceLinkPlaceholder")}
        />
      </FormField>
      <FormField
        label={t("component.form.placeholder.thumbnailImage")}
        error={validation.thumbnail}
      >
        <Input
          value={form.thumbnail}
          onChange={(e) => form.setThumbnail(e.target.value)}
          type="url"
          placeholder={t("component.form.placeholder.thumbnailPlaceholder")}
        />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label={t("component.form.placeholder.eventType")}
          error={validation.placeholderType}
        >
          <OptionSelect
            value={form.placeholderType}
            onChange={form.setPlaceholderType}
            options={placeholderTypes}
          />
        </FormField>
        <FormField label={t("component.form.placeholder.certainty")} error={validation.certainty}>
          <OptionSelect
            value={form.certainty}
            onChange={form.setCertainty}
            options={certaintyChoices}
          />
        </FormField>
      </div>
    </>
  );
}

function ScheduleFields({
  form,
  validation,
}: {
  form: PlaceholderForm;
  validation: Record<string, string>;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <FormField label={t("component.form.placeholder.timezone")}>
        <OptionSelect value={form.timezone} onChange={form.setTimezone} options={TIMEZONES} />
      </FormField>
      <FormField
        label={t("component.form.placeholder.date")}
        error={validation.liveDate}
        description="YYYY-MM-DD"
      >
        <StepperInput
          value={form.liveDate}
          onChange={form.setLiveDate}
          type="date"
          onStep={(n) => form.changeDate(n, "day")}
        />
      </FormField>
      <FormField label={t("component.form.placeholder.time")} error={validation.liveTime}>
        <StepperInput
          value={form.liveTime}
          onChange={form.setLiveTime}
          type="time"
          onStep={(n) => form.changeDate(n, "hour")}
        />
      </FormField>
      <FormField
        label={t("component.form.placeholder.duration")}
        error={validation.duration}
        description={t("component.form.placeholder.durationHint")}
      >
        <Input
          value={form.duration}
          onChange={(e) => form.setDuration(Number(e.target.value))}
          type="number"
          min={1}
        />
      </FormField>
    </div>
  );
}

function AddPlaceholder() {
  const app = useAppState();
  const t = useTranslations();
  const search = useSearchParams();
  const [tab, setTab] = useState(0);
  const [id, setId] = useState("");
  const form = usePlaceholderForm(app.userdata?.user?.username || "");
  const [discordCredits, setDiscordCredits] = useState<any>(null);
  const tokenRaw = search.get("token") || undefined;
  const token = useMemo(() => decodeToken(tokenRaw), [tokenRaw]);
  const isEditor = ["editor", "admin"].includes(app.userdata?.user?.role);
  const expired = !token?.exp || dayjs().isAfter(dayjs(token.exp * 1000));
  const expiresIn = token?.exp
    ? formatRelativeTime(dayjs(token.exp * 1000), app.settings.lang)
    : t("component.form.never");
  const { liveDate, liveTime, timezone } = form;
  const availableAt = useMemo(
    () => toAvailableAt(liveDate, liveTime, timezone),
    [liveDate, liveTime, timezone],
  );
  const credits = placeholderCredits(isEditor, form.creditName, app.userdata.user?.id, token);
  const videoObj = previewVideo({ ...form, availableAt, credits });
  const validation = placeholderValidation({ ...form, isEditor, availableAt }, t);
  const formValid = Object.values(validation).every((v) => !v);
  const applyLoaded = useEffectEvent((data: any) => form.applyPlaceholder(data));
  useEffect(() => {
    if (token?.link)
      api
        .discordServerInfo(token.link)
        .then((data) => setDiscordCredits(data))
        .catch(() => {});
  }, [token?.link]);
  useEffect(() => {
    const queryId = search.get("id");
    if (!queryId || !isEditor) return;
    let cancelled = false;
    setId(queryId);
    setTab(1);
    api
      .video(queryId, undefined, 0)
      .then(({ data }: any) => {
        if (!cancelled) applyLoaded(data);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [search, isEditor]);
  async function loadExistingPlaceholder(phId: string) {
    if (!phId) return;
    form.applyPlaceholder((await api.video(phId, undefined, 0)).data);
  }
  async function onSubmit() {
    if (!formValid || !(isEditor || (token && !expired))) {
      toast.error(t("component.form.placeholder.authError"));
      return;
    }
    const titlePayload: any = {
      name: form.videoTitle,
      ...(form.videoTitleJP && { jp_name: form.videoTitleJP }),
      link: form.sourceUrl,
      ...(form.thumbnail && { thumbnail: form.thumbnail }),
      placeholderType: form.placeholderType,
      certainty: form.certainty,
      credits,
    };
    const body: any = {
      channel_id: form.channel.id,
      title: titlePayload,
      liveTime: availableAt,
      duration: Number(form.duration) * 60,
      id: undefined,
    };
    if (id) body.id = id;
    try {
      await api.addPlaceholderStream(body, app.userdata?.jwt, tokenRaw);
      toast.success(t("component.form.placeholder.success"));
    } catch (e: any) {
      toast.error(String(e) || t("component.form.error"));
    }
  }
  return (
    <section className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-10 pt-(--nav-total-height,120px) sm:px-5 space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary">{t("component.form.placeholder.editorBadge")}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("component.form.placeholder.title")}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("component.form.placeholder.description")}
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <VideoCard video={videoObj} includeChannel />
        </div>
        <div className="space-y-4">
          <EditorAccessAlert
            isEditor={isEditor}
            token={token}
            expired={expired}
            guild={discordCredits?.data?.guild?.name || ""}
            expiresIn={expiresIn}
          />
          <Card className="p-6">
            <ToggleGroup
              value={[String(tab)]}
              onValueChange={(value) => {
                if (!value[0]) return;
                const next = Number(value[0]);
                setTab(next);
                // The "new placeholder" tab never edits an existing id.
                if (next === 0) setId("");
              }}
              className="flex-wrap justify-start"
            >
              <ToggleGroupItem value="0">
                <SquarePlus className="h-4 w-4" />
                {t("component.form.new")}
              </ToggleGroupItem>
              <ToggleGroupItem value="1">
                <Pencil className="h-4 w-4" />
                {t("component.form.existing")}
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="mt-6 space-y-5">
              {isEditor ? <CreditNameField form={form} error={validation.creditName} /> : null}
              {tab === 1 ? (
                <ExistingPlaceholderPicker
                  id={id}
                  onIdChange={setId}
                  onLoad={(phId) => void loadExistingPlaceholder(phId)}
                />
              ) : null}
              <DetailsFields form={form} validation={validation} />
              <ScheduleFields form={form} validation={validation} />
              <Button onClick={onSubmit}>
                {id
                  ? t("component.form.placeholder.submitModification")
                  : t("component.form.placeholder.create")}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
