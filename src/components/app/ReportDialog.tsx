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
import { ChannelChip } from "@/components/channel/ChannelChip";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { VideoListFilters } from "@/components/setting/VideoListFilters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [error, setError] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [topics, setTopics] = useState<any[]>([]);
  const [suggestedTopic, setSuggestedTopic] = useState<string | false>(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [originalMentions, setOriginalMentions] = useState<any[]>([]);
  const [suggestedMentions, setSuggestedMentions] = useState<any[] | null>(null);
  const [deletionSet, setDeletionSet] = useState<Set<string>>(new Set());
  const isHomeRoute = pathname === "/";
  const isCollab = video ? !filterVideo(video, app, { hideCollabs: true }) : false;
  const collabsAlreadyHidden = app.settings.hideCollabStreams;
  const isSelectedAll = !!suggestedMentions?.length && deletionSet.size === suggestedMentions.length;
  const { useEnglishName } = app.settings;
  const reportVideoChannelId = video?.channel?.id;

  const reasons = useMemo(() => {
    const vtype = video?.type === "stream" ? "video" : video?.type;
    return [
      { text: t("component.reportDialog.reasons.4"), value: "Incorrect video topic", types: ["stream", "placeholder"], orgRequired: false },
      { text: t("component.reportDialog.reasons.5"), value: "Incorrect channel mentions", types: null, orgRequired: false },
      { text: t("component.reportDialog.reasons.6", { arg0: vtype, arg1: app.currentOrg.name }), value: "This video does not belong to the org", types: null, orgRequired: true },
      { text: t("component.reportDialog.reasons.1"), value: "Low Quality/Misleading Content", types: ["clip"], orgRequired: false },
      { text: t("component.reportDialog.reasons.2"), value: "Violates the org's derivative work guidelines or inappropriate", types: ["clip"], orgRequired: false },
      { text: t("component.reportDialog.reasons.3"), value: "Other", types: null, orgRequired: false },
    ];
  }, [video?.type, app.currentOrg.name, t]);

  const filteredReasons = reasons.filter((reason) => {
    if (!video) return false;
    if (reason.orgRequired && ((!app.currentOrg || app.currentOrg.name === ALL_VTUBERS_ORG || app.currentOrg.name === video.channel?.org) || !isHomeRoute)) return false;
    if (reason.types && !reason.types.includes(video.type)) return false;
    return true;
  });

  const mentionOptions = useMemo(() => searchResults.map((item) => item.id), [searchResults]);
  const mentionById = useMemo(() => new Map(searchResults.map((item) => [item.id, item])), [searchResults]);
  const mentionLabels = useMemo(() => new Map(searchResults.map((item) => [item.id, channelDisplayName(item, useEnglishName)])), [searchResults, useEnglishName]);

  const debouncedSearch = useMemo(() => debounce((value: string) => {
    if (!value) { setSearchResults([]); return; }
    api.searchChannel({ type: CHANNEL_TYPES.VTUBER, queryText: value }).then(({ data }: any) => {
      setSearchResults(data.filter((d: any) => !(reportVideoChannelId === d.id || suggestedMentions?.find((m) => m.id === d.id))));
    }).catch(console.error);
  }, 400), [reportVideoChannelId, suggestedMentions]);

  useEffect(() => { debouncedSearch(search); return () => debouncedSearch.cancel(); }, [search, debouncedSearch]);

  function close() {
    app.setReportVideo(null);
    setSuggestedTopic(false);
    setSuggestedMentions(null);
    setSearch("");
    setSearchResults([]);
    setSelectedReasons([]);
    setComments("");
    setDeletionSet(new Set());
  }

  function toggleReason(value: string, checked: boolean) {
    setSelectedReasons((prev) => checked ? [...new Set([...prev, value])] : prev.filter((item) => item !== value));
    if (value.includes("mention") && suggestedMentions === null) loadMentions();
  }

  async function loadTopics() {
    if (topics.length > 0) return;
    const { data } = await api.topics();
    setTopics(data.map((topic: any) => ({ value: topic.id, text: `${topic.id} (${topic.count ?? 0})` })));
  }

  function loadMentions() {
    if (!video || suggestedMentions !== null) return;
    api
      .getMentions(video.id)
      .then(({ data }: any) => {
        setOriginalMentions(data);
        setSuggestedMentions(data);
      })
      .catch(console.error);
  }

  function deleteMention(channel: any) {
    setSuggestedMentions((prev) => (prev || []).filter((mention) => mention.id !== channel.id));
    setDeletionSet((prev) => {
      const next = new Set(prev);
      next.delete(channel.id);
      return next;
    });
  }

  function addMention(channel: any) {
    setSuggestedMentions((prev) => prev?.find((mention) => mention.id === channel.id) ? prev : [...(prev || []), channel]);
    setSearchResults([]);
    setSearch("");
  }

  function addMentionById(id: string) {
    const channel = mentionById.get(id);
    if (channel) addMention(channel);
  }

  const addChannelToDeletionSet = (id: string) => setDeletionSet((prev) => new Set(prev).add(id));
  const removeChannelFromDeletionSet = (id: string) => setDeletionSet((prev) => {
    const next = new Set(prev); next.delete(id); return next;
  });
  const toggleMentionSelection = () => setDeletionSet((prev) =>
    prev.size === suggestedMentions?.length ? new Set() : new Set((suggestedMentions || []).map((m) => m.id)));

  function applyDeleteMentions() {
    const ids = [...deletionSet];
    if (!ids.length) return;
    setSuggestedMentions((prev) => (prev || []).filter((m) => !ids.includes(m.id)));
    setDeletionSet(new Set());
    setSearchResults([]);
    setSearch("");
  }

  function sendReport() {
    if (!video) return;
    const reasonString = selectedReasons.join("\n");
    const fieldBody: any[] = [{ name: "Reason", value: reasonString }];
    if (suggestedTopic !== false || reasonString.includes("topic")) {
      fieldBody.push({ name: "Original Topic", value: video.topic_id ? `\`${video.topic_id}\`` : "None" });
      if (video.topic_id !== suggestedTopic) fieldBody.push({ name: "Suggested Topic", value: suggestedTopic ? `\`${suggestedTopic}\`` : "None" });
    }
    if (suggestedMentions !== null || reasonString.includes("mentions")) {
      fieldBody.push({ name: "Original Mentions", value: originalMentions.length ? originalMentions.map((m) => `\`${m.id}\``).join("\n") : "None" });
      if (suggestedMentions !== null && suggestedMentions !== originalMentions) fieldBody.push({ name: "Suggested Mentions", value: suggestedMentions.length ? suggestedMentions.map((m) => `\`${m.id}\``).join("\n") : "None" });
    }
    fieldBody.push({ name: "Comments", value: comments || "No comment" });
    api.reportVideo(video.id, fieldBody, app.userdata?.jwt || "").then(() => { close(); toast.success(t("component.reportDialog.success")); setError(false); }).catch((e) => { console.error(e); setError(true); });
  }

  function renderReasonList() {
    return (
      <div className="space-y-2">
        {filteredReasons.map((reason) => (
          <Label key={reason.value} className="items-start rounded-md border p-3 text-sm">
            <Checkbox
              checked={selectedReasons.includes(reason.value)}
              onCheckedChange={(checked) => toggleReason(reason.value, checked === true)}
            />
            <span>{reason.text}</span>
          </Label>
        ))}
      </div>
    );
  }

  function renderTopicEditor() {
    if (!selectedReasons.includes("Incorrect video topic")) return null;

    return (
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">
          {t("component.search.type.topic")}
          <span className="ml-2 text-[color:var(--color-primary)]">{video?.topic_id || t("component.form.none")}</span>
        </div>
        <Select
          value={suggestedTopic || "__unset__"}
          onOpenChange={(open) => { if (open) void loadTopics(); }}
          onValueChange={(value) => setSuggestedTopic(value === "__unset__" ? false : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">{t("component.reportDialog.topicUnsetPlaceholder")}</SelectItem>
            {topics.map((topic) => (
              <SelectItem key={topic.value} value={topic.value}>{topic.text}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  function renderMentionDeletionOverlay(item: any) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center ${deletionSet.has(item.id) ? "bg-slate-950/70" : "bg-transparent"}`}>
        {deletionSet.has(item.id) ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              removeChannelFromDeletionSet(item.id);
            }}
          >
            <icons.Trash2 className="size-5" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="absolute inset-0 h-full w-full rounded-full p-0 hover:bg-slate-950/40"
            onClick={(event) => {
              event.stopPropagation();
              addChannelToDeletionSet(item.id);
            }}
          />
        )}
      </div>
    );
  }

  function renderMentionEditor() {
    if (!selectedReasons.includes("Incorrect channel mentions")) return null;

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
	          <Button type="button" variant="outline" size="sm" onClick={applyDeleteMentions}>
	            <icons.SaveAll className="size-5" />
	            {t("component.reportDialog.applyChanges")}
	          </Button>
	          <Button type="button" variant="ghost" size="sm" onClick={toggleMentionSelection}>
	            {isSelectedAll ? <icons.Square className="size-5" /> : <icons.CheckSquare className="size-5" />}
	            {isSelectedAll ? t("component.reportDialog.deselectAll") : t("component.reportDialog.selectAll")}
	          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(suggestedMentions || []).map((item) => (
            <ChannelChip key={item.id} channel={item} size={60} closeDelay={0}>
              {() => renderMentionDeletionOverlay(item)}
            </ChannelChip>
          ))}
        </div>

        <Combobox
          items={mentionOptions}
          value=""
          inputValue={search}
          filter={null}
          itemToStringLabel={(item) => mentionLabels.get(item) || item}
          onInputValueChange={setSearch}
          onValueChange={addMentionById}
        >
	          <ComboboxInput placeholder={t("component.reportDialog.adjustMentionedChannels")} showClear={!!search} />
	          <ComboboxContent>
	            <ComboboxEmpty>{search.trim().length < 2 ? t("component.search.typeTwoCharacters") : t("component.search.noChannelsFound")}</ComboboxEmpty>
            <ComboboxList>
              {(item: string, index: number) => (
                <ComboboxItem key={item} value={item} index={index}>
                  {mentionLabels.get(item) || item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        <div className="flex flex-wrap gap-2">
          {(suggestedMentions || []).map((selection) => (
            <div key={`${selection.id}chip`} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5">
              <ChannelChip channel={selection} size={40} />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteMention(selection);
                }}
              >
                <icons.XIcon className="h-4 w-4 text-[color:var(--color-primary)]" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderOrgMismatchHint() {
    if (!selectedReasons.includes("This video does not belong to the org") || collabsAlreadyHidden || video?.type === "clip") return null;

    return (
      <div className="space-y-2">
        <div className="text-sm text-[color:var(--color-primary)]">{t("component.reportDialog.consider")}</div>
        <VideoListFilters placeholderFilter={false} topicFilter={false} missingFilter={false} upcomingFilter={false} />
      </div>
    );
  }

  function renderSpecificChannelWarning() {
    if (video?.channel?.id !== "UCF4-I8ZQL6Aa-iHfdz-B9KQ") return null;

    return (
      <Alert variant="destructive">
        <AlertDescription>
          <b>{t("component.reportDialog.specificChannelWarningTitle")}</b>
          {readMore ? (
            <div className="mt-2 space-y-2">
              <p>{t("component.reportDialog.specificChannelWarningBody1")}</p>
              <p>{t("component.reportDialog.specificChannelWarningBody2")}</p>
              <p>{t("component.reportDialog.specificChannelWarningBody3")}</p>
            </div>
          ) : (
            <Button type="button" variant="link" className="mt-2 h-auto p-0 underline" onClick={() => setReadMore(true)}>
              {t("component.comment.readMore")}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  function renderCommentsField() {
    return (
      <div className="space-y-2">
        <Label>{t("component.reportDialog.comments")}</Label>
        <Textarea value={comments} className="min-h-32" onChange={(event) => setComments(event.target.value)} />
        <div className="text-xs text-[color:var(--color-muted-foreground)]">{t("component.reportDialog.commentLanguagesOk")}</div>
      </div>
    );
  }

  function renderFooter() {
    return (
      <>
        <Separator />
        <div className="flex items-center gap-3 text-sm text-[color:var(--color-muted-foreground)]">
          <ChannelSocials channel={video.channel} showDelete hideYt vertical className="inline-block" />
          <icons.ArrowLeft className="h-4 w-4" />
          <span>{t("component.channelSocials.block")}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={close}>{t("views.app.close_btn")}</Button>
          <Button type="button" className="ml-auto" disabled={comments.length === 0} onClick={sendReport}>
            {t("views.multiview.confirmOverwriteYes")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <div>
      <Dialog open={!!video} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent className="max-w-[500px] p-0">
          {video ? (
            <Card className="border-0 p-0 shadow-none">
              <div className="space-y-4 p-5">
                <DialogTitle className="text-xl leading-normal font-semibold text-[color:var(--color-foreground)]">
                  {t("component.reportDialog.title")}
                </DialogTitle>
                {error ? <Alert variant="destructive"><AlertDescription>{t("component.form.error")}</AlertDescription></Alert> : null}
                {isCollab ? <Alert><AlertDescription>{t("component.reportDialog.collabing", { org: app.currentOrg.name })}</AlertDescription></Alert> : null}

                <div className="text-sm text-[color:var(--color-foreground)]">
                  <div>{video.title}</div>
                  <div className="text-[color:var(--color-muted-foreground)]">{video.channel?.name}</div>
                </div>

                {renderReasonList()}
                {renderTopicEditor()}
                {renderMentionEditor()}
                {renderOrgMismatchHint()}
                {renderSpecificChannelWarning()}
                {renderCommentsField()}
                {renderFooter()}
              </div>
            </Card>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
