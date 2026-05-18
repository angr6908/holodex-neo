"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChannelAutocomplete } from "@/components/channel/ChannelAutocomplete";
import * as icons from "@/lib/icons";

const ADD_VTUBER = "Add a Vtuber ▶️ for Holodex to track the channel and clips.";
const ADD_CLIPPER = "I'd like to ➕ add a clipping/subbing channel to Holodex.";
const MODIFY_EXISTING = "I'd like to modify existing channel";
const DELETE = "I'd like to delete my channel";

const languages = [
  { text: "English", value: "en" }, { text: "日本語", value: "ja" }, { text: "中文", value: "zh" }, { text: "한국어", value: "ko" }, { text: "Español", value: "es" },
  { text: "Français", value: "fr" }, { text: "ไทย (Thai)", value: "th" }, { text: "Bahasa", value: "id" }, { text: "Русский язык", value: "ru" }, { text: "Tiếng Việt", value: "vi" },
];
export default function AddChannelPage() {
  const t = useTranslations();
  const router = useRouter();
  const [link, setLink] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [type, setType] = useState("");
  const [lang, setLang] = useState("");
  const [twitter, setTwitter] = useState("");
  const [contact, setContact] = useState("");
  const [comments, setComments] = useState("");
  const [org, setOrg] = useState("");
  const [channel, setChannel] = useState<any>({});
  const channelTypes = [
    { text: t("channelRequest.Types.AddVtuber"), value: ADD_VTUBER },
    { text: t("channelRequest.Types.AddClipper"), value: ADD_CLIPPER },
    { text: t("channelRequest.Types.ModifyExistingInfo"), value: MODIFY_EXISTING },
    { text: t("channelRequest.Types.DeleteChannel"), value: DELETE },
  ];
  useEffect(() => {
    setLink("");
    setChannel({});
    setEnglishName("");
    setLang("");
    setTwitter("");
    setContact("");
    setComments("");
    setOrg("");
  }, [type]);
  function channelURLRule(v: string) {
    const cid = v.match(/(?:https?:\/\/)(?:www\.)?youtu(?:be\.com\/)(?:channel\/|@)([\w-.]*)$/i);
    return (cid && !cid[0].includes("/c/") && (cid[1].length > 12 || cid[0].includes("@")) && cid[0].startsWith("ht"))
      || t("channelRequest.ChannelURLErrorFeedback");
  }
  function twitterRule(v: string) {
    return !v || /^@.*$/.test(v) || "@ABC";
  }
  const linkRule = channelURLRule(link);
  const twitterRuleResult = twitterRule(twitter);
  const linkError = !link || type === MODIFY_EXISTING || type === DELETE ? "" : linkRule === true ? "" : String(linkRule);
  const twitterError = !twitter ? "" : twitterRuleResult === true ? "" : String(twitterRuleResult);
  const contactError = type !== DELETE || contact ? "" : t("component.form.required");
  const langError = !(type === ADD_CLIPPER || type === MODIFY_EXISTING) || lang ? "" : t("component.form.required");
  function alertText(tType: string) { switch (tType) { case ADD_VTUBER: return t.raw("channelRequest.VtuberRequirementText"); case ADD_CLIPPER: return t.raw("channelRequest.ClipperRequirementText"); case DELETE: return t("channelRequest.DeletionRequirementText"); default: return false; } }
  function isFormValid() { if (!type) return false; if ((type === ADD_VTUBER || type === ADD_CLIPPER) && linkRule !== true) return false; if ((type === ADD_CLIPPER || type === MODIFY_EXISTING) && !lang) return false; if (type === DELETE && !contact) return false; if (twitterRuleResult !== true) return false; if ((type === MODIFY_EXISTING || type === DELETE) && !channel?.id) return false; return true; }
  async function onSubmit() {
    if (type === ADD_VTUBER || type === ADD_CLIPPER) {
      const matches = [...link.matchAll(/(?:https?:\/\/)(?:www\.)?youtu(?:be\.com\/)(?:channel\/|@)([\w\-_]*)/gi)];
      let id = matches?.[0]?.[1];
      const handle = link.includes("@");
      id = handle ? `@${id?.toLowerCase()}` : id;
      try {
        const exists = id && (await api.channel(id));
        if (exists?.data?.id) {
          router.push(`/channel/${exists.data.id}`);
          return;
        }
      } catch {}
    }
    if (!isFormValid()) {
      toast.error(t("component.form.error"));
      return;
    }
    const fields: any[] = [
      { name: "Request Type", value: type, inline: false },
      { name: "Channel Link", value: link || `https://www.youtube.com/channel/${channel.id}`, inline: false },
    ];
    if (englishName) fields.push({ name: "Alternate Channel Name (optional)", value: englishName, inline: false });
    if (lang) fields.push({ name: "What language is your channel?", value: lang, inline: false });
    if (twitter) fields.push({ name: "Twitter Handle (optional)", value: twitter, inline: false });
    if (contact) fields.push({ name: "Direct contact", value: contact, inline: false });
    if (org || comments) fields.push({ name: "Comments", value: `[${org}] ${comments}`, inline: false });
    try {
      await api.requestChannel({ content: "‌Look what the cat dragged in...", embeds: [{ title: "Holodex New Subber Request", color: 1955806, fields, footer: { text: "Holodex UI" } }] });
      toast.success(t("component.form.ok"));
      setLink("");
      setChannel({});
      setEnglishName("");
      setLang("");
      setTwitter("");
      setContact("");
      setComments("");
      setOrg("");
    } catch (e: any) {
      const message = e?.response && typeof e.response.data === "string" ? e.response.data : String(e);
      toast.error(message || t("component.form.error"));
    }
  }
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-10 pt-[var(--nav-total-height,120px)] sm:px-5 max-w-5xl">
      <div className="mx-auto w-full md:max-w-[83.333%] lg:max-w-[66.666%]">
        <Card className="p-6">
          <div className="text-2xl font-semibold">{t("channelRequest.PageTitle")}</div>
          {type && alertText(type) ? <Alert className="mt-4"><AlertDescription><p dangerouslySetInnerHTML={{ __html: String(alertText(type)) }} /></AlertDescription></Alert> : null}
          <div className="mt-6 space-y-6">
            <FieldSet className="gap-0">
              <FieldLegend variant="label">{t("channelRequest.RequestType")}</FieldLegend>
              <RadioGroup value={type} onValueChange={setType}>{channelTypes.map((ct) => <Label key={ct.value} className="items-start rounded-md border p-3 text-sm"><RadioGroupItem value={ct.value} /><span>{ct.text}</span></Label>)}</RadioGroup>
            </FieldSet>
            {type === MODIFY_EXISTING || type === DELETE ? <div><ChannelAutocomplete value={channel} onChange={setChannel} label={t("component.form.channel")} /></div> : <Field data-invalid={!!linkError}><FieldLabel>{t("channelRequest.ChannelURLLabel")}</FieldLabel><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder={t("channelRequest.ChannelURLPlaceholder")} /><FieldDescription>{t("channelRequest.ChannelURLExample")}</FieldDescription>{linkError ? <FieldError>{linkError}</FieldError> : null}</Field>}
            {type !== DELETE && type !== ADD_CLIPPER ? <Field><FieldLabel>{t("channelRequest.EnglishNameLabel")}</FieldLabel><Input value={englishName} onChange={(e) => setEnglishName(e.target.value)} /><FieldDescription>{t("channelRequest.EnglishNameHint")}</FieldDescription></Field> : null}
            {!(type === ADD_VTUBER || type === DELETE) ? <Field data-invalid={!!langError}><FieldLabel>{t("channelRequest.ChannelLanguageLabel")}</FieldLabel><Select value={lang || "__none__"} onValueChange={(value) => setLang(value === "__none__" ? "" : value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">{t("channelRequest.SelectLanguage")}</SelectItem>{languages.map((item) => <SelectItem key={item.value} value={item.value}>{item.text}</SelectItem>)}</SelectContent></Select>{langError ? <FieldError>{langError}</FieldError> : null}</Field> : null}
            {type === ADD_VTUBER || type === MODIFY_EXISTING ? <Field><FieldLabel>{t("channelRequest.VtuberGroupLabel")}</FieldLabel><Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder={t("channelRequest.VtuberGroupPlaceholder")} /><FieldDescription>{t("channelRequest.VtuberGroupHint")}</FieldDescription></Field> : null}
            {type !== DELETE ? <Field data-invalid={!!twitterError}><FieldLabel>{t("channelRequest.TwitterHandle")}</FieldLabel><Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder={t("channelRequest.TwitterPlaceholder")} /><FieldDescription>{t("channelRequest.TwitterExample")}</FieldDescription>{twitterError ? <FieldError>{twitterError}</FieldError> : null}</Field> : null}
            <Field data-invalid={!!contactError}><FieldLabel>{t("channelRequest.DirectContactLabel")}</FieldLabel><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t("channelRequest.DirectContactPlaceholder")} /><FieldDescription>{t("channelRequest.DirectContactDisclaimer")}</FieldDescription>{contactError ? <FieldError>{contactError}</FieldError> : null}</Field>
            <Field><FieldLabel>{t("channelRequest.Comments")}</FieldLabel><Textarea value={comments} onChange={(e) => setComments(e.target.value)} className="min-h-28" /><FieldDescription>{t("channelRequest.CommentsHint")}</FieldDescription></Field>
            <Button type="button" className="mt-2" onClick={onSubmit}><icons.Check className="size-5" />{t("component.form.submit")}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
