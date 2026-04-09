<template>
  <section class="mx-auto max-w-5xl px-2 py-4">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-[color:var(--color-foreground)]">
        {{ $t("views.playlist.page-heading") }}
      </h1>
      <p class="text-sm text-[color:var(--color-muted-foreground)]">
        {{ $t("views.playlist.page-instruction") }}
      </p>
    </div>

    <UiCard
      id="new-playlist-btn"
      class-name="my-4 cursor-pointer border-2 border-dashed border-sky-400/35 bg-transparent p-4 opacity-80 transition hover:border-sky-300/60 hover:bg-white/4"
      @click.stop="createNewPlaylist"
    >
      <div class="flex items-start gap-4">
        <div class="hidden h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/12 text-sky-200 sm:flex">
          <UiIcon :icon="icons.mdiPlaylistPlus" class-name="h-7 w-7" />
        </div>
        <div class="min-w-0">
          <div class="text-sm font-semibold text-[color:var(--color-foreground)]">
            {{ $t("views.playlist.new-playlist-btn-label") }}
          </div>
          <div v-if="!jwt" class="mt-1 text-xs text-[color:var(--color-muted-foreground)]">
            {{ $t("views.playlist.login-prompt") }}
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard
      v-for="playlist in playlists"
      :key="'plst' + playlist.id + playlist.name"
      class-name="my-4 cursor-pointer border border-white/10 p-4 transition hover:border-sky-300/40 hover:bg-white/4"
      :class="playlist.id === active.id ? 'active-playlist' : 'inactive-playlist'"
      @click.stop="setNewPlaylist(playlist)"
    >
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex min-w-0 gap-4">
          <div class="hidden h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-[color:var(--color-muted-foreground)] sm:flex">
            <UiIcon :icon="mdiFormatListText" class-name="h-7 w-7" />
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="truncate text-base font-semibold text-[color:var(--color-foreground)]">
                {{ playlist.name }}
              </span>
              <UiBadge
                v-if="playlist.id === active.id && !isSaved"
                variant="secondary"
                class-name="playlist-unsaved-badge border-amber-400/30 bg-amber-400/15"
              >
                {{ $t("views.playlist.playlist-is-modified") }}
              </UiBadge>
            </div>
            <div
              v-show="playlist.updated_at"
              class="mt-1 text-xs text-[color:var(--color-muted-foreground)]"
            >
              <span class="hidden sm:inline">{{ $t("views.playlist.item-last-updated") }}</span>
              {{ toTime(playlist.updated_at) }}
            </div>
          </div>
        </div>

        <div class="group">
          <img
            v-for="id in getPlaylistPreview(playlist)"
            :key="`vid${id}thumb`"
            :src="imageSrc(id)"
            class="preview-img stack"
          >
        </div>
      </div>
    </UiCard>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import backendApi from "@/utils/backend-api";
import { localizedDayjs } from "@/utils/time";
import { mdiFormatListText } from "@mdi/js";
import { getVideoThumbnails } from "@/utils/functions";
import { usePlaylistStore } from "@/stores/playlist";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import UiBadge from "@/components/ui/badge/Badge.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { useMetaTitle } from "@/composables/useMetaTitle";

const { t } = useI18n();
useMetaTitle(() => `${t("component.mainNav.playlist")} - Holodex`);

const router = useRouter();
const playlistStore = usePlaylistStore();
const appStore = useAppStore();
const settingsStore = useSettingsStore();

const serverside = ref<any[]>([]);
const jwt = computed(() => appStore.userdata.jwt);
const isMobile = computed(() => appStore.isMobile);
const active = computed(() => playlistStore.active);
const isSaved = computed(() => playlistStore.isSaved);

const playlists = computed(() => {
  if (!active.value.id) return [active.value, ...serverside.value];
  return serverside.value;
});

watch(isSaved, async (newval) => {
  if (newval) {
    serverside.value = (await backendApi.getPlaylistList(jwt.value)).data;
  }
});

async function load() {
  try {
    if (jwt.value) {
      serverside.value = (await backendApi.getPlaylistList(jwt.value)).data;
    }
  } catch {
    serverside.value = [];
  }
}

function toTime(ts: string) {
  return localizedDayjs(ts, settingsStore.langSetting).format("LLL");
}

function imageSrc(id: string) {
  return getVideoThumbnails(id, false).medium;
}

function confirmIfNotSaved() {
  return isSaved.value || confirm(t("views.playlist.change-loss-warning"));
}

function setNewPlaylist(playlist: any) {
  if (playlist.id === active.value.id) return;
  if (confirmIfNotSaved()) {
    playlistStore.setActivePlaylistByID(playlist.id);
  }
}

function getPlaylistPreview(playlist: any) {
  const limit = isMobile.value ? 1 : 4;
  if (playlist.video_ids) return playlist.video_ids.slice(0, limit);
  if (playlist.videos) return playlist.videos.slice(0, limit).map(({ id }: any) => id);
  return [];
}

function createNewPlaylist() {
  if (!jwt.value) {
    router.push("/user");
    return;
  }
  if (confirmIfNotSaved()) {
    playlistStore.resetPlaylist();
    playlistStore.modified();
  }
}

load();
</script>
<style scoped>
.active-playlist {
    position: relative;
    left: -1px;
    top: -1px;
    border: 2px solid color-mix(in srgb, var(--color-primary) 80%, white 20%) !important;
}
.inactive-playlist:hover {
    position: relative;
    left: -0.5px;
    top: -0.5px;
    border: 1px solid color-mix(in srgb, var(--color-primary) 80%, white 20%) !important;
}

.playlist-unsaved-badge {
    color: #f8fafc;
}

:global(html[data-theme="light"] .playlist-unsaved-badge) {
    color: #020617;
}

/* Layout */
.group {
    position: relative;
    width: 240px;
    height: 90px;
    flex-shrink: 0;
}

.stack {
    display: block;
    width: 150px;
    height: 90px;
    border: 1px solid black;
    border-radius: 5px;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.9);
    position: absolute;
    transition: top 0.5s ease-out;
    top: 0px;
}

.stack:nth-child(2) {
    left: 25px;
}
.stack:nth-child(3) {
    left: 50px;
}
.stack:nth-child(4) {
    left: 75px;
}

.stack:hover {
    z-index: 2;
    top: -4px !important;
}

.group:hover .stack {
    top: 10px;
}

@media (max-width: 640px) {
    .group {
        width: 150px;
    }

    .stack:nth-child(2),
    .stack:nth-child(3),
    .stack:nth-child(4) {
        left: 0;
    }
}
</style>
