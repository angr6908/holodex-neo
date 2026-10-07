"use client";

import debounce from "lodash-es/debounce";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { VideoListFilters } from "@/components/nav/MainNav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG, CHANNEL_TYPES } from "@/lib/consts";
import { filterVideo } from "@/lib/filter-videos";
import * as icons from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { fetchTopicOptions } from "@/lib/topics";
import { channelDisplayName } from "@/lib/video-format";

type Reason = { text: string; value: string; types: string[] | null; orgReq: boolean };

const TOPIC_REASON = "Incorrect video topic";
const MENTIONS_REASON = "Incorrect channel mentions";
const ORG_REASON = "This video does not belong to the org";
// A channel whose reports get an extra notice about what Holodex will and won't act on.
const WARNED_CHANNEL_ID = "UCF4-I8ZQL6Aa-iHfdz-B9KQ";

function reportReasons(t: ReturnType<typeof useTranslations>, videoType: string, orgName: string) {
  const vt = videoType === "stream" ? "video" : videoType;
  return [
    {
      text: t("component.reportDialog.reasons.4"),
      value: TOPIC_REASON,
      types: ["stream", "placeholder"],
      orgReq: false,
    },
    {
      text: t("component.reportDialog.reasons.5"),
      value: MENTIONS_REASON,
      types: null,
      orgReq: false,
    },
    {
      text: t("component.reportDialog.reasons.6", { arg0: vt, arg1: orgName }),
      value: ORG_REASON,
      types: null,
      orgReq: true,
    },
    {
      text: t("component.reportDialog.reasons.1"),
      value: "Low Quality/Misleading Content",
      types: ["clip"],
      orgReq: false,
    },
    {
      text: t("component.reportDialog.reasons.2"),
      value: "Violates the org's derivative work guidelines or inappropriate",
      types: ["clip"],
      orgReq: false,
    },
    { text: t("component.reportDialog.reasons.3"), value: "Other", types: null, orgReq: false },
  ] satisfies Reason[];
}

// "Doesn't belong to the org" only makes sense on the home page of a specific org that isn't the
// video channel's own; other reasons can be limited to some video types.
function reasonApplies(reason: Reason, video: any, currentOrg: any, isHome: boolean) {
  if (!video) return false;
  if (
    reason.orgReq &&
    (!currentOrg ||
      currentOrg.name === ALL_VTUBERS_ORG ||
      currentOrg.name === video.channel?.org ||
      !isHome)
  )
    return false;
  if (reason.types && !reason.types.includes(video.type)) return false;
  return true;
}

const idList = (list: any[]) => (list.length ? list.map((m) => `\`${m.id}\``).join("\n") : "None");

// The report as Discord-style fields: reasons, topic and mention changes, comments.
function reportBody({
  reasons,
  video,
  sugTopic,
  origMentions,
  sugMentions,
  comments,
}: {
  reasons: string[];
  video: any;
  sugTopic: string | false;
  origMentions: any[];
  sugMentions: any[] | null;
  comments: string;
}) {
  const r = reasons.join("\n");
  const body: any[] = [{ name: "Reason", value: r }];
  if (sugTopic !== false || r.includes("topic")) {
    body.push({ name: "Original Topic", value: video.topic_id ? `\`${video.topic_id}\`` : "None" });
    if (video.topic_id !== sugTopic)
      body.push({ name: "Suggested Topic", value: sugTopic ? `\`${sugTopic}\`` : "None" });
  }
  if (sugMentions !== null || r.includes("mentions")) {
    body.push({ name: "Original Mentions", value: idList(origMentions) });
    if (sugMentions !== null && sugMentions !== origMentions)
      body.push({ name: "Suggested Mentions", value: idList(sugMentions) });
  }
  body.push({ name: "Comments", value: comments || "No comment" });
  return body;
}

// The suggested-mentions editor: the loaded mentions, channels picked for removal, and a
// debounced channel search for additions.
function useMentionEditor(video: any) {
  const app = useAppState();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  // The mentions as loaded, only read when sending the report.
  const origMentions = useRef<any[]>([]);
  const [sugMentions, setSugMentions] = useState<any[] | null>(null);
  const [delSet, setDelSet] = useState<Set<string>>(new Set());
  const { useEnglishName } = app.settings;
  const vidChId = video?.channel?.id;

  const options = useMemo(() => results.map((i) => i.id), [results]);
  const byId = useMemo(() => new Map(results.map((i) => [i.id, i])), [results]);
  const labels = useMemo(
    () => new Map(results.map((i) => [i.id, channelDisplayName(i, useEnglishName)])),
    [results, useEnglishName],
  );

  const debouncedSearch = useMemo(
    () =>
      debounce((v: string) => {
        if (!v) {
          setResults([]);
          return;
        }
        api
          .searchChannel({ type: CHANNEL_TYPES.VTUBER, queryText: v })
          .then(({ data }: any) => {
            setResults(
              data.filter(
                (d: any) => !(vidChId === d.id || sugMentions?.find((m) => m.id === d.id)),
              ),
            );
          })
          .catch(console.error);
      }, 400),
    [vidChId, sugMentions],
  );

  useEffect(() => {
    debouncedSearch(search);
    return () => debouncedSearch.cancel();
  }, [search, debouncedSearch]);

  function reset() {
    setSugMentions(null);
    setSearch("");
    setResults([]);
    setDelSet(new Set());
  }

  function load() {
    if (!video || sugMentions !== null) return;
    api
      .getMentions(video.id)
      .then(({ data }: any) => {
        origMentions.current = data;
        setSugMentions(data);
      })
      .catch(console.error);
  }

  function remove(ch: any) {
    setSugMentions((p) => (p || []).filter((m) => m.id !== ch.id));
    setDelSet((p) => {
      const n = new Set(p);
      n.delete(ch.id);
      return n;
    });
  }

  function add(ch: any) {
    setSugMentions((p) => (p?.find((m) => m.id === ch.id) ? p : [...(p || []), ch]));
    setResults([]);
    setSearch("");
  }

  const mark = (id: string) => setDelSet((p) => new Set(p).add(id));
  const unmark = (id: string) =>
    setDelSet((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
  const toggleAll = () =>
    setDelSet((p) =>
      p.size === sugMentions?.length ? new Set() : new Set((sugMentions || []).map((m) => m.id)),
    );

  function applyDelete() {
    const ids = delSet;
    if (!ids.size) return;
    setSugMentions((p) => (p || []).filter((m) => !ids.has(m.id)));
    setDelSet(new Set());
    setResults([]);
    setSearch("");
  }

  return {
    search,
    setSearch,
    options,
    byId,
    labels,
    origMentions,
    sugMentions,
    delSet,
    allSelected: !!sugMentions?.length && delSet.size === sugMentions.length,
    reset,
    load,
    add,
    remove,
    mark,
    unmark,
    toggleAll,
    applyDelete,
  };
}

type MentionEditor = ReturnType<typeof useMentionEditor>;

function MentionOverlay({ editor, id }: { editor: MentionEditor; id: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {editor.delSet.has(id) ? (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            editor.unmark(id);
          }}
        >
          <icons.Trash2 className="size-5" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="absolute inset-0 h-full w-full rounded-full p-0"
          onClick={(e) => {
            e.stopPropagation();
            editor.mark(id);
          }}
        />
      )}
    </div>
  );
}

function MentionSuggestions({ editor }: { editor: MentionEditor }) {
  const t = useTranslations();
  const mentions = editor.sugMentions || [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={editor.applyDelete}>
          <icons.SaveAll className="size-5" />
          {t("component.reportDialog.applyChanges")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={editor.toggleAll}>
          {editor.allSelected ? (
            <icons.Square className="size-5" />
          ) : (
            <icons.CheckSquare className="size-5" />
          )}
          {editor.allSelected
            ? t("component.reportDialog.deselectAll")
            : t("component.reportDialog.selectAll")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {mentions.map((item) => (
          <ChannelChip key={item.id} channel={item} size={60} closeDelay={0}>
            {() => <MentionOverlay editor={editor} id={item.id} />}
          </ChannelChip>
        ))}
      </div>
      <Combobox
        items={editor.options}
        value=""
        inputValue={editor.search}
        filter={null}
        itemToStringLabel={(i) => editor.labels.get(i) || i}
        onInputValueChange={editor.setSearch}
        onValueChange={(id) => {
          const c = editor.byId.get(id);
          if (c) editor.add(c);
        }}
      >
        <ComboboxInput
          placeholder={t("component.reportDialog.adjustMentionedChannels")}
          showClear={!!editor.search}
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {editor.search.trim().length < 2
              ? t("component.search.typeTwoCharacters")
              : t("component.search.noChannelsFound")}
          </ComboboxEmpty>
          <ComboboxList>
            {(item: string, i: number) => (
              <ComboboxItem key={item} value={item} index={i}>
                {editor.labels.get(item) || item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <div className="flex flex-wrap gap-2">
        {mentions.map((s) => (
          <div
            key={`${s.id}chip`}
            className="flex items-center gap-2 rounded-full border px-3 py-1.5"
          >
            <ChannelChip channel={s} size={40} />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("component.common.remove")}
              onClick={(e) => {
                e.stopPropagation();
                editor.remove(s);
              }}
            >
              <icons.XIcon className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicSuggestion({
  currentTopic,
  value,
  topics,
  onOpen,
  onChange,
}: {
  currentTopic?: string;
  value: string | false;
  topics: any[];
  onOpen: () => void;
  onChange: (value: string | false) => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {t("component.search.type.topic")}
        <span className="ml-2 text-primary">{currentTopic || t("component.form.none")}</span>
      </div>
      <Select
        value={value || "__unset__"}
        onOpenChange={(o) => {
          if (o) onOpen();
        }}
        onValueChange={(v) => onChange(v === "__unset__" ? false : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unset__">
            {t("component.reportDialog.topicUnsetPlaceholder")}
          </SelectItem>
          {topics.map((tp) => (
            <SelectItem key={tp.value} value={tp.value}>
              {tp.text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ReasonChecklist({
  reasons,
  selected,
  onToggle,
}: {
  reasons: Reason[];
  selected: Set<string>;
  onToggle: (value: string, checked: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      {reasons.map((r) => (
        <Label key={r.value} className="items-start rounded-md border p-3 text-sm">
          <Checkbox
            checked={selected.has(r.value)}
            onCheckedChange={(c) => onToggle(r.value, c === true)}
          />
          <span>{r.text}</span>
        </Label>
      ))}
    </div>
  );
}

function ChannelWarning({ readMore, onReadMore }: { readMore: boolean; onReadMore: () => void }) {
  const t = useTranslations();
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
          <Button
            type="button"
            variant="link"
            className="mt-2 h-auto p-0 underline"
            onClick={onReadMore}
          >
            {t("component.comment.readMore")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

function ReportAlerts({
  error,
  isCollab,
  orgName,
}: {
  error: boolean;
  isCollab: boolean;
  orgName: string;
}) {
  const t = useTranslations();
  return (
    <>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{t("component.form.error")}</AlertDescription>
        </Alert>
      ) : null}
      {isCollab ? (
        <Alert>
          <AlertDescription>
            {t("component.reportDialog.collabing", { org: orgName })}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

function OrgFilterSuggestion() {
  const t = useTranslations();
  return (
    <div className="space-y-2">
      <div className="text-sm text-primary">{t("component.reportDialog.consider")}</div>
      <VideoListFilters
        placeholderFilter={false}
        topicFilter={false}
        missingFilter={false}
        upcomingFilter={false}
      />
    </div>
  );
}

// Comments, the block-channel shortcut and the dialog buttons.
function ReportFooter({
  channel,
  comments,
  onComments,
  onClose,
  onSend,
}: {
  channel: any;
  comments: string;
  onComments: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const t = useTranslations();
  return (
    <>
      <div className="space-y-2">
        <Label>{t("component.reportDialog.comments")}</Label>
        <Textarea
          value={comments}
          className="min-h-32"
          onChange={(e) => onComments(e.target.value)}
        />
        <div className="text-xs text-muted-foreground">
          {t("component.reportDialog.commentLanguagesOk")}
        </div>
      </div>
      <Separator />
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <ChannelSocials channel={channel} showDelete hideYt vertical className="inline-block" />
        <icons.ArrowLeft className="h-4 w-4" />
        <span>{t("component.channelSocials.block")}</span>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("views.app.close_btn")}
        </Button>
        <Button type="button" className="ml-auto" disabled={!comments.length} onClick={onSend}>
          {t("views.multiview.confirmOverwriteYes")}
        </Button>
      </div>
    </>
  );
}

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
  const mentions = useMentionEditor(video);
  const isHome = pathname === "/";
  const isCollab = video
    ? !filterVideo(video, app, { forOrg: app.currentOrg.name, hideCollabs: true })
    : false;
  const collabsHidden = app.settings.hideCollabStreams;

  const reasonList = useMemo(
    () => reportReasons(t, video?.type, app.currentOrg.name),
    [video?.type, app.currentOrg.name, t],
  );
  const selectedReasons = new Set(reasons);
  const filteredReasons = reasonList.filter((r) => reasonApplies(r, video, app.currentOrg, isHome));
  const showOrgFilters = reasons.includes(ORG_REASON) && !collabsHidden && video?.type !== "clip";

  function close() {
    app.setReportVideo(null);
    setSugTopic(false);
    mentions.reset();
    setReasons([]);
    setComments("");
  }

  function toggleReason(v: string, checked: boolean) {
    setReasons((p) => (checked ? [...new Set([...p, v])] : p.filter((i) => i !== v)));
    if (v.includes("mention") && mentions.sugMentions === null) mentions.load();
  }

  async function loadTopics() {
    if (topics.length) return;
    setTopics(await fetchTopicOptions());
  }

  function sendReport() {
    if (!video) return;
    const body = reportBody({
      reasons,
      video,
      sugTopic,
      origMentions: mentions.origMentions.current,
      sugMentions: mentions.sugMentions,
      comments,
    });
    api
      .reportVideo(video.id, body, app.userdata?.jwt || "")
      .then(() => {
        close();
        toast.success(t("component.reportDialog.success"));
        setError(false);
      })
      .catch((e) => {
        console.error(e);
        setError(true);
      });
  }

  return (
    <div>
      <Dialog
        open={!!video}
        onOpenChange={(o) => {
          if (!o) close();
        }}
      >
        <DialogContent className="max-w-[500px]">
          {video ? (
            <div className="space-y-4">
              <DialogTitle>{t("component.reportDialog.title")}</DialogTitle>
              <ReportAlerts error={error} isCollab={isCollab} orgName={app.currentOrg.name} />
              <div className="text-sm text-foreground">
                <div>{video.title}</div>
                <div className="text-muted-foreground">{video.channel?.name}</div>
              </div>
              <ReasonChecklist
                reasons={filteredReasons}
                selected={selectedReasons}
                onToggle={toggleReason}
              />
              {reasons.includes(TOPIC_REASON) ? (
                <TopicSuggestion
                  currentTopic={video?.topic_id}
                  value={sugTopic}
                  topics={topics}
                  onOpen={() => void loadTopics()}
                  onChange={setSugTopic}
                />
              ) : null}
              {reasons.includes(MENTIONS_REASON) ? <MentionSuggestions editor={mentions} /> : null}
              {showOrgFilters ? <OrgFilterSuggestion /> : null}
              {video?.channel?.id === WARNED_CHANNEL_ID ? (
                <ChannelWarning readMore={readMore} onReadMore={() => setReadMore(true)} />
              ) : null}
              <ReportFooter
                channel={video.channel}
                comments={comments}
                onComments={setComments}
                onClose={close}
                onSend={sendReport}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
