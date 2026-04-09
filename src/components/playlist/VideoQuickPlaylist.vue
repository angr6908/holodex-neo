<template>
  <div class="flex flex-col gap-1">
    <button
      v-for="(p,idx) in playlistState"
      :key="p.id + p.name"
      type="button"
      class="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8"
      :class="{ 'bg-emerald-500/12 text-emerald-100': p.contains }"
      @click.stop="toggle(p, idx)"
    >
      <span>{{ p.name }}</span>
      <span
        v-if="p.loading"
        class="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import backendApi from "@/utils/backend-api";
import { usePlaylistStore } from "@/stores/playlist";
import { useAppStore } from "@/stores/app";

defineOptions({ name: "VideoQuickPlaylist" });

const props = defineProps<{
  videoId: string;
  video: Record<string, any>;
}>();

const playlistStore = usePlaylistStore();
const appStore = useAppStore();

const playlistState = ref<any[]>([]);

onMounted(async () => {
  const jwt = appStore.userdata?.jwt;
  if (jwt) {
    const playlists = await backendApi.getPlaylistState(props.videoId, jwt);
    playlistState.value.push(...playlists.data);
  }
  const activeIdx = playlistState.value.findIndex((p) => p.id === playlistStore.active.id);
  if (activeIdx >= 0) {
    playlistState.value.splice(activeIdx, 1);
  }
  playlistState.value.unshift({
    id: playlistStore.active.id,
    active: true,
    name: playlistStore.active.name,
    contains: playlistStore.contains(props.videoId),
  });
});

async function toggle(playlist: any, index: number) {
  const { id, active, contains } = playlistState.value[index];

  if (active) {
    if (contains) playlistStore.removeVideoByID(props.videoId);
    else playlistStore.addVideo(props.video);
  } else {
    playlistState.value[index].loading = true;
    const jwt = appStore.userdata?.jwt;
    if (contains) await backendApi.deleteVideoFromPlaylist(props.videoId, id, jwt);
    else await backendApi.addVideoToPlaylist(props.videoId, id, jwt);
    playlistState.value[index].loading = false;
  }

  playlistState.value[index].contains = !contains;
}
</script>
