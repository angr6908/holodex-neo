<template>
  <div>
    <UiDialog
      :open="!!showReportDialog"
      class-name="max-w-[500px]"
      @update:open="showReportDialog = $event"
    >
      <UiCard v-if="video" class-name="border-0 p-0 shadow-none">
        <div class="space-y-4 p-5">
          <div class="text-xl font-semibold text-[color:var(--color-foreground)]">
            {{ $t("component.reportDialog.title") }}
          </div>

          <div v-if="error" class="rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm text-red-100">
            Error Occurred
          </div>
          <div v-if="isCollab" class="rounded-xl border border-sky-400/20 bg-sky-500/15 px-3 py-2 text-sm text-sky-100">
            {{ $t("component.reportDialog.collabing", {org: appStore.currentOrg.name }) }}
          </div>

          <div class="text-sm text-[color:var(--color-foreground)]">
            <div>{{ video.title }}</div>
            <div class="text-[color:var(--color-muted-foreground)]">
              {{ video.channel.name }}
            </div>
          </div>

          <div class="space-y-2">
            <label
              v-for="reason in filteredReasons()"
              :key="reason.value"
              class="flex items-start gap-3 rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-sm text-[color:var(--color-foreground)]"
            >
              <input
                v-model="selectedReasons"
                type="checkbox"
                :value="reason.value"
                class="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-950/80"
                @change="reason.value.includes('mention') && suggestedMentions === null ? loadMentions() : null"
              >
              <span>{{ reason.text }}</span>
            </label>
          </div>

          <div v-if="selectedReasons.includes('Incorrect video topic')" class="space-y-2">
            <div class="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">
              {{ $t("component.search.type.topic") }}
              <span class="ml-2 text-[color:var(--color-primary)]">{{ video.topic_id || "None" }}</span>
            </div>
            <select
              v-model="suggestedTopic"
              class="w-full rounded-xl border border-white/12 bg-slate-950/70 px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none"
              @focus="loadTopics"
            >
              <option :value="false">
                Suggest new topic (leave empty to unset)
              </option>
              <option v-for="topic in topics" :key="topic.value" :value="topic.value">
                {{ topic.text }}
              </option>
            </select>
          </div>

          <div v-if="selectedReasons.includes('Incorrect channel mentions')" class="space-y-3">
            <div class="flex flex-wrap gap-2">
              <UiButton
                type="button"
                variant="outline"
                size="sm"
                @click="applyDeleteMentions()"
              >
                <UiIcon v-if="!isApplyingBulkEdit" :icon="icons.mdiContentSaveEdit" />
                <span v-else>...</span>
                Apply Changes
              </UiButton>
              <UiButton
                type="button"
                variant="ghost"
                size="sm"
                @click="toggleMentionSelection()"
              >
                <UiIcon :icon="isSelectedAll ? icons.mdiSelectOff : icons.mdiSelectAll" />
                {{ isSelectedAll ? "Deselect All" : "Select All" }}
              </UiButton>
            </div>

            <div class="flex flex-wrap gap-2">
              <ChannelChip
                v-for="item in suggestedMentions"
                :key="item.id"
                :channel="item"
                :size="60"
                :close-delay="0"
              >
                <template #default>
                  <div
                    class="absolute inset-0 flex items-center justify-center"
                    :class="isAddedToDeletionSet(item.id) ? 'bg-slate-950/70' : 'bg-transparent'"
                  >
                    <UiButton
                      v-if="isAddedToDeletionSet(item.id)"
                      type="button"
                      size="icon"
                      variant="ghost"
                      @click.stop.prevent="removeChannelFromDeletionSet(item.id)"
                    >
                      <UiIcon :icon="icons.mdiDelete" />
                    </UiButton>
                    <button
                      v-else
                      type="button"
                      class="absolute inset-0"
                      @click.stop.prevent="addChannelToDeletionSet(item.id)"
                    />
                  </div>
                </template>
              </ChannelChip>
            </div>

            <div ref="mentionRoot" class="relative">
              <UiInput
                v-model="search"
                placeholder="Adjust Mentioned Channels"
                @focus="mentionsMenuOpen = true"
              />
              <div
                v-if="mentionsMenuOpen && searchResults.length"
                class="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-xl border border-white/10 bg-slate-950/96 shadow-2xl shadow-slate-950/40"
              >
                <button
                  v-for="dropdownItem in searchResults"
                  :key="dropdownItem.id"
                  type="button"
                  class="block w-full px-4 py-3 text-left text-sm text-[color:var(--color-foreground)] transition hover:bg-white/6"
                  @click.stop="addMention(dropdownItem)"
                >
                  {{ getChannelName(dropdownItem) }}
                </button>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <div
                v-for="selection in suggestedMentions"
                :key="`${selection.id}chip`"
                class="flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5"
              >
                <ChannelChip :channel="selection" :size="40" />
                <button type="button" @click.stop.prevent="deleteMention(selection)">
                  <UiIcon :icon="icons.mdiClose" class-name="h-4 w-4 text-[color:var(--color-primary)]" />
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="selectedReasons.includes('This video does not belong to the org')
              && !collabsAlreadyHidden
              && video.type !== 'clip'"
            class="space-y-2"
          >
            <div class="text-sm text-[color:var(--color-primary)]">
              {{ $t('component.reportDialog.consider') }}
            </div>
            <VideoListFilters :placeholder-filter="false" :topic-filter="false" :missing-filter="false" />
          </div>

          <div
            v-if="video.channel.id === 'UCF4-I8ZQL6Aa-iHfdz-B9KQ'"
            class="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-sm text-red-100"
          >
            <b>Note: Please don't report just because you disagree / dislike this subber.</b>
            <div v-if="readMore" class="mt-2 space-y-2">
              <p>
                Holodex platform doesn't arbitrate between sub-par and good TLs. For minor issues, you
                should feedback changes to the subber on youtube via comments, or else reporting them to
                whoever they're clipping (Cover or Nijisanji etc.).
              </p>
              <p>
                However, if the video in question is indeed dangerously translated to cause
                misunderstandings, we will definitely either delete the video or deplatform the channel,
                in addition to escalating to relevant organizations.
              </p>
              <p>
                If you'd like to not see this channel ever again, there's a
                <b>Block Channel</b> button below, and on the channel page.
              </p>
            </div>
            <button
              v-else
              type="button"
              class="mt-2 underline"
              @click.stop="readMore = true"
            >
              Read more...
            </button>
          </div>

          <div class="space-y-2">
            <label class="text-sm text-[color:var(--color-muted-foreground)]">{{ $t('component.reportDialog.comments') }}</label>
            <textarea
              v-model="comments"
              class="min-h-32 w-full rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none"
            />
            <div class="text-xs text-[color:var(--color-muted-foreground)]">
              * English / 日本語 / 繁體中文 OK
            </div>
          </div>

          <div class="h-px bg-white/10" />
          <div class="flex items-center gap-3 text-sm text-[color:var(--color-muted-foreground)]">
            <ChannelSocials
              :channel="video.channel"
              show-delete
              hide-yt
              vertical
              class="inline-block"
            />
            <UiIcon :icon="icons.mdiArrowLeft" class-name="h-4 w-4" />
            <span>{{ $t("component.channelSocials.block") }}</span>
          </div>

          <div class="flex items-center gap-3">
            <UiButton type="button" variant="ghost" @click="showReportDialog = false">
              {{ $t("views.app.close_btn") }}
            </UiButton>
            <UiButton
              type="button"
              class-name="ml-auto"
              :disabled="comments.length === 0"
              @click="sendReport"
            >
              {{ $t("views.multiview.confirmOverwriteYes") }}
            </UiButton>
          </div>
        </div>
      </UiCard>
    </UiDialog>

    <div
      v-if="showSnackbar"
      class="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-400/25 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100 shadow-xl"
    >
      <div class="flex items-center gap-3">
        <span>{{ $t("component.reportDialog.success") }}</span>
        <UiButton
          type="button"
          variant="ghost"
          size="sm"
          @click="showSnackbar = false"
        >
          {{ $t("views.app.close_btn") }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import backendApi from "@/utils/backend-api";
import ChannelChip from "@/components/channel/ChannelChip.vue";
import ChannelSocials from "@/components/channel/ChannelSocials.vue";
import { useFilterVideos } from "@/composables/useFilterVideos";
import debounce from "lodash-es/debounce";
import { CHANNEL_TYPES } from "@/utils/consts";
import VideoListFilters from "@/components/setting/VideoListFilters.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";

defineOptions({ name: "ReportDialog" });

const route = useRoute();
const { t } = useI18n();
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const { filterVideos: filterVideosFn } = useFilterVideos();

const mentionRoot = ref<HTMLElement | null>(null);
const selectedReasons = ref<string[]>([]);
const comments = ref("");
const isLoading = ref(false);
const showSnackbar = ref(false);
const error = ref(false);
const readMore = ref(false);
const topics = ref<any[]>([]);
const suggestedTopic = ref<string | false>(false);
const search = ref("");
const searchResults = ref<any[]>([]);
const originalMentions = ref<any[]>([]);
const suggestedMentions = ref<any[] | null>(null);
// Using reactive Set so mutations are tracked without needing $forceUpdate
const deletionSet = reactive(new Set<string>());
const isSelectedAll = ref(false);
const isApplyingBulkEdit = ref(false);
const collabsAlreadyHidden = ref(settingsStore.hideCollabStreams);
const mentionsMenuOpen = ref(false);

const video = computed(() => appStore.reportVideo);

const currentOrg = computed(() => appStore.currentOrg);

const isCollab = computed(() =>
  !filterVideosFn(video.value, { hideCollabs: true }),
);

const showReportDialog = computed({
  get() { return appStore.reportVideo; },
  set(val: any) {
    if (!val) appStore.setReportVideo(null);
    suggestedTopic.value = false;
    suggestedMentions.value = null;
    search.value = "";
    searchResults.value = [];
    selectedReasons.value = [];
    comments.value = "";
    mentionsMenuOpen.value = false;
  },
});

const reasons = computed(() => {
  const vtype = video.value?.type === "stream" ? "video" : video.value?.type;
  return [
    { text: t("component.reportDialog.reasons[4]"), value: "Incorrect video topic", types: ["stream", "placeholder"], orgRequired: false },
    { text: t("component.reportDialog.reasons[5]"), value: "Incorrect channel mentions", types: null, orgRequired: false },
    { text: t("component.reportDialog.reasons[6]", [vtype, currentOrg.value.name]), value: "This video does not belong to the org", types: null, orgRequired: true },
    { text: t("component.reportDialog.reasons[1]"), value: "Low Quality/Misleading Content", types: ["clip"], orgRequired: false },
    { text: t("component.reportDialog.reasons[2]"), value: "Violates the org's derivative work guidelines or inappropriate", types: ["clip"], orgRequired: false },
    { text: t("component.reportDialog.reasons[3]"), value: "Other", types: null, orgRequired: false },
  ];
});

const debouncedSearch = debounce(() => {
  if (!search.value) {
    searchResults.value = [];
    return;
  }
  backendApi
    .searchChannel({ type: CHANNEL_TYPES.VTUBER, queryText: search.value })
    .then(({ data }: any) => {
      searchResults.value = data.filter(
        (d: any) => !(video.value?.channel.id === d.id || suggestedMentions.value?.find((m) => m.id === d.id)),
      );
      mentionsMenuOpen.value = true;
    });
}, 400);

watch(search, debouncedSearch);

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleOutsideClick);
});

function handleOutsideClick(event: MouseEvent) {
  if (!mentionRoot.value?.contains(event.target as Node)) {
    mentionsMenuOpen.value = false;
  }
}

function filteredReasons() {
  return reasons.value.filter((reason) => {
    if (reason.orgRequired && ((!currentOrg.value || currentOrg.value.name === "All Vtubers" || currentOrg.value.name === video.value?.channel.org) || route.name !== "home")) return false;
    if (reason.types && !reason.types.includes(video.value?.type)) return false;
    return true;
  });
}

function sendReport() {
  isLoading.value = true;
  const commentField = { name: "Comments", value: comments.value ? comments.value : "No comment" };
  const reasonString = selectedReasons.value.join("\n");
  const thisTopic = video.value.topic_id;
  const fieldBody: any[] = [{ name: "Reason", value: reasonString }];
  if (suggestedTopic.value !== false || reasonString.includes("topic")) {
    fieldBody.push({ name: "Original Topic", value: thisTopic ? `\`${thisTopic}\`` : "None" });
    if (thisTopic !== suggestedTopic.value) {
      fieldBody.push({ name: "Suggested Topic", value: suggestedTopic.value ? `\`${suggestedTopic.value}\`` : "None" });
    }
  }
  if (suggestedMentions.value !== null || reasonString.includes("mentions")) {
    fieldBody.push({
      name: "Original Mentions",
      value: originalMentions.value?.length > 0 ? originalMentions.value.map((m) => `\`${m.id}\``).join("\n") : "None",
    });
    if (suggestedMentions.value !== null && suggestedMentions.value !== originalMentions.value) {
      fieldBody.push({
        name: "Suggested Mentions",
        value: suggestedMentions.value?.length > 0 ? suggestedMentions.value.map((m) => `\`${m.id}\``).join("\n") : "None",
      });
    }
  }
  fieldBody.push(commentField);
  backendApi.reportVideo(video.value.id, fieldBody, appStore.userdata?.jwt)
    .then(() => {
      showReportDialog.value = false;
      showSnackbar.value = true;
      error.value = false;
    })
    .catch((e: any) => {
      console.error(e);
      error.value = true;
    })
    .finally(() => {
      isLoading.value = false;
    });
}

function getChannelName(channel: any) {
  const prop = settingsStore.nameProperty;
  return channel[prop] || channel.name;
}

function isAddedToDeletionSet(id: string) {
  return deletionSet.has(id);
}

function addChannelToDeletionSet(id: string) {
  deletionSet.add(id);
  if (deletionSet.size === suggestedMentions.value?.length) isSelectedAll.value = true;
}

function removeChannelFromDeletionSet(id: string) {
  deletionSet.delete(id);
  if (deletionSet.size === 0) isSelectedAll.value = false;
}

function toggleMentionSelection() {
  isSelectedAll.value = !isSelectedAll.value;
  if (isSelectedAll.value) {
    suggestedMentions.value?.forEach((mention) => deletionSet.add(mention.id));
  } else {
    deletionSet.clear();
  }
}

function loadMentions() {
  if (suggestedMentions.value !== null) return originalMentions.value;
  backendApi.getMentions(video.value.id).then(({ data }: any) => {
    originalMentions.value = data;
    updateMentions(data);
  }).catch((e: any) => console.error(e));
  return originalMentions.value;
}

async function loadTopics() {
  if (topics.value.length > 0) return;
  topics.value = (await backendApi.topics()).data.map((topic: any) => ({
    value: topic.id,
    text: `${topic.id} (${topic.count ?? 0})`,
  }));
}

function updateMentions(data: any[] | null = null) {
  if (data) suggestedMentions.value = data;
  searchResults.value = [];
  search.value = "";
  mentionsMenuOpen.value = false;
}

function deleteMention(channel: any) {
  removeChannelFromDeletionSet(channel.id);
  suggestedMentions.value = suggestedMentions.value!.filter((mention) => mention.id !== channel.id);
  updateMentions();
}

function addMention(channel: any) {
  if (!suggestedMentions.value!.find((mention) => mention.id === channel.id)) {
    suggestedMentions.value!.push(channel);
  }
  updateMentions();
}

function applyDeleteMentions() {
  isApplyingBulkEdit.value = true;
  const ids = Array.from(deletionSet);
  if (ids.length === 0) {
    isApplyingBulkEdit.value = false;
    return;
  }
  suggestedMentions.value = suggestedMentions.value!.filter((mention) => !ids.includes(mention.id));
  deletionSet.clear();
  isSelectedAll.value = false;
  updateMentions();
  isApplyingBulkEdit.value = false;
}
</script>
