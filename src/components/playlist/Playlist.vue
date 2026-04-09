<template>
  <div class="w-full">
    <div class="mb-1 flex items-center gap-2 text-base font-medium">
      <UiInput
        v-if="editNameMode"
        v-model="playlistName"
        class-name="flex-1"
        autofocus
        @keydown.enter="editNameMode = false"
      />
      <div v-else class="flex min-w-0 flex-1 items-center gap-2 text-xl font-semibold text-white">
        <span class="truncate">{{ playlist.name }}</span>
        <UiButton
          v-show="isEditable"
          type="button"
          size="icon"
          variant="ghost"
          class-name="ml-auto h-8 w-8"
          @click="editNameMode = true"
        >
          <UiIcon :icon="icons.mdiPencil" size="sm" />
        </UiButton>
      </div>

      <UiButton
        v-show="!isSaved"
        type="button"
        size="icon"
        class-name="h-8 w-8"
        @click="trySaving"
      >
        <UiIcon :icon="mdiContentSave" size="sm" />
      </UiButton>

      <div ref="menuRoot" class="relative">
        <UiButton
          type="button"
          size="icon"
          variant="ghost"
          class-name="h-8 w-8"
          @click="menuOpen = !menuOpen"
        >
          <UiIcon :icon="icons.mdiDotsVertical" size="sm" />
        </UiButton>

        <UiCard
          v-if="menuOpen"
          class-name="absolute right-0 top-full z-[90] mt-2 min-w-[18rem] border border-white/10 p-2"
        >
          <button
            v-if="isEditable"
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8"
            @click="menuOpen = false; $emit('new-playlist')"
          >
            <UiIcon :icon="icons.mdiPlusBox" class-name="text-emerald-400" />
            {{ $t("component.playlist.menu.new-playlist") }}
          </button>
          <button
            v-if="isEditable"
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8"
            @click="menuOpen = false; editNameMode = true"
          >
            <UiIcon :icon="icons.mdiPencil" />
            {{ $t("component.playlist.menu.rename-playlist") }}
          </button>
          <button
            v-if="isEditable"
            type="button"
            :disabled="isSaved || !playlist.id"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
            @click="menuOpen = false; playlistStore.setActivePlaylistByID(playlist.id)"
          >
            <UiIcon :icon="icons.mdiRefresh" />
            {{ $t("component.playlist.menu.reset-unsaved") }}
          </button>

          <div class="my-2 h-px bg-white/10" />

          <div class="px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
            {{ $t("component.playlist.menu.export-playlist") }}
          </div>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8"
            @click="menuOpen = false; instructionsDialog = true"
          >
            <UiIcon :icon="icons.mdiYoutube" />
            {{ $t("views.library.exportYtPlaylist") }}
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8"
            @click="menuOpen = false; downloadAsCSV()"
          >
            <UiIcon :icon="mdiFileDelimited" />
            {{ $t("views.library.exportCsv") }}
          </button>

          <div class="my-2 h-px bg-white/10" />

          <button
            v-if="isEditable"
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-white/8"
            @click="menuOpen = false; playlistStore.deleteActivePlaylist()"
          >
            <UiIcon :icon="icons.mdiDelete" />
            {{ playlist.id ? $t("component.playlist.menu.delete-playlist") : $t("component.playlist.menu.clear-playlist") }}
          </button>
        </UiCard>
      </div>
    </div>

    <div
      v-if="loginWarning"
      class="mb-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
    >
      <div class="flex items-center gap-3">
        <span>{{ $t("component.playlist.save-error-not-logged-in") }}</span>
        <UiButton
          type="button"
          variant="destructive"
          size="sm"
          class-name="ml-auto"
          @click="$router.push('/user'); loginWarning = false"
        >
          {{ $t("component.mainNav.login") }}
        </UiButton>
      </div>
    </div>

    <span class="mt-0 block text-right text-xs text-slate-500">
      {{ playlist.videos.length }} / {{ maxPlaylistCount }}
    </span>

    <VirtualVideoCardList
      :playlist="playlist"
      include-channel
      :horizontal="horizontal"
      active-playlist-item
      class="playlist-video-list"
    />

    <UiDialog
      :open="instructionsDialog"
      :class-name="appStore.isMobile ? 'max-w-[90%]' : 'max-w-[60vw]'"
      @update:open="instructionsDialog = $event"
    >
      <UiCard class-name="p-5">
        <div class="text-lg font-semibold text-white">
          {{ $t("views.library.exportYTHeading") }}
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
          <div class="text-sm text-slate-200">
            <p v-html="$t('views.library.exportYTExplanation')" />
            <br>
            <p v-html="$t('views.library.exportYTInstructions')" />
            <div class="mt-4 flex flex-wrap gap-2">
              <UiButton type="button" class-name="bg-emerald-600 text-white hover:brightness-110" @click="exportToYT">
                {{ $t("views.library.createYtPlaylistButton", [(playlist.videos || []).length]) }}
              </UiButton>
              <UiButton type="button" variant="ghost" @click="instructionsDialog = false">
                {{ $t("views.library.deleteConfirmationCancel") }}
              </UiButton>
            </div>
          </div>
          <img src="/img/playlist-instruction.jpg" alt="Playlist export instructions" class="max-w-full rounded-xl">
        </div>
      </UiCard>
    </UiDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, useTemplateRef } from "vue";
import VirtualVideoCardList from "@/components/video/VirtualVideoCardList.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import type { Playlist } from "@/utils/types";
import { json2csvAsync } from "json-2-csv";
import { mdiContentSave, mdiFileDelimited } from "@mdi/js";
import { MAX_PLAYLIST_LENGTH } from "@/utils/consts";
import { usePlaylistStore } from "@/stores/playlist";
import { useAppStore } from "@/stores/app";

defineOptions({ name: "Playlist" });

const props = defineProps<{
  playlist: Playlist;
  isEditable?: boolean;
  isSaved?: boolean;
  horizontal?: boolean;
}>();

defineEmits<{
  (e: "new-playlist"): void;
}>();

const playlistStore = usePlaylistStore();
const appStore = useAppStore();

const menuRoot = useTemplateRef<HTMLElement>("menuRoot");

const editNameMode = ref(false);
const instructionsDialog = ref(false);
const loginWarning = ref(false);
const maxPlaylistCount = MAX_PLAYLIST_LENGTH;
const menuOpen = ref(false);

const playlistName = computed({
  get() {
    return props.playlist.name;
  },
  set(v: string) {
    if (v && v.length > 0) playlistStore.setPlaylist({ ...props.playlist, name: v });
  },
});

function handleWindowClick(event: MouseEvent) {
  if (menuOpen.value && menuRoot.value && !menuRoot.value.contains(event.target as Node)) {
    menuOpen.value = false;
  }
}

async function downloadAsCSV() {
  const csvString = await json2csvAsync(props.playlist.videos);
  const a = document.createElement("a");
  const timestamp = new Date().toISOString().replace("T", "_").slice(0, 19);
  a.href = `data:attachment/csv,${encodeURIComponent(csvString)}`;
  a.target = "_blank";
  a.download = `holodexPlaylist_${props.playlist.name}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
}

function exportToYT() {
  if (!props.playlist.videos || props.playlist.videos.length === 0) return;
  const url = `https://www.youtube.com/watch_videos?video_ids=${props.playlist.videos.map((x) => x.id).join(",")}`;
  window.open(url, "_blank", "noopener");
}

function trySaving() {
  if (appStore.userdata.jwt) {
    playlistStore.saveActivePlaylist();
    editNameMode.value = false;
  } else {
    loginWarning.value = true;
  }
}

onMounted(() => {
  window.addEventListener("click", handleWindowClick);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", handleWindowClick);
});
</script>

<style lang="scss">
.playlist-video-list .video-card-item-actions {
    padding: 0 !important;
    margin: 0 !important;
}

.playlist-video-list .video-card:hover .video-card-item-actions {
    opacity: 1;
}

.playlist-video-list .video-card .video-card-item-actions {
    opacity: 0.2;
}

.playlist-video-list .video-card-item-actions button {
    padding: 1px 0 !important;
    margin: 0 !important;
    height: 22px !important;
    width: 22px !important;
    line-height: 20px;
}
</style>
