"use client";

import { useEffect, useMemo, useState } from "react";
import debounce from "lodash-es/debounce";
import { Save } from "@/lib/icons";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SectionPanel } from "@/components/common/SectionPanel";
import { api } from "@/lib/api";
import { CHANNEL_TYPES } from "@/lib/consts";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { channelDisplayName } from "@/lib/video-format";
import { fetchTopicOptions } from "@/lib/topics";
import * as icons from "@/lib/icons";

export function WatchQuickEditor({ video }: { video: Record<string, any> }) {
  const app = useAppState();
  const t = useTranslations();
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
  const { useEnglishName } = app.settings;
  const channelValues = useMemo(() => searchResults.map((item) => item.id), [searchResults]);
  const channelLabels = useMemo(() => new Map(searchResults.map((item) => [item.id, channelDisplayName(item, useEnglishName)])), [searchResults, useEnglishName]);
  const channelsById = useMemo(() => new Map(searchResults.map((item) => [item.id, item])), [searchResults]);
  const topicValues = useMemo(() => topics.map((topic: any) => topic.value), [topics]);
  const topicLabels = useMemo(() => new Map(topics.map((topic: any) => [topic.value, topic.text])), [topics]);

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
      showSuccess(t("views.editor.channelMentions.deleteSuccess"));
      updateMentions();
    }).catch((e: any) => showError((e.response?.data.message) || e.message || t("component.form.error"))).finally(() => setIsApplyingBulkEdit(false));
  }
  function addMention(channel: any) {
    api.addMention(video.id, channel.id, app.userdata.jwt).then(({ data }: any) => {
      if (!data) return;
      showSuccess(t("views.editor.channelMentions.addSuccess", { channel: channelDisplayName(channel, useEnglishName) }));
      updateMentions();
    }).catch((e: any) => showError((e.response?.data.message) || e.message || t("component.form.error")));
  }
  function selectMention(channelId: string | null) {
    if (!channelId) return;
    const channel = channelsById.get(channelId);
    if (channel) addMention(channel);
  }
  async function loadTopics() {
    if (topics.length > 0) return;
    setTopics(await fetchTopicOptions());
  }
  function saveTopic() {
    api.topicSet(newTopic, video.id, app.userdata.jwt).then(() => { setCurrentTopic(newTopic); showSuccess(t("views.editor.changeTopic.updateSuccess", { topic: newTopic || t("component.search.unset") })); }).catch((e: any) => showError((e.response?.data.message) || e.message || t("component.form.error")));
  }

  return (
    <SectionPanel title={t("component.form.placeholder.editorBadge")} contentClassName="px-4 py-4">
      {errorMessage && showErrorAlert ? <Alert variant="destructive" className="mb-3"><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
      {successMessage && showSuccessAlert ? <Alert className="mb-3"><AlertDescription>{successMessage}</AlertDescription></Alert> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
	            <Button type="button" variant="secondary" size="sm" disabled={isApplyingBulkEdit} onClick={applyDeleteMentions}>{!isApplyingBulkEdit ? <icons.SaveAll className="size-5" /> : <Spinner className="size-4" />}{t("component.reportDialog.applyChanges")}</Button>
	            <Button type="button" variant="ghost" size="sm" onClick={toggleMentionSelection}>{isSelectedAll ? <icons.Square className="size-5" /> : <icons.CheckSquare className="size-5" />}{isSelectedAll ? t("component.reportDialog.deselectAll") : t("component.reportDialog.selectAll")}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mentions.map((item, index) => <div key={`${item.id || "mention"}-${index}`} className="relative"><ChannelChip channel={item} size={60} closeDelay={0}>{() => <div className="absolute inset-0 flex items-center justify-center rounded-full"><Button type="button" size="icon" variant={isAddedToDeletionSet(item.id) ? "destructive" : "ghost"} className="h-8 w-8" onClick={(event) => { event.stopPropagation(); toggleDeletion(item.id); }}>{isAddedToDeletionSet(item.id) ? <icons.Trash2 className="size-5" /> : <icons.SquarePlus className="size-5" />}</Button></div>}</ChannelChip></div>)}
          </div>
          <div className="mt-4">
            <Label className="mb-2 block">{t("component.reportDialog.addMentionedChannels")}</Label>
            <div className="max-w-xl">
              <Combobox
                items={channelValues}
                value={null}
                inputValue={search}
                filter={null}
                itemToStringLabel={(item) => channelLabels.get(item) || item}
                onInputValueChange={setSearch}
                onValueChange={selectMention}
              >
	                <ComboboxInput placeholder={t("component.reportDialog.searchMentionedChannels")} showClear={!!search} />
	                <ComboboxContent>
	                  <ComboboxEmpty>{search.trim().length < 2 ? t("component.search.typeTwoCharacters") : t("component.search.noChannelsFound")}</ComboboxEmpty>
                  <ComboboxList>
                    {(item: string, index: number) => (
                      <ComboboxItem key={item} value={item} index={index}>
                        {channelLabels.get(item) || item}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>
        </div>
        {video.type === "stream" || video.type === "placeholder" ? (
          <Card className="min-w-[260px] max-w-sm flex-1 p-4">
            <div className="mb-2 flex items-center gap-2"><icons.CirclePlay className="size-5" /><span className="text-sm text-muted-foreground">{t("component.search.type.topic")}</span></div>
            <div className="mb-3 text-sm">{currentTopic || t("views.editor.changeTopic.unset")}</div>
            <Combobox
              items={topicValues}
              value={newTopic}
              inputValue={newTopic || ""}
              itemToStringLabel={(item) => topicLabels.get(item) || item}
              onOpenChange={(open) => { if (open) void loadTopics(); }}
              onInputValueChange={(value) => setNewTopic(value || null)}
              onValueChange={(value) => setNewTopic(value)}
            >
	              <ComboboxInput placeholder={t("views.editor.changeTopic.inputPlaceholder")} showClear={!!newTopic} onFocus={loadTopics} />
	              <ComboboxContent>
	                <ComboboxEmpty>{t("component.search.noTopicsFound")}</ComboboxEmpty>
                <ComboboxList>
                  {(item: string, index: number) => (
                    <ComboboxItem key={item} value={item} index={index}>
                      {topicLabels.get(item) || item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
	            <Button type="button" size="sm" className="mt-3" onClick={saveTopic}><Save className="size-5" />{t("views.editor.changeTopic.saveTopic")}</Button>
          </Card>
        ) : null}
      </div>
    </SectionPanel>
  );
}
