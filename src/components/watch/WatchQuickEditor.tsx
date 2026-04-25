"use client";

import { useEffect, useMemo, useState } from "react";
import debounce from "lodash-es/debounce";
import { mdiContentSave } from "@mdi/js";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { CHANNEL_TYPES } from "@/lib/consts";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { channelDisplayName } from "@/lib/video-format";
import * as icons from "@/lib/icons";

function topicFilter(queryText: string, itemText: string) {
  return itemText.toString().replace(/\s+/g, "_").toLocaleLowerCase().indexOf(queryText.toString().replace(/\s+/g, "_").toLocaleLowerCase()) > -1;
}

export function WatchQuickEditor({ video }: { video: Record<string, any> }) {
  const app = useAppState();
  const { t } = useI18n();
  const [mentions, setMentions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [topics, setTopics] = useState<any[]>([]);
  const [newTopic, setNewTopic] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [isSelectedAll, setIsSelectedAll] = useState(false);
  const [isApplyingBulkEdit, setIsApplyingBulkEdit] = useState(false);
  const [deletionSet, setDeletionSet] = useState<Set<string>>(new Set());
  const useEnglishName = app.settings.nameProperty === "english_name";
  const filteredTopics = useMemo(() => !newTopic ? topics : topics.filter((topic: any) => topicFilter(newTopic, topic.text)), [newTopic, topics]);

  const debouncedSearch = useMemo(() => debounce((value: string) => {
    if (!value) { setSearchResults([]); return; }
    api.searchChannel({ type: CHANNEL_TYPES.VTUBER, queryText: value }).then(({ data }: any) => {
      setSearchResults((data || []).filter((d: any) => !(video.channel?.id === d.id || mentions.find((m) => m.id === d.id))));
    }).catch(console.error);
  }, 400), [video.channel?.id, mentions]);

  useEffect(() => { updateMentions(); updateCurrentTopic(); }, [video.id]);
  useEffect(() => { debouncedSearch(search); return () => debouncedSearch.cancel(); }, [search, debouncedSearch]);

  function updateCurrentTopic() { api.getVideoTopic(video.id).then(({ data }: any) => { setCurrentTopic(data.topic_id); setNewTopic(data.topic_id); }).catch(console.error); }
  function updateMentions() { api.getMentions(video.id).then(({ data }: any) => { setMentions(data || []); setSearchResults([]); setSearch(""); }).catch(console.error); }
  function isAddedToDeletionSet(id: string) { return deletionSet.has(id); }
  function toggleDeletion(id: string) {
    setDeletionSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      setIsSelectedAll(next.size === mentions.length && mentions.length > 0);
      return next;
    });
  }
  function toggleMentionSelection() {
    if (isSelectedAll) {
      setDeletionSet(new Set());
      setIsSelectedAll(false);
    } else {
      setDeletionSet(new Set(mentions.map((mention) => mention.id)));
      setIsSelectedAll(true);
    }
  }
  function showError(message: string) { setErrorMessage(message); setShowErrorAlert(true); setTimeout(() => setShowErrorAlert(false), 4000); }
  function showSuccess(message: string) { setSuccessMessage(message); setShowSuccessAlert(true); setTimeout(() => setShowSuccessAlert(false), 4000); }
  function applyDeleteMentions() {
    setIsApplyingBulkEdit(true);
    const ids = Array.from(deletionSet);
    if (ids.length === 0) { setIsApplyingBulkEdit(false); return; }
    api.deleteMentions(video.id, ids, app.userdata.jwt).then(({ data }: any) => {
      if (!data) return;
      setDeletionSet(new Set());
      setIsSelectedAll(false);
      showSuccess("Successfully deleted mention");
      updateMentions();
    }).catch((e: any) => showError((e.response && e.response.data.message) || e.message || "Error occured")).finally(() => setIsApplyingBulkEdit(false));
  }
  function addMention(channel: any) {
    api.addMention(video.id, channel.id, app.userdata.jwt).then(({ data }: any) => {
      if (!data) return;
      showSuccess(`Added channel: ${channelDisplayName(channel, useEnglishName)}`);
      updateMentions();
    }).catch((e: any) => showError((e.response && e.response.data.message) || e.message || "Error occured"));
  }
  async function loadTopics() {
    if (topics.length > 0) return;
    const { data } = await api.topics();
    setTopics((data || []).map((topic: any) => ({ value: topic.id, text: `${topic.id} (${topic.count ?? 0})` })));
  }
  function saveTopic() {
    api.topicSet(newTopic, video.id, app.userdata.jwt).then(() => { setCurrentTopic(newTopic); showSuccess(`Updated Topic to ${newTopic}`); }).catch((e: any) => showError((e.response && e.response.data.message) || e.message || "Error occured"));
  }

  return (
    <Card className="watch-card striped rounded-none p-4">
      {errorMessage && showErrorAlert ? <div className="mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</div> : null}
      {successMessage && showSuccessAlert ? <div className="mb-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{successMessage}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={isApplyingBulkEdit} onClick={applyDeleteMentions}>{!isApplyingBulkEdit ? <Icon icon={icons.mdiContentSaveEdit} /> : <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}Apply Changes</Button>
            <Button type="button" variant="ghost" size="sm" onClick={toggleMentionSelection}><Icon icon={isSelectedAll ? icons.mdiSelectOff : icons.mdiSelectAll} />{isSelectedAll ? "Deselect All" : "Select All"}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mentions.map((item, index) => <div key={`${item.id || "mention"}-${index}`} className="relative"><ChannelChip channel={item} size={60} closeDelay={0}>{() => <div className={`absolute inset-0 flex items-center justify-center rounded-full ${isAddedToDeletionSet(item.id) ? "bg-rose-950/70" : "bg-slate-950/0 hover:bg-slate-950/40"}`}><Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={(event) => { event.stopPropagation(); toggleDeletion(item.id); }}><Icon icon={isAddedToDeletionSet(item.id) ? icons.mdiDelete : icons.mdiPlusBox} /></Button></div>}</ChannelChip></div>)}
          </div>
          <div className="mt-4"><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Add Mentioned Channels</label><Input value={search} placeholder="Search VTubers to mention" className="min-w-[300px] max-w-xl" onChange={(event) => setSearch(event.target.value)} />{searchResults.length ? <div className="mt-2 max-w-xl rounded-2xl border border-white/10 bg-slate-950/80 p-2">{searchResults.map((item, index) => <button key={`${item.id || "result"}-${index}`} type="button" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8" onClick={() => addMention(item)}>{channelDisplayName(item, useEnglishName)}</button>)}</div> : null}</div>
        </div>
        {video.type === "stream" || video.type === "placeholder" ? (
          <div className="min-w-[260px] max-w-sm flex-1 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-slate-300"><Icon icon={icons.mdiAnimationPlay} /><span className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("component.search.type.topic")}</span></div>
            <div className="mb-3 text-sm text-sky-300">{currentTopic || "Unset"}</div>
            <Input value={newTopic || ""} list="quick-editor-topics" placeholder="Topic (leave empty to unset)" onFocus={loadTopics} onChange={(event) => setNewTopic(event.target.value || null)} />
            <datalist id="quick-editor-topics">{filteredTopics.map((topic) => <option key={topic.value} value={topic.value}>{topic.text}</option>)}</datalist>
            <Button type="button" size="sm" className="mt-3" onClick={saveTopic}><Icon icon={mdiContentSave} />Save Topic</Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
