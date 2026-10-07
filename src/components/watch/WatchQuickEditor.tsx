"use client";

import debounce from "lodash-es/debounce";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { SectionPanel } from "@/components/common/SectionPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { CHANNEL_TYPES } from "@/lib/consts";
import * as icons from "@/lib/icons";
import { Save } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { fetchTopicOptions } from "@/lib/topics";
import { channelDisplayName } from "@/lib/video-format";

// A message shown for 4 seconds.
function useFlashMessage() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  function flash(next: string) {
    setMessage(next);
    setVisible(true);
    setTimeout(() => setVisible(false), 4000);
  }
  return { message, visible, flash };
}

function errorText(e: any, fallback: string) {
  return e.response?.data.message || e.message || fallback;
}

// Apply the marked deletions, and select/deselect every mention.
function MentionToolbar({
  applying,
  allSelected,
  onApply,
  onToggleAll,
}: {
  applying: boolean;
  allSelected: boolean;
  onApply: () => void;
  onToggleAll: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" size="sm" disabled={applying} onClick={onApply}>
        {!applying ? <icons.SaveAll className="size-5" /> : <Spinner className="size-4" />}
        {t("component.reportDialog.applyChanges")}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onToggleAll}>
        {allSelected ? (
          <icons.Square className="size-5" />
        ) : (
          <icons.CheckSquare className="size-5" />
        )}
        {allSelected
          ? t("component.reportDialog.deselectAll")
          : t("component.reportDialog.selectAll")}
      </Button>
    </div>
  );
}

// Mentioned channels; the button over each avatar marks it for deletion.
function MentionChips({
  mentions,
  deletionSet,
  onToggle,
}: {
  mentions: any[];
  deletionSet: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {mentions.map((item) => (
        <div key={item.id} className="relative">
          <ChannelChip channel={item} size={60} closeDelay={0}>
            {() => (
              <div className="absolute inset-0 flex items-center justify-center rounded-full">
                <Button
                  type="button"
                  size="icon"
                  variant={deletionSet.has(item.id) ? "destructive" : "ghost"}
                  className="h-8 w-8"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(item.id);
                  }}
                >
                  {deletionSet.has(item.id) ? (
                    <icons.Trash2 className="size-5" />
                  ) : (
                    <icons.SquarePlus className="size-5" />
                  )}
                </Button>
              </div>
            )}
          </ChannelChip>
        </div>
      ))}
    </div>
  );
}

// Channel search for adding a mention; picking a result adds it.
function MentionSearch({
  search,
  onSearch,
  results,
  onAdd,
}: {
  search: string;
  onSearch: (value: string) => void;
  results: any[];
  onAdd: (channel: any) => void;
}) {
  const app = useAppState();
  const t = useTranslations();
  const { useEnglishName } = app.settings;
  const channelValues = useMemo(() => results.map((item) => item.id), [results]);
  const channelLabels = useMemo(
    () => new Map(results.map((item) => [item.id, channelDisplayName(item, useEnglishName)])),
    [results, useEnglishName],
  );
  const channelsById = useMemo(() => new Map(results.map((item) => [item.id, item])), [results]);
  function selectMention(channelId: string | null) {
    if (!channelId) return;
    const channel = channelsById.get(channelId);
    if (channel) onAdd(channel);
  }
  return (
    <div className="mt-4">
      <Label className="mb-2 block">{t("component.reportDialog.addMentionedChannels")}</Label>
      <div className="max-w-xl">
        <Combobox
          items={channelValues}
          value={null}
          inputValue={search}
          filter={null}
          itemToStringLabel={(item) => channelLabels.get(item) || item}
          onInputValueChange={onSearch}
          onValueChange={selectMention}
        >
          <ComboboxInput
            placeholder={t("component.reportDialog.searchMentionedChannels")}
            showClear={!!search}
          />
          <ComboboxContent>
            <ComboboxEmpty>
              {search.trim().length < 2
                ? t("component.search.typeTwoCharacters")
                : t("component.search.noChannelsFound")}
            </ComboboxEmpty>
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
  );
}

// The stream's current topic and a picker to change it.
function TopicCard({
  topics,
  currentTopic,
  newTopic,
  onNewTopic,
  onLoadTopics,
  onSave,
}: {
  topics: any[];
  currentTopic: string | null;
  newTopic: string | null;
  onNewTopic: (topic: string | null) => void;
  onLoadTopics: () => void;
  onSave: () => void;
}) {
  const t = useTranslations();
  const topicValues = useMemo(() => topics.map((topic: any) => topic.value), [topics]);
  const topicLabels = useMemo(
    () => new Map(topics.map((topic: any) => [topic.value, topic.text])),
    [topics],
  );
  return (
    <Card className="min-w-[260px] max-w-sm flex-1 p-4">
      <div className="mb-2 flex items-center gap-2">
        <icons.CirclePlay className="size-5" />
        <span className="text-sm text-muted-foreground">{t("component.search.type.topic")}</span>
      </div>
      <div className="mb-3 text-sm">{currentTopic || t("views.editor.changeTopic.unset")}</div>
      <Combobox
        items={topicValues}
        value={newTopic}
        inputValue={newTopic || ""}
        itemToStringLabel={(item) => topicLabels.get(item) || item}
        onOpenChange={(open) => {
          if (open) onLoadTopics();
        }}
        onInputValueChange={(value) => onNewTopic(value || null)}
        onValueChange={(value) => onNewTopic(value)}
      >
        <ComboboxInput
          placeholder={t("views.editor.changeTopic.inputPlaceholder")}
          showClear={!!newTopic}
          onFocus={onLoadTopics}
        />
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
      <Button type="button" size="sm" className="mt-3" onClick={onSave}>
        <Save className="size-5" />
        {t("views.editor.changeTopic.saveTopic")}
      </Button>
    </Card>
  );
}

function FlashAlerts({
  error,
  success,
}: {
  error: ReturnType<typeof useFlashMessage>;
  success: ReturnType<typeof useFlashMessage>;
}) {
  return (
    <>
      {error.message && error.visible ? (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {success.message && success.visible ? (
        <Alert className="mb-3">
          <AlertDescription>{success.message}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

export function WatchQuickEditor({ video }: { video: Record<string, any> }) {
  const app = useAppState();
  const t = useTranslations();
  const [mentions, setMentions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const error = useFlashMessage();
  const success = useFlashMessage();
  const [topics, setTopics] = useState<any[]>([]);
  const [newTopic, setNewTopic] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [isApplyingBulkEdit, setIsApplyingBulkEdit] = useState(false);
  const [deletionSet, setDeletionSet] = useState<Set<string>>(() => new Set());
  const isSelectedAll = mentions.length > 0 && deletionSet.size === mentions.length;

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        if (!value) {
          setSearchResults([]);
          return;
        }
        api
          .searchChannel({ type: CHANNEL_TYPES.VTUBER, queryText: value })
          .then(({ data }: any) => {
            setSearchResults(
              (data || []).filter(
                (d: any) => !(video.channel?.id === d.id || mentions.find((m) => m.id === d.id)),
              ),
            );
          })
          .catch(console.error);
      }, 400),
    [video.channel?.id, mentions],
  );

  const videoId = video.id;
  useEffect(() => {
    let cancelled = false;
    api
      .getMentions(videoId)
      .then(({ data }: any) => {
        if (!cancelled) applyMentions(data);
      })
      .catch(console.error);
    api
      .getVideoTopic(videoId)
      .then(({ data }: any) => {
        if (!cancelled) applyTopic(data);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [videoId]);
  useEffect(() => {
    debouncedSearch(search);
    return () => debouncedSearch.cancel();
  }, [search, debouncedSearch]);

  function applyTopic(data: any) {
    setCurrentTopic(data.topic_id);
    setNewTopic(data.topic_id);
  }
  function applyMentions(data: any) {
    setMentions(data || []);
    setSearchResults([]);
    setSearch("");
  }
  function updateMentions() {
    api
      .getMentions(video.id)
      .then(({ data }: any) => applyMentions(data))
      .catch(console.error);
  }
  function toggleDeletion(id: string) {
    setDeletionSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleMentionSelection() {
    setDeletionSet(isSelectedAll ? new Set() : new Set(mentions.map((mention) => mention.id)));
  }
  const showError = (e: any) => error.flash(errorText(e, t("component.form.error")));
  function applyDeleteMentions() {
    setIsApplyingBulkEdit(true);
    const ids = Array.from(deletionSet);
    if (ids.length === 0) {
      setIsApplyingBulkEdit(false);
      return;
    }
    api
      .deleteMentions(video.id, ids, app.userdata.jwt)
      .then(({ data }: any) => {
        if (!data) return;
        setDeletionSet(new Set());
        success.flash(t("views.editor.channelMentions.deleteSuccess"));
        updateMentions();
      })
      .catch(showError)
      .finally(() => setIsApplyingBulkEdit(false));
  }
  function addMention(channel: any) {
    api
      .addMention(video.id, channel.id, app.userdata.jwt)
      .then(({ data }: any) => {
        if (!data) return;
        success.flash(
          t("views.editor.channelMentions.addSuccess", {
            channel: channelDisplayName(channel, app.settings.useEnglishName),
          }),
        );
        updateMentions();
      })
      .catch(showError);
  }
  async function loadTopics() {
    if (topics.length > 0) return;
    setTopics(await fetchTopicOptions());
  }
  function saveTopic() {
    api
      .topicSet(newTopic, video.id, app.userdata.jwt)
      .then(() => {
        setCurrentTopic(newTopic);
        success.flash(
          t("views.editor.changeTopic.updateSuccess", {
            topic: newTopic || t("component.search.unset"),
          }),
        );
      })
      .catch(showError);
  }

  return (
    <SectionPanel title={t("component.form.placeholder.editorBadge")} contentClassName="px-4 py-4">
      <FlashAlerts error={error} success={success} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <MentionToolbar
            applying={isApplyingBulkEdit}
            allSelected={isSelectedAll}
            onApply={applyDeleteMentions}
            onToggleAll={toggleMentionSelection}
          />
          <MentionChips mentions={mentions} deletionSet={deletionSet} onToggle={toggleDeletion} />
          <MentionSearch
            search={search}
            onSearch={setSearch}
            results={searchResults}
            onAdd={addMention}
          />
        </div>
        {video.type === "stream" || video.type === "placeholder" ? (
          <TopicCard
            topics={topics}
            currentTopic={currentTopic}
            newTopic={newTopic}
            onNewTopic={setNewTopic}
            onLoadTopics={() => void loadTopics()}
            onSave={saveTopic}
          />
        ) : null}
      </div>
    </SectionPanel>
  );
}
