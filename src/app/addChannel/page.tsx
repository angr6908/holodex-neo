"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ChannelAutocomplete } from "@/components/channel/ChannelAutocomplete";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import * as icons from "@/lib/icons";

const ADD_VTUBER = "Add a Vtuber ▶️ for Holodex to track the channel and clips.";
const ADD_CLIPPER = "I'd like to ➕ add a clipping/subbing channel to Holodex.";
const MODIFY_EXISTING = "I'd like to modify existing channel";
const DELETE = "I'd like to delete my channel";

const languages = [
  { text: "English", value: "en" },
  { text: "日本語", value: "ja" },
  { text: "中文", value: "zh" },
  { text: "한국어", value: "ko" },
  { text: "Español", value: "es" },
  { text: "Français", value: "fr" },
  { text: "ไทย (Thai)", value: "th" },
  { text: "Bahasa", value: "id" },
  { text: "Русский язык", value: "ru" },
  { text: "Tiếng Việt", value: "vi" },
];
type RequestForm = {
  type: string;
  link: string;
  englishName: string;
  lang: string;
  twitter: string;
  contact: string;
  comments: string;
  org: string;
  channel: any;
};

const EMPTY_FIELDS = {
  link: "",
  englishName: "",
  lang: "",
  twitter: "",
  contact: "",
  comments: "",
  org: "",
  channel: {},
};

const isExistingChannelRequest = (type: string) => type === MODIFY_EXISTING || type === DELETE;
const isAddRequest = (type: string) => type === ADD_VTUBER || type === ADD_CLIPPER;
const needsLanguage = (type: string) => type === ADD_CLIPPER || type === MODIFY_EXISTING;

// A youtube.com/channel/<id> or youtube.com/@handle URL (legacy /c/ URLs can't be resolved).
function isChannelUrl(v: string) {
  const cid = v.match(/(?:https?:\/\/)(?:www\.)?youtu(?:be\.com\/)(?:channel\/|@)([\w-.]*)$/i);
  return !!(
    cid &&
    !cid[0].includes("/c/") &&
    (cid[1].length > 12 || cid[0].includes("@")) &&
    cid[0].startsWith("ht")
  );
}

const isTwitterHandle = (v: string) => !v || /^@.*$/.test(v);

function formErrors(form: RequestForm, t: ReturnType<typeof useTranslations>) {
  const { type, link, twitter, contact, lang } = form;
  const linkInvalid = !!link && !isExistingChannelRequest(type) && !isChannelUrl(link);
  return {
    link: linkInvalid ? t("channelRequest.ChannelURLErrorFeedback") : "",
    twitter: twitter && !isTwitterHandle(twitter) ? "@ABC" : "",
    contact: type !== DELETE || contact ? "" : t("component.form.required"),
    lang: !needsLanguage(type) || lang ? "" : t("component.form.required"),
  };
}

function isFormValid(form: RequestForm) {
  const { type } = form;
  if (!type) return false;
  if (isAddRequest(type) && !isChannelUrl(form.link)) return false;
  if (needsLanguage(type) && !form.lang) return false;
  if (type === DELETE && !form.contact) return false;
  if (!isTwitterHandle(form.twitter)) return false;
  if (isExistingChannelRequest(type) && !form.channel?.id) return false;
  return true;
}

// The request as Discord embed fields; optional ones only when filled in.
function requestFields(form: RequestForm) {
  const fields: any[] = [
    { name: "Request Type", value: form.type, inline: false },
    {
      name: "Channel Link",
      value: form.link || `https://www.youtube.com/channel/${form.channel.id}`,
      inline: false,
    },
  ];
  const optional: [string, string][] = [
    ["Alternate Channel Name (optional)", form.englishName],
    ["What language is your channel?", form.lang],
    ["Twitter Handle (optional)", form.twitter],
    ["Direct contact", form.contact],
  ];
  for (const [name, value] of optional) if (value) fields.push({ name, value, inline: false });
  if (form.org || form.comments)
    fields.push({ name: "Comments", value: `[${form.org}] ${form.comments}`, inline: false });
  return fields;
}

// Channel id (or lowercased @handle) from an add request's link, to check it isn't tracked yet.
function linkedChannelId(link: string) {
  const matches = [
    ...link.matchAll(/(?:https?:\/\/)(?:www\.)?youtu(?:be\.com\/)(?:channel\/|@)([\w\-_]*)/gi),
  ];
  const id = matches?.[0]?.[1];
  return link.includes("@") ? `@${id?.toLowerCase()}` : id;
}

function requirementText(type: string, t: ReturnType<typeof useTranslations>) {
  switch (type) {
    case ADD_VTUBER:
      return t.raw("channelRequest.VtuberRequirementText");
    case ADD_CLIPPER:
      return t.raw("channelRequest.ClipperRequirementText");
    case DELETE:
      return t("channelRequest.DeletionRequirementText");
    default:
      return false;
  }
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  description,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description: string;
  error?: string;
}) {
  return (
    // Fields without validation leave data-invalid off entirely.
    <Field data-invalid={error === undefined ? undefined : !!error}>
      <FieldLabel>{label}</FieldLabel>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <FieldDescription>{description}</FieldDescription>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

function LanguageField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string;
}) {
  const t = useTranslations();
  return (
    <Field data-invalid={!!error}>
      <FieldLabel>{t("channelRequest.ChannelLanguageLabel")}</FieldLabel>
      <Select
        value={value || "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t("channelRequest.SelectLanguage")}</SelectItem>
          {languages.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

function RequestTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  const channelTypes = [
    { text: t("channelRequest.Types.AddVtuber"), value: ADD_VTUBER },
    { text: t("channelRequest.Types.AddClipper"), value: ADD_CLIPPER },
    { text: t("channelRequest.Types.ModifyExistingInfo"), value: MODIFY_EXISTING },
    { text: t("channelRequest.Types.DeleteChannel"), value: DELETE },
  ];
  return (
    <FieldSet className="gap-0">
      <FieldLegend variant="label">{t("channelRequest.RequestType")}</FieldLegend>
      <RadioGroup value={value} onValueChange={onChange}>
        {channelTypes.map((ct) => (
          <Label key={ct.value} className="items-start rounded-md border p-3 text-sm">
            <RadioGroupItem value={ct.value} />
            <span>{ct.text}</span>
          </Label>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}

export default function AddChannelPage() {
  const t = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState<RequestForm>({ type: "", ...EMPTY_FIELDS });
  const { type } = form;
  const set = (key: keyof RequestForm) => (value: any) => setForm((f) => ({ ...f, [key]: value }));
  // Each request type has its own fields, so switching types starts them over.
  const setType = (value: string) =>
    setForm((f) => (f.type === value ? f : { type: value, ...EMPTY_FIELDS }));
  const errors = formErrors(form, t);
  const alert = type ? requirementText(type, t) : false;

  async function onSubmit() {
    if (isAddRequest(type)) {
      const id = linkedChannelId(form.link);
      try {
        const exists = id && (await api.channel(id));
        if (exists?.data?.id) {
          router.push(`/channel/${exists.data.id}`);
          return;
        }
      } catch {}
    }
    if (!isFormValid(form)) {
      toast.error(t("component.form.error"));
      return;
    }
    try {
      await api.requestChannel({
        content: "‌Look what the cat dragged in...",
        embeds: [
          {
            title: "Holodex New Subber Request",
            color: 1955806,
            fields: requestFields(form),
            footer: { text: "Holodex UI" },
          },
        ],
      });
      toast.success(t("component.form.ok"));
      setForm((f) => ({ type: f.type, ...EMPTY_FIELDS }));
    } catch (e: any) {
      const message =
        e?.response && typeof e.response.data === "string" ? e.response.data : String(e);
      toast.error(message || t("component.form.error"));
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-10 pt-(--nav-total-height,120px) sm:px-5 max-w-5xl">
      <div className="mx-auto w-full md:max-w-[83.333%] lg:max-w-[66.666%]">
        <Card className="p-6">
          <div className="text-2xl font-normal">{t("channelRequest.PageTitle")}</div>
          {alert ? (
            <Alert className="mt-4">
              <AlertDescription>
                <p dangerouslySetInnerHTML={{ __html: String(alert) }} />
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="mt-6 space-y-6">
            <RequestTypePicker value={type} onChange={setType} />
            {isExistingChannelRequest(type) ? (
              <div>
                <ChannelAutocomplete
                  value={form.channel}
                  onChange={set("channel")}
                  label={t("component.form.channel")}
                />
              </div>
            ) : (
              <TextField
                label={t("channelRequest.ChannelURLLabel")}
                value={form.link}
                onChange={set("link")}
                placeholder={t("channelRequest.ChannelURLPlaceholder")}
                description={t("channelRequest.ChannelURLExample")}
                error={errors.link}
              />
            )}
            {type !== DELETE && type !== ADD_CLIPPER ? (
              <TextField
                label={t("channelRequest.EnglishNameLabel")}
                value={form.englishName}
                onChange={set("englishName")}
                description={t("channelRequest.EnglishNameHint")}
              />
            ) : null}
            {!(type === ADD_VTUBER || type === DELETE) ? (
              <LanguageField value={form.lang} onChange={set("lang")} error={errors.lang} />
            ) : null}
            {type === ADD_VTUBER || type === MODIFY_EXISTING ? (
              <TextField
                label={t("channelRequest.VtuberGroupLabel")}
                value={form.org}
                onChange={set("org")}
                placeholder={t("channelRequest.VtuberGroupPlaceholder")}
                description={t("channelRequest.VtuberGroupHint")}
              />
            ) : null}
            {type !== DELETE ? (
              <TextField
                label={t("channelRequest.TwitterHandle")}
                value={form.twitter}
                onChange={set("twitter")}
                placeholder={t("channelRequest.TwitterPlaceholder")}
                description={t("channelRequest.TwitterExample")}
                error={errors.twitter}
              />
            ) : null}
            <TextField
              label={t("channelRequest.DirectContactLabel")}
              value={form.contact}
              onChange={set("contact")}
              placeholder={t("channelRequest.DirectContactPlaceholder")}
              description={t("channelRequest.DirectContactDisclaimer")}
              error={errors.contact}
            />
            <Field>
              <FieldLabel>{t("channelRequest.Comments")}</FieldLabel>
              <Textarea
                value={form.comments}
                onChange={(e) => set("comments")(e.target.value)}
                className="min-h-28"
              />
              <FieldDescription>{t("channelRequest.CommentsHint")}</FieldDescription>
            </Field>
            <Button type="button" className="mt-2" onClick={onSubmit}>
              <icons.Check className="size-5" />
              {t("component.form.submit")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
