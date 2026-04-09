<template>
  <UiCard class-name="watch-card striped rounded-none p-4">
    <div v-if="errorMessage && showErrorAlert" class="mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {{ errorMessage }}
    </div>
    <div v-if="successMessage && showSuccessAlert" class="mb-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
      {{ successMessage }}
    </div>

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <UiButton
            type="button"
            variant="secondary"
            size="sm"
            :disabled="isApplyingBulkEdit"
            @click.stop.prevent="applyDeleteMentions()"
          >
            <UiIcon v-if="!isApplyingBulkEdit" :icon="icons.mdiContentSaveEdit" />
            <span v-else class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Apply Changes
          </UiButton>

          <UiButton
            type="button"
            variant="ghost"
            size="sm"
            @click.stop.prevent="toggleMentionSelection()"
          >
            <UiIcon :icon="isSelectedAll ? icons.mdiSelectOff : icons.mdiSelectAll" />
            {{ isSelectedAll ? "Deselect All" : "Select All" }}
          </UiButton>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <template v-for="item in mentions" :key="item.id">
            <div class="relative">
              <ChannelChip
                :channel="item"
                :size="60"
                :close-delay="0"
              >
                <template #default>
                  <div
                    class="absolute inset-0 flex items-center justify-center rounded-full"
                    :class="isAddedToDeletionSet(item.id) ? 'bg-rose-950/70' : 'bg-slate-950/0 hover:bg-slate-950/40'"
                  >
                    <UiButton
                      type="button"
                      size="icon"
                      variant="ghost"
                      class-name="h-8 w-8"
                      @click.stop.prevent="toggleDeletion(item.id)"
                    >
                      <UiIcon :icon="isAddedToDeletionSet(item.id) ? icons.mdiDelete : icons.mdiPlusBox" />
                    </UiButton>
                  </div>
                </template>
              </ChannelChip>
            </div>
          </template>
        </div>

        <div class="mt-4">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Add Mentioned Channels
          </label>
          <UiInput
            v-model="search"
            placeholder="Search VTubers to mention"
            class-name="min-w-[300px] max-w-xl"
          />

          <div v-if="searchResults.length" class="mt-2 max-w-xl rounded-2xl border border-white/10 bg-slate-950/80 p-2">
            <button
              v-for="item in searchResults"
              :key="item.id"
              type="button"
              class="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8"
              @click.stop="addMention(item)"
            >
              {{ getChannelName(item) }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="video.type === 'stream' || video.type === 'placeholder'"
        class="min-w-[260px] max-w-sm flex-1 rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        <div class="mb-2 flex items-center gap-2 text-slate-300">
          <UiIcon :icon="icons.mdiAnimationPlay" />
          <span class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ $t("component.search.type.topic") }}</span>
        </div>
        <div class="mb-3 text-sm text-sky-300">
          {{ currentTopic || "Unset" }}
        </div>
        <UiInput
          v-model="newTopic"
          list="quick-editor-topics"
          placeholder="Topic (leave empty to unset)"
          @focus="loadTopics"
        />
        <datalist id="quick-editor-topics">
          <option v-for="topic in filteredTopics" :key="topic.value" :value="topic.value">
            {{ topic.text }}
          </option>
        </datalist>
        <UiButton
          type="button"
          size="sm"
          class-name="mt-3"
          @click="saveTopic"
        >
          <UiIcon :icon="mdiContentSave" />
          Save Topic
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import ChannelChip from "@/components/channel/ChannelChip.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import { mdiContentSave } from "@mdi/js";
import backendApi from "@/utils/backend-api";
import { CHANNEL_TYPES } from "@/utils/consts";
import debounce from "lodash-es/debounce";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";

defineOptions({ name: "WatchQuickEditor" });

const props = defineProps<{
  video: Record<string, any>;
}>();

const appStore = useAppStore();
const settingsStore = useSettingsStore();

const mentions = ref<any[]>([]);
const search = ref("");
const searchResults = ref<any[]>([]);
const fake = ref<any[] | null>([]);

const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const topics = ref<any[]>([]);
const newTopic = ref<string | null>(null);
const currentTopic = ref<string | null>(null);
const isSelectedAll = ref(false);
const isApplyingBulkEdit = ref(false);
const deletionSet = ref(new Set<string>());
const isLoading = ref(false);

const updateTrigger = ref(0);

const filteredTopics = computed(() => {
  if (!newTopic.value) return topics.value;
  return topics.value.filter((topic: any) => topicFilter(null, newTopic.value!, topic.text));
});

const debouncedSearch = debounce(() => {
  if (!search.value) {
    searchResults.value = [];
    return;
  }
  backendApi
    .searchChannel({
      type: CHANNEL_TYPES.VTUBER,
      queryText: search.value,
    })
    .then(({ data }: any) => {
      searchResults.value = data.filter(
        (d: any) => !(
          props.video.channel.id === d.id
          || mentions.value.find((m) => m.id === d.id)
        ),
      );
    });
}, 400);

watch(search, () => {
  debouncedSearch();
});

watch(fake, (nv) => {
  if (nv && nv.length && nv.length > 0) {
    addMention(nv[0]);
    fake.value = null;
  }
});

onMounted(() => {
  updateMentions();
  updateCurrentTopic();
});

function updateCurrentTopic() {
  backendApi.getVideoTopic(props.video.id).then(({ data }: any) => {
    currentTopic.value = data.topic_id;
    newTopic.value = data.topic_id;
  });
}

function updateMentions() {
  backendApi
    .getMentions(props.video.id)
    .then(({ data }: any) => {
      mentions.value = data;
      searchResults.value = [];
      search.value = "";
    })
    .catch((e: any) => {
      console.error(e);
    });
}

function getChannelName(channel: any) {
  const prop = settingsStore.nameProperty;
  return channel[prop] || channel.name;
}

function isAddedToDeletionSet(id: string) {
  void updateTrigger.value;
  return deletionSet.value.has(id);
}

function addChannelToDeletionSet(id: string) {
  deletionSet.value.add(id);
  if (deletionSet.value.size === mentions.value.length) {
    isSelectedAll.value = true;
  }
  updateTrigger.value++;
}

function removeChannelFromDeletionSet(id: string) {
  deletionSet.value.delete(id);
  if (deletionSet.value.size === 0) {
    isSelectedAll.value = false;
  }
  updateTrigger.value++;
}

function toggleDeletion(id: string) {
  if (isAddedToDeletionSet(id)) removeChannelFromDeletionSet(id);
  else addChannelToDeletionSet(id);
}

function toggleMentionSelection() {
  isSelectedAll.value = !isSelectedAll.value;
  if (isSelectedAll.value) {
    mentions.value.forEach((mention) => deletionSet.value.add(mention.id));
  } else {
    deletionSet.value.clear();
  }
  updateTrigger.value++;
}

function applyDeleteMentions() {
  isApplyingBulkEdit.value = true;
  const ids = Array.from(deletionSet.value);
  if (ids.length === 0) {
    isApplyingBulkEdit.value = false;
    return;
  }

  backendApi
    .deleteMentions(props.video.id, ids, appStore.userdata.jwt)
    .then(({ data }: any) => {
      if (!data) return;
      deletionSet.value.clear();
      isSelectedAll.value = false;
      showSuccess("Successfully deleted mention");
      updateMentions();
    })
    .catch((e: any) => {
      showError(
        (e.response && e.response.data.message)
          || e.message
          || "Error occured",
      );
    })
    .finally(() => {
      isApplyingBulkEdit.value = false;
      updateTrigger.value++;
    });
}

function addMention(channel: any) {
  isLoading.value = true;
  backendApi
    .addMention(props.video.id, channel.id, appStore.userdata.jwt)
    .then(({ data }: any) => {
      if (!data) return;
      showSuccess(`Added channel: ${getChannelName(channel)}`);
      updateMentions();
    })
    .catch((e: any) => {
      showError(
        (e.response && e.response.data.message)
          || e.message
          || "Error occured",
      );
    });
}

function showError(message: string) {
  errorMessage.value = message;
  showErrorAlert.value = true;
  setTimeout(() => {
    showErrorAlert.value = false;
  }, 4000);
}

function showSuccess(message: string) {
  showSuccessAlert.value = true;
  successMessage.value = message;
  setTimeout(() => {
    showSuccessAlert.value = false;
  }, 4000);
}

async function loadTopics() {
  if (topics.value.length > 0) return;
  topics.value = (await backendApi.topics()).data.map((topic: any) => ({
    value: topic.id,
    text: `${topic.id} (${topic.count ?? 0})`,
  }));
}

function saveTopic() {
  backendApi.topicSet(
    newTopic.value,
    props.video.id,
    appStore.userdata.jwt,
  ).then(() => {
    currentTopic.value = newTopic.value;
    showSuccess(`Updated Topic to ${newTopic.value}`);
  });
}

function topicFilter(_: any, queryText: string, itemText: string) {
  return itemText.toString().replace(/\s+/g, "_").toLocaleLowerCase()
    .indexOf(queryText.toString().replace(/\s+/g, "_").toLocaleLowerCase()) > -1;
}
</script>

<style>
.watch-card {
  border: none !important;
  box-shadow: none !important;
}

.theme--dark .striped,
.striped {
  background: repeating-linear-gradient(
    45deg,
    rgb(255 255 255 / 0.02),
    rgb(255 255 255 / 0.02) 10px,
    rgb(255 255 255 / 0.04) 10px,
    rgb(255 255 255 / 0.04) 20px
  );
}
</style>
