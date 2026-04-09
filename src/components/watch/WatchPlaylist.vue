<template>
  <div class="mb-2">
    <UiCard class-name="rounded-none p-0 shadow-none">
      <template v-if="playlist">
        <div class="flex items-start justify-between gap-3 px-4 py-4">
          <div>
            <div class="text-base font-semibold text-white">
              {{ playlist.name }}
            </div>
            <div class="pt-1 text-sm text-slate-400">
              {{ value + 1 }}/{{ videos.length }}
            </div>
          </div>
          <UiButton
            type="button"
            size="icon"
            title="Next video"
            @click="nextVideo"
          >
            <UiIcon :icon="icons.mdiArrowLeft" class-name="rotate-180" />
          </UiButton>
        </div>
        <div class="border-t border-white/10" />
        <VirtualVideoCardList
          :videos="videos"
          :playlist="playlist"
          include-channel
          horizontal
          ignore-block
          :active-index="value"
          :style="{ height: Math.min(videos.length, 6) * 102 + 'px' }"
        />
      </template>
      <div v-if="hasError" class="px-4 py-4 text-sm text-rose-300">
        Error loading playlist, does it exist?
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import VirtualVideoCardList from "@/components/video/VirtualVideoCardList.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { useWatchStore } from "@/stores/watch";
import { usePlaylistStore } from "@/stores/playlist";
import backendApi from "@/utils/backend-api";

defineOptions({ name: "WatchPlaylist" });

const props = withDefaults(defineProps<{
  value?: number;
  currentTime?: number;
}>(), {
  value: 0,
  currentTime: 0,
});

const emit = defineEmits<{
  (e: "input", index: number): void;
  (e: "playNext", payload: { video: any }): void;
}>();

const route = useRoute();
const watchStore = useWatchStore();
const playlistStore = usePlaylistStore();

const isLoading = ref(false);
const hasError = ref(false);
const playlist = ref<any>(undefined);

const video = computed(() => watchStore.video);
const active = computed(() => playlistStore.active);
const videos = computed(() => (playlist.value && playlist.value.videos) || []);

function updateCurrentIndex() {
  const currentId = video.value.id;
  const newIndex = videos.value.findIndex(({ id }: any) => id === currentId);
  emit("input", newIndex);
}

function nextVideo() {
  if (videos.value[props.value + 1]) emit("input", props.value + 1);
}

function loadPlaylist(playlistId: string) {
  if (playlistId === active.value.id || playlistId === "local") {
    playlist.value = active.value;
    updateCurrentIndex();
    return;
  }
  isLoading.value = true;
  backendApi
    .getPlaylist(playlistId)
    .then(({ data }: any) => {
      playlist.value = data;
      updateCurrentIndex();
    })
    .catch((e: any) => {
      console.error(e);
      hasError.value = true;
    })
    .finally(() => {
      isLoading.value = false;
    });
}

watch(() => props.value, (nw) => {
  if (
    !videos.value.length
    || videos.value.length === nw
    || nw === -1
    || route.params.id === videos.value[nw].id
  ) {
    return;
  }
  emit("playNext", { video: videos.value[nw] });
});

watch(video, () => {
  updateCurrentIndex();
});

onMounted(() => {
  if (!route.query.playlist) return;
  updateCurrentIndex();
  loadPlaylist(route.query.playlist as string);
});
</script>
