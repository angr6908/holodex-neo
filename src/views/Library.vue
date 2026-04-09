<template>
  <section class="space-y-4">
    <div>
      <div class="mb-2 text-xl font-semibold text-[color:var(--color-foreground)]">
        {{ $t("views.library.savedVideosTitle") }}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UiButton type="button" variant="secondary" @click="showReset ? reset() : selectAll()">
          {{ showReset ? $t("views.library.selectionReset") : $t("views.library.selectionSelectAll") }}
        </UiButton>
        <UiButton
          v-if="!showReset"
          type="button"
          variant="secondary"
          @click="select(50)"
        >
          {{ $t("views.library.selectionSelect50") }}
        </UiButton>

        <div class="relative">
          <UiButton type="button" @click="exportMenuOpen = !exportMenuOpen">
            {{ $t("views.library.exportSelected", [selected.length]) }}
          </UiButton>
          <div v-if="exportMenuOpen" class="absolute left-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-xl border border-white/10 bg-slate-950/96 shadow-2xl shadow-slate-950/40">
            <button type="button" class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[color:var(--color-foreground)] hover:bg-white/6" @click.stop="instructionsDialog = true; exportMenuOpen = false">
              <UiIcon :icon="icons.mdiYoutube" class-name="h-4 w-4" />
              {{ $t("views.library.exportYtPlaylist") }}
            </button>
            <button type="button" class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[color:var(--color-foreground)] hover:bg-white/6" @click.stop="downloadAsCSV(); exportMenuOpen = false">
              <UiIcon :icon="mdiFileTable" class-name="h-4 w-4" />
              {{ $t("views.library.exportCsv") }}
            </button>
          </div>
        </div>
        <UiButton
          type="button"
          variant="destructive"
          @click="deleteDialog = true"
        >
          {{ $t("views.library.deleteFromLibraryButton", [selected.length]) }}
        </UiButton>
        <UiDialog :open="deleteDialog" class-name="max-w-[290px]" @update:open="deleteDialog = $event">
          <UiCard class-name="space-y-4 p-4">
            <div class="text-base font-semibold text-[color:var(--color-foreground)]">
              {{ $t("views.library.deleteConfirmation", [selected.length]) }}
            </div>
            <div class="flex justify-end gap-2">
              <UiButton type="button" variant="ghost" @click="deleteDialog = false">
                {{ $t("views.library.deleteConfirmationCancel") }}
              </UiButton>
              <UiButton
                type="button"
                variant="destructive"
                @click="
                  deleteDialog = false;
                  deleteSelected();
                "
              >
                {{ $t("views.library.deleteConfirmationOK") }}
              </UiButton>
            </div>
          </UiCard>
        </UiDialog>

        <!-- <div class="d-inline-block"> -->
        <UiSelect
          v-model="sortModel"
          :options="sortby"
          class-name="rounded-xl border border-white/12 bg-slate-950/70 text-sm"
        />
      </div>
    </div>
    <generic-list-loader
      v-if="savedVideosList.length > 0"
      v-slot="{ data }"
      :key="'vl-home-' + sortModel + '=' + savedVideosList.length"
      :paginate="true"
      :per-page="50"
      :load-fn="getLoadFn()"
    >
      <VideoCardList
        :videos="data"
        horizontal
        include-channel
        dense
      >
        <template #action="prop">
          <input
            v-model="selected"
            type="checkbox"
            :value="prop.video.id"
            class="h-4 w-4 rounded border-white/20 bg-slate-950/80"
            @click.prevent.stop
          >
        </template>
      </VideoCardList>
    </generic-list-loader>
    <div v-else class="text-center">
      {{ $t("views.library.emptyLibrary") }}
    </div>
    <UiDialog :open="instructionsDialog" :class-name="isMobile ? 'max-w-[90%]' : 'max-w-[60vw]'" @update:open="instructionsDialog = $event">
      <UiCard class-name="space-y-4 p-4">
        <div class="text-lg font-semibold text-[color:var(--color-foreground)]">
          {{ $t("views.library.exportYTHeading") }}
        </div>
        <div class="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <p v-html="$t('views.library.exportYTExplanation')" />
            <br>

            <br>
            <p v-html="$t('views.library.exportYTInstructions')" />
            <UiButton type="button" class-name="mt-2 mr-2" @click="exportSelected">
              {{ $t("views.library.createYtPlaylistButton", [selected.length]) }}
            </UiButton>
            <UiButton
              type="button"
              variant="ghost"
              class-name="mt-2"
              @click="instructionsDialog = false"
            >
              {{ $t("views.library.deleteConfirmationCancel") }}
            </UiButton>
          </div>
          <div>
            <img src="/img/playlist-instruction.jpg">
          </div>
        </div>
      </UiCard>
    </UiDialog>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import { useMetaTitle } from "@/composables/useMetaTitle";
import VideoCardList from "@/components/video/VideoCardList.vue";
import { mdiFileTable } from "@mdi/js";
import { json2csvAsync } from "json-2-csv";
import GenericListLoader from "@/components/video/GenericListLoader.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiSelect from "@/components/ui/select/Select.vue";
import * as icons from "@/utils/icons";

defineOptions({ name: "Library" });

const { t } = useI18n();
const appStore = useAppStore();

useMetaTitle(() => `${t("component.mainNav.library")} - Holodex`);

const SORT_OPTIONS = [
  { cat: "added_at", asc: -1 },
  { cat: "added_at", asc: 1 },
  { cat: "available_at", asc: -1 },
  { cat: "available_at", asc: 1 },
];

// Legacy library store no longer exists; savedVideos is kept as local state
const savedVideos = ref<Record<string, any>>({});

const selected = ref<string[]>([]);
const deleteDialog = ref(false);
const instructionsDialog = ref(false);
const exportMenuOpen = ref(false);
const sortModel = ref(0);

const isMobile = computed(() => appStore.isMobile);

const sortby = [
  { label: t("views.library.sort.dateaddedLatestFirst"), value: 0 },
  { label: t("views.library.sort.dateaddedEarliestFirst"), value: 1 },
  { label: t("views.library.sort.dateuploadedLatestFirst"), value: 2 },
  { label: t("views.library.sort.dateuploadedEarliestFirst"), value: 3 },
];

// Computed
const savedVideosList = computed(() => {
  const sortStyle = SORT_OPTIONS[sortModel.value];
  return Object.values(savedVideos.value).sort((a: any, b: any) => {
    const dateA = new Date(a[sortStyle.cat]).getTime();
    const dateB = new Date(b[sortStyle.cat]).getTime();
    return dateA > dateB ? 1 * sortStyle.asc : -1 * sortStyle.asc;
  });
});

const showReset = computed(() => selected.value.length !== 0);

// Methods
function selectAll() {
  selected.value = savedVideosList.value.map((v: any) => v.id);
}

function select(n: number) {
  selected.value = savedVideosList.value.slice(0, n).map((v: any) => v.id);
}

function reset() {
  selected.value = [];
}

function deleteSelected() {
  selected.value.forEach((id) => {
    delete savedVideos.value[id];
  });
  reset();
}

function exportSelected() {
  if (selected.value.length === 0) return;
  const url = `https://www.youtube.com/watch_videos?video_ids=${selected.value.join(",")}`;
  window.open(url, "_blank", "noopener");
  reset();
}

async function downloadAsCSV() {
  const selectedSet = new Set(selected.value);
  const csvString = await json2csvAsync(savedVideosList.value.filter((v: any) => selectedSet.has(v.id)));
  const a = document.createElement("a");
  const timestamp = new Date().toISOString().replace("T", "_").slice(0, 19);
  a.href = `data:attachment/csv,${encodeURIComponent(csvString)}`;
  a.target = "_blank";
  a.download = `holodexPlaylist_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
}

function getLoadFn() {
  return async (offset: number, limit: number) => {
    const res = {
      total: savedVideosList.value.length,
      items: savedVideosList.value.slice(offset, offset + limit),
    };
    return res;
  };
}
</script>

<style></style>
