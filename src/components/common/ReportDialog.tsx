"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import debounce from "lodash-es/debounce";
import { CHANNEL_TYPES } from "@/lib/consts";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { filterVideo } from "@/lib/filter-videos";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { VideoListFilters } from "@/components/setting/VideoListFilters";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { channelDisplayName } from "@/lib/video-format";
import * as icons from "@/lib/icons";

export function ReportDialog() {
  const app = useAppState();
  const { t } = useI18n();
  const pathname = usePathname();
  const video = app.reportVideo;
  const mentionRoot = useRef<HTMLDivElement | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [error, setError] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [topics, setTopics] = useState<any[]>([]);
  const [suggestedTopic, setSuggestedTopic] = useState<string | false>(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [originalMentions, setOriginalMentions] = useState<any[]>([]);
  const [suggestedMentions, setSuggestedMentions] = useState<any[] | null>(null);
  const [deletionSet, setDeletionSet] = useState<Set<string>>(new Set());
  const [mentionsMenuOpen, setMentionsMenuOpen] = useState(false);
  const [isApplyingBulkEdit, setIsApplyingBulkEdit] = useState(false);
  const isHomeRoute = pathname === "/";
  const isCollab = video ? !filterVideo(video, app, { hideCollabs: true }) : false;
  const collabsAlreadyHidden = app.settings.hideCollabStreams;
  const isSelectedAll = !!suggestedMentions?.length && deletionSet.size === suggestedMentions.length;
  const useEnglishName = app.settings.nameProperty === "english_name";

  const reasons = useMemo(() => {
    const vtype = video?.type === "stream" ? "video" : video?.type;
    return [
      { text: t("component.reportDialog.reasons[4]"), value: "Incorrect video topic", types: ["stream", "placeholder"], orgRequired: false },
      { text: t("component.reportDialog.reasons[5]"), value: "Incorrect channel mentions", types: null, orgRequired: false },
      { text: t("component.reportDialog.reasons[6]", [vtype, app.currentOrg.name]), value: "This video does not belong to the org", types: null, orgRequired: true },
      { text: t("component.reportDialog.reasons[1]"), value: "Low Quality/Misleading Content", types: ["clip"], orgRequired: false },
      { text: t("component.reportDialog.reasons[2]"), value: "Violates the org's derivative work guidelines or inappropriate", types: ["clip"], orgRequired: false },
      { text: t("component.reportDialog.reasons[3]"), value: "Other", types: null, orgRequired: false },
    ];
  }, [video?.type, app.currentOrg.name, t]);

  const filteredReasons = reasons.filter((reason) => {
    if (!video) return false;
    if (reason.orgRequired && ((!app.currentOrg || app.currentOrg.name === "All Vtubers" || app.currentOrg.name === video.channel?.org) || !isHomeRoute)) return false;
    if (reason.types && !reason.types.includes(video.type)) return false;
    return true;
  });

  const debouncedSearch = useMemo(() => debounce((value: string) => {
    if (!value) { setSearchResults([]); return; }
    api.searchChannel({ type: CHANNEL_TYPES.VTUBER, queryText: value }).then(({ data }: any) => {
      setSearchResults(data.filter((d: any) => !(video?.channel?.id === d.id || suggestedMentions?.find((m) => m.id === d.id))));
      setMentionsMenuOpen(true);
    }).catch(console.error);
  }, 400), [video?.channel?.id, suggestedMentions]);

  useEffect(() => { debouncedSearch(search); return () => debouncedSearch.cancel(); }, [search, debouncedSearch]);
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) { if (!mentionRoot.current?.contains(event.target as Node)) setMentionsMenuOpen(false); }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  function close() {
    app.setReportVideo(null);
    setSuggestedTopic(false); setSuggestedMentions(null); setSearch(""); setSearchResults([]); setSelectedReasons([]); setComments(""); setMentionsMenuOpen(false); setDeletionSet(new Set()); setIsApplyingBulkEdit(false);
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
    api.getMentions(video.id).then(({ data }: any) => { setOriginalMentions(data); setSuggestedMentions(data); }).catch(console.error);
  }
  function deleteMention(channel: any) { setSuggestedMentions((prev) => (prev || []).filter((mention) => mention.id !== channel.id)); setDeletionSet((prev) => { const next = new Set(prev); next.delete(channel.id); return next; }); }
  function addMention(channel: any) { setSuggestedMentions((prev) => prev?.find((mention) => mention.id === channel.id) ? prev : [...(prev || []), channel]); setSearchResults([]); setSearch(""); setMentionsMenuOpen(false); }
  function addChannelToDeletionSet(id: string) { setDeletionSet((prev) => new Set(prev).add(id)); }
  function removeChannelFromDeletionSet(id: string) { setDeletionSet((prev) => { const next = new Set(prev); next.delete(id); return next; }); }
  function toggleMentionSelection() { setDeletionSet((prev) => prev.size === suggestedMentions?.length ? new Set() : new Set((suggestedMentions || []).map((m) => m.id))); }
  function applyDeleteMentions() {
    setIsApplyingBulkEdit(true);
    const ids = Array.from(deletionSet);
    if (ids.length === 0) {
      setIsApplyingBulkEdit(false);
      return;
    }
    setSuggestedMentions((prev) => (prev || []).filter((mention) => !ids.includes(mention.id)));
    setDeletionSet(new Set());
    setSearchResults([]);
    setSearch("");
    setMentionsMenuOpen(false);
    setIsApplyingBulkEdit(false);
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
    api.reportVideo(video.id, fieldBody, app.userdata?.jwt || "").then(() => { close(); setShowSnackbar(true); setError(false); }).catch((e) => { console.error(e); setError(true); });
  }

  return <div><Dialog open={!!video} className="max-w-[500px]" onOpenChange={(open) => { if (!open) close(); }}>{video ? <Card className="border-0 p-0 shadow-none"><div className="space-y-4 p-5"><div className="text-xl font-semibold text-[color:var(--color-foreground)]">{t("component.reportDialog.title")}</div>{error ? <div className="rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm text-red-100">Error Occurred</div> : null}{isCollab ? <div className="rounded-xl border border-sky-400/20 bg-sky-500/15 px-3 py-2 text-sm text-sky-100">{t("component.reportDialog.collabing", { org: app.currentOrg.name })}</div> : null}<div className="text-sm text-[color:var(--color-foreground)]"><div>{video.title}</div><div className="text-[color:var(--color-muted-foreground)]">{video.channel?.name}</div></div><div className="space-y-2">{filteredReasons.map((reason) => <label key={reason.value} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-sm text-[color:var(--color-foreground)]"><input checked={selectedReasons.includes(reason.value)} type="checkbox" value={reason.value} className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-950/80" onChange={(event) => toggleReason(reason.value, event.target.checked)} /><span>{reason.text}</span></label>)}</div>{selectedReasons.includes("Incorrect video topic") ? <div className="space-y-2"><div className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">{t("component.search.type.topic")}<span className="ml-2 text-[color:var(--color-primary)]">{video.topic_id || "None"}</span></div><select value={suggestedTopic || ""} className="w-full rounded-xl border border-white/12 bg-slate-950/70 px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none" onFocus={loadTopics} onChange={(event) => setSuggestedTopic(event.target.value || false)}><option value="">Suggest new topic (leave empty to unset)</option>{topics.map((topic) => <option key={topic.value} value={topic.value}>{topic.text}</option>)}</select></div> : null}{selectedReasons.includes("Incorrect channel mentions") ? <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={applyDeleteMentions}>{!isApplyingBulkEdit ? <Icon icon={icons.mdiContentSaveEdit} /> : <span>...</span>}Apply Changes</Button><Button type="button" variant="ghost" size="sm" onClick={toggleMentionSelection}><Icon icon={isSelectedAll ? icons.mdiSelectOff : icons.mdiSelectAll} />{isSelectedAll ? "Deselect All" : "Select All"}</Button></div><div className="flex flex-wrap gap-2">{(suggestedMentions || []).map((item) => <ChannelChip key={item.id} channel={item} size={60} closeDelay={0}>{() => <div className={`absolute inset-0 flex items-center justify-center ${deletionSet.has(item.id) ? "bg-slate-950/70" : "bg-transparent"}`}>{deletionSet.has(item.id) ? <Button type="button" size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); removeChannelFromDeletionSet(item.id); }}><Icon icon={icons.mdiDelete} /></Button> : <button type="button" className="absolute inset-0" onClick={(event) => { event.stopPropagation(); addChannelToDeletionSet(item.id); }} />}</div>}</ChannelChip>)}</div><div ref={mentionRoot} className="relative"><Input value={search} placeholder="Adjust Mentioned Channels" onFocus={() => setMentionsMenuOpen(true)} onChange={(event) => setSearch(event.target.value)} />{mentionsMenuOpen && searchResults.length ? <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-xl border border-white/10 bg-slate-950/96 shadow-2xl shadow-slate-950/40">{searchResults.map((dropdownItem) => <button key={dropdownItem.id} type="button" className="block w-full px-4 py-3 text-left text-sm text-[color:var(--color-foreground)] transition hover:bg-white/6" onClick={(event) => { event.stopPropagation(); addMention(dropdownItem); }}>{channelDisplayName(dropdownItem, useEnglishName)}</button>)}</div> : null}</div><div className="flex flex-wrap gap-2">{(suggestedMentions || []).map((selection) => <div key={`${selection.id}chip`} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5"><ChannelChip channel={selection} size={40} /><button type="button" onClick={(event) => { event.stopPropagation(); deleteMention(selection); }}><Icon icon={icons.mdiClose} className="h-4 w-4 text-[color:var(--color-primary)]" /></button></div>)}</div></div> : null}{selectedReasons.includes("This video does not belong to the org") && !collabsAlreadyHidden && video.type !== "clip" ? <div className="space-y-2"><div className="text-sm text-[color:var(--color-primary)]">{t("component.reportDialog.consider")}</div><VideoListFilters placeholderFilter={false} topicFilter={false} missingFilter={false} /></div> : null}{video.channel?.id === "UCF4-I8ZQL6Aa-iHfdz-B9KQ" ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-sm text-red-100"><b>Note: Please don&apos;t report just because you disagree / dislike this subber.</b>{readMore ? <div className="mt-2 space-y-2"><p>Holodex platform doesn&apos;t arbitrate between sub-par and good TLs. For minor issues, you should feedback changes to the subber on youtube via comments, or else reporting them to whoever they&apos;re clipping (Cover or Nijisanji etc.).</p><p>However, if the video in question is indeed dangerously translated to cause misunderstandings, we will definitely either delete the video or deplatform the channel, in addition to escalating to relevant organizations.</p><p>If you&apos;d like to not see this channel ever again, there&apos;s a <b>Block Channel</b> button below, and on the channel page.</p></div> : <button type="button" className="mt-2 underline" onClick={() => setReadMore(true)}>Read more...</button>}</div> : null}<div className="space-y-2"><label className="text-sm text-[color:var(--color-muted-foreground)]">{t("component.reportDialog.comments")}</label><textarea value={comments} className="min-h-32 w-full rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none" onChange={(event) => setComments(event.target.value)} /><div className="text-xs text-[color:var(--color-muted-foreground)]">* English / 日本語 / 繁體中文 OK</div></div><div className="h-px bg-white/10" /><div className="flex items-center gap-3 text-sm text-[color:var(--color-muted-foreground)]"><ChannelSocials channel={video.channel} showDelete hideYt vertical className="inline-block" /><Icon icon={icons.mdiArrowLeft} className="h-4 w-4" /><span>{t("component.channelSocials.block")}</span></div><div className="flex items-center gap-3"><Button type="button" variant="ghost" onClick={close}>{t("views.app.close_btn")}</Button><Button type="button" className="ml-auto" disabled={comments.length === 0} onClick={sendReport}>{t("views.multiview.confirmOverwriteYes")}</Button></div></div></Card> : null}</Dialog>{showSnackbar ? <div className="fixed right-6 bottom-6 z-50 rounded-xl border border-emerald-400/25 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100 shadow-xl"><div className="flex items-center gap-3"><span>{t("component.reportDialog.success")}</span><Button type="button" variant="ghost" size="sm" onClick={() => setShowSnackbar(false)}>{t("views.app.close_btn")}</Button></div></div> : null}</div>;
}
