"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import debounce from "lodash-es/debounce";
import { toast } from "sonner";
import { ALL_VTUBERS_ORG, CHANNEL_TYPES } from "@/lib/consts";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { filterVideo } from "@/lib/filter-videos";
import { fetchTopicOptions } from "@/lib/topics";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { VideoListFilters } from "@/components/nav/MainNav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { channelDisplayName } from "@/lib/video-format";
import * as icons from "@/lib/icons";

export function ReportDialog() {
  const app = useAppState();
  const t = useTranslations();
  const pathname = usePathname();
  const video = app.reportVideo;
  const [reasons, setReasons] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [error, setError] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [topics, setTopics] = useState<any[]>([]);
  const [sugTopic, setSugTopic] = useState<string | false>(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [origMentions, setOrigMentions] = useState<any[]>([]);
  const [sugMentions, setSugMentions] = useState<any[] | null>(null);
  const [delSet, setDelSet] = useState<Set<string>>(new Set());
  const isHome = pathname === "/";
  const isCollab = video ? !filterVideo(video, app, { forOrg: app.currentOrg.name, hideCollabs: true }) : false;
  const collabsHidden = app.settings.hideCollabStreams;
  const allSelected = !!sugMentions?.length && delSet.size === sugMentions.length;
  const { useEnglishName } = app.settings;
  const vidChId = video?.channel?.id;

  const reasonList = useMemo(() => {
    const vt = video?.type === "stream" ? "video" : video?.type;
    return [
      { text: t("component.reportDialog.reasons.4"), value: "Incorrect video topic", types: ["stream", "placeholder"], orgReq: false },
      { text: t("component.reportDialog.reasons.5"), value: "Incorrect channel mentions", types: null, orgReq: false },
      { text: t("component.reportDialog.reasons.6", { arg0: vt, arg1: app.currentOrg.name }), value: "This video does not belong to the org", types: null, orgReq: true },
      { text: t("component.reportDialog.reasons.1"), value: "Low Quality/Misleading Content", types: ["clip"], orgReq: false },
      { text: t("component.reportDialog.reasons.2"), value: "Violates the org's derivative work guidelines or inappropriate", types: ["clip"], orgReq: false },
      { text: t("component.reportDialog.reasons.3"), value: "Other", types: null, orgReq: false },
    ];
  }, [video?.type, app.currentOrg.name, t]);

  const filteredReasons = reasonList.filter((r) => {
    if (!video) return false;
    if (r.orgReq && ((!app.currentOrg || app.currentOrg.name === ALL_VTUBERS_ORG || app.currentOrg.name === video.channel?.org) || !isHome)) return false;
    if (r.types && !r.types.includes(video.type)) return false;
    return true;
  });

  const mentionOptions = useMemo(() => results.map((i) => i.id), [results]);
  const mentionById = useMemo(() => new Map(results.map((i) => [i.id, i])), [results]);
  const mentionLabels = useMemo(() => new Map(results.map((i) => [i.id, channelDisplayName(i, useEnglishName)])), [results, useEnglishName]);

  const debouncedSearch = useMemo(() => debounce((v: string) => {
    if (!v) { setResults([]); return; }
    api.searchChannel({ type: CHANNEL_TYPES.VTUBER, queryText: v }).then(({ data }: any) => {
      setResults(data.filter((d: any) => !(vidChId === d.id || sugMentions?.find((m) => m.id === d.id))));
    }).catch(console.error);
  }, 400), [vidChId, sugMentions]);

  useEffect(() => { debouncedSearch(search); return () => debouncedSearch.cancel(); }, [search, debouncedSearch]);

  function close() {
    app.setReportVideo(null);
    setSugTopic(false); setSugMentions(null); setSearch(""); setResults([]);
    setReasons([]); setComments(""); setDelSet(new Set());
  }

  function toggleReason(v: string, checked: boolean) {
    setReasons((p) => checked ? [...new Set([...p, v])] : p.filter((i) => i !== v));
    if (v.includes("mention") && sugMentions === null) loadMentions();
  }

  async function loadTopics() {
    if (topics.length) return;
    setTopics(await fetchTopicOptions());
  }

  function loadMentions() {
    if (!video || sugMentions !== null) return;
    api.getMentions(video.id).then(({ data }: any) => { setOrigMentions(data); setSugMentions(data); }).catch(console.error);
  }

  function deleteMention(ch: any) {
    setSugMentions((p) => (p || []).filter((m) => m.id !== ch.id));
    setDelSet((p) => { const n = new Set(p); n.delete(ch.id); return n; });
  }

  function addMention(ch: any) {
    setSugMentions((p) => p?.find((m) => m.id === ch.id) ? p : [...(p || []), ch]);
    setResults([]); setSearch("");
  }

  const addToDelSet = (id: string) => setDelSet((p) => new Set(p).add(id));
  const removeFromDelSet = (id: string) => setDelSet((p) => { const n = new Set(p); n.delete(id); return n; });
  const toggleSelectAll = () => setDelSet((p) =>
    p.size === sugMentions?.length ? new Set() : new Set((sugMentions || []).map((m) => m.id)));

  function applyDelete() {
    const ids = [...delSet];
    if (!ids.length) return;
    setSugMentions((p) => (p || []).filter((m) => !ids.includes(m.id)));
    setDelSet(new Set()); setResults([]); setSearch("");
  }

  function sendReport() {
    if (!video) return;
    const r = reasons.join("\n");
    const body: any[] = [{ name: "Reason", value: r }];
    if (sugTopic !== false || r.includes("topic")) {
      body.push({ name: "Original Topic", value: video.topic_id ? `\`${video.topic_id}\`` : "None" });
      if (video.topic_id !== sugTopic) body.push({ name: "Suggested Topic", value: sugTopic ? `\`${sugTopic}\`` : "None" });
    }
    if (sugMentions !== null || r.includes("mentions")) {
      body.push({ name: "Original Mentions", value: origMentions.length ? origMentions.map((m) => `\`${m.id}\``).join("\n") : "None" });
      if (sugMentions !== null && sugMentions !== origMentions) body.push({ name: "Suggested Mentions", value: sugMentions.length ? sugMentions.map((m) => `\`${m.id}\``).join("\n") : "None" });
    }
    body.push({ name: "Comments", value: comments || "No comment" });
    api.reportVideo(video.id, body, app.userdata?.jwt || "")
      .then(() => { close(); toast.success(t("component.reportDialog.success")); setError(false); })
      .catch((e) => { console.error(e); setError(true); });
  }

  const mentionOverlay = (item: any) => (
    <div className="absolute inset-0 flex items-center justify-center">
      {delSet.has(item.id) ? (
        <Button type="button" size="icon" variant="destructive" onClick={(e) => { e.stopPropagation(); removeFromDelSet(item.id); }}>
          <icons.Trash2 className="size-5" />
        </Button>
      ) : (
        <Button type="button" variant="ghost" className="absolute inset-0 h-full w-full rounded-full p-0" onClick={(e) => { e.stopPropagation(); addToDelSet(item.id); }} />
      )}
    </div>
  );

  return (
    <div>
      <Dialog open={!!video} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-w-[500px]">
          {video ? (
            <div className="space-y-4">
              <DialogTitle>{t("component.reportDialog.title")}</DialogTitle>
              {error ? <Alert variant="destructive"><AlertDescription>{t("component.form.error")}</AlertDescription></Alert> : null}
              {isCollab ? <Alert><AlertDescription>{t("component.reportDialog.collabing", { org: app.currentOrg.name })}</AlertDescription></Alert> : null}
              <div className="text-sm text-foreground">
                <div>{video.title}</div>
                <div className="text-muted-foreground">{video.channel?.name}</div>
              </div>
              <div className="space-y-2">
                {filteredReasons.map((r) => (
                  <Label key={r.value} className="items-start rounded-md border p-3 text-sm">
                    <Checkbox checked={reasons.includes(r.value)} onCheckedChange={(c) => toggleReason(r.value, c === true)} />
                    <span>{r.text}</span>
                  </Label>
                ))}
              </div>
              {reasons.includes("Incorrect video topic") ? (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {t("component.search.type.topic")}
                    <span className="ml-2 text-primary">{video?.topic_id || t("component.form.none")}</span>
                  </div>
                  <Select value={sugTopic || "__unset__"} onOpenChange={(o) => { if (o) void loadTopics(); }} onValueChange={(v) => setSugTopic(v === "__unset__" ? false : v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">{t("component.reportDialog.topicUnsetPlaceholder")}</SelectItem>
                      {topics.map((tp) => <SelectItem key={tp.value} value={tp.value}>{tp.text}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {reasons.includes("Incorrect channel mentions") ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={applyDelete}>
                      <icons.SaveAll className="size-5" />{t("component.reportDialog.applyChanges")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={toggleSelectAll}>
                      {allSelected ? <icons.Square className="size-5" /> : <icons.CheckSquare className="size-5" />}
                      {allSelected ? t("component.reportDialog.deselectAll") : t("component.reportDialog.selectAll")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(sugMentions || []).map((item) => (
                      <ChannelChip key={item.id} channel={item} size={60} closeDelay={0}>{() => mentionOverlay(item)}</ChannelChip>
                    ))}
                  </div>
                  <Combobox items={mentionOptions} value="" inputValue={search} filter={null}
                    itemToStringLabel={(i) => mentionLabels.get(i) || i}
                    onInputValueChange={setSearch}
                    onValueChange={(id) => { const c = mentionById.get(id); if (c) addMention(c); }}>
                    <ComboboxInput placeholder={t("component.reportDialog.adjustMentionedChannels")} showClear={!!search} />
                    <ComboboxContent>
                      <ComboboxEmpty>{search.trim().length < 2 ? t("component.search.typeTwoCharacters") : t("component.search.noChannelsFound")}</ComboboxEmpty>
                      <ComboboxList>{(item: string, i: number) => <ComboboxItem key={item} value={item} index={i}>{mentionLabels.get(item) || item}</ComboboxItem>}</ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <div className="flex flex-wrap gap-2">
                    {(sugMentions || []).map((s) => (
                      <div key={`${s.id}chip`} className="flex items-center gap-2 rounded-full border px-3 py-1.5">
                        <ChannelChip channel={s} size={40} />
                        <Button type="button" variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); deleteMention(s); }}><icons.XIcon className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {reasons.includes("This video does not belong to the org") && !collabsHidden && video?.type !== "clip" ? (
                <div className="space-y-2">
                  <div className="text-sm text-primary">{t("component.reportDialog.consider")}</div>
                  <VideoListFilters placeholderFilter={false} topicFilter={false} missingFilter={false} upcomingFilter={false} />
                </div>
              ) : null}
              {video?.channel?.id === "UCF4-I8ZQL6Aa-iHfdz-B9KQ" ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    <b>{t("component.reportDialog.specificChannelWarningTitle")}</b>
                    {readMore ? (
                      <div className="mt-2 space-y-2">
                        <p>{t("component.reportDialog.specificChannelWarningBody1")}</p>
                        <p>{t("component.reportDialog.specificChannelWarningBody2")}</p>
                        <p>{t("component.reportDialog.specificChannelWarningBody3")}</p>
                      </div>
                    ) : <Button type="button" variant="link" className="mt-2 h-auto p-0 underline" onClick={() => setReadMore(true)}>{t("component.comment.readMore")}</Button>}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label>{t("component.reportDialog.comments")}</Label>
                <Textarea value={comments} className="min-h-32" onChange={(e) => setComments(e.target.value)} />
                <div className="text-xs text-muted-foreground">{t("component.reportDialog.commentLanguagesOk")}</div>
              </div>
              <Separator />
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ChannelSocials channel={video.channel} showDelete hideYt vertical className="inline-block" />
                <icons.ArrowLeft className="h-4 w-4" />
                <span>{t("component.channelSocials.block")}</span>
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={close}>{t("views.app.close_btn")}</Button>
                <Button type="button" className="ml-auto" disabled={!comments.length} onClick={sendReport}>{t("views.multiview.confirmOverwriteYes")}</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
