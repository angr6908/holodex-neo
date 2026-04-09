<template>
  <div class="watch-toolbar relative z-[40] flex justify-between gap-2 border-b border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur-xl lg:px-4">
    <UiButton
      v-if="!noBackButton"
      type="button"
      size="icon"
      variant="ghost"
      @click="goBack()"
    >
      <UiIcon :icon="mdiArrowLeft" />
    </UiButton>

    <div class="watch-btn-group ml-auto flex items-center gap-2">
      <slot name="buttons" />

      <UiButton
        type="button"
        size="icon"
        variant="ghost"
        title="Reload Video Frame"
        @click="reloadVideo()"
      >
        <UiIcon :icon="icons.mdiRefresh" />
      </UiButton>

      <UiButton
        type="button"
        size="icon"
        :variant="hasSaved ? 'default' : 'ghost'"
        :title="hasSaved ? $t('views.watch.removeFromPlaylist') : $t('views.watch.saveToPlaylist')"
        @click="toggleSaved"
      >
        <UiIcon :icon="hasSaved ? icons.mdiCheck : icons.mdiPlusBox" />
      </UiButton>

      <div ref="menuRoot" class="relative">
        <UiButton
          type="button"
          size="icon"
          variant="ghost"
          title="More actions"
          @click="toggleMenu"
        >
          <UiIcon :icon="icons.mdiDotsVertical" />
        </UiButton>

        <teleport to="body">
          <div
            v-if="menuOpen"
            class="fixed inset-0 z-[500]"
            @click.stop="menuOpen = false"
          >
            <div
              class="absolute w-56 rounded-2xl border border-white/10 bg-slate-950/96 p-2 shadow-2xl shadow-slate-950/60 backdrop-blur-xl"
              :style="menuPosition"
              @click.stop
            >
              <video-card-menu :video="video" @closeMenu="menuOpen = false" />
            </div>
          </div>
        </teleport>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { mdiArrowLeft } from "@mdi/js";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import VideoCardMenu from "@/components/common/VideoCardMenu.vue";
import { usePlaylistStore } from "@/stores/playlist";

defineOptions({ name: "WatchToolbar" });

const props = withDefaults(defineProps<{
  video: Record<string, any>;
  noBackButton?: boolean;
}>(), {
  noBackButton: false,
});

const router = useRouter();
const playlistStore = usePlaylistStore();

const menuOpen = ref(false);
const menuX = ref(0);
const menuY = ref(0);

const hasSaved = computed(() => playlistStore.contains(props.video.id));

const menuPosition = computed(() => {
  const menuWidth = 224; // w-56
  const menuHeight = 420;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = menuX.value - menuWidth;
  let y = menuY.value + 8;
  if (x < 8) x = 8;
  if (x + menuWidth > vw - 8) x = vw - menuWidth - 8;
  if (y + menuHeight > vh - 8) y = menuY.value - menuHeight - 8;
  if (y < 8) y = 8;
  return { left: `${x}px`, top: `${y}px` };
});

function toggleMenu(event: MouseEvent) {
  if (!menuOpen.value) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    menuX.value = rect.right;
    menuY.value = rect.bottom;
  }
  menuOpen.value = !menuOpen.value;
}

function toggleSaved() {
  if (hasSaved.value) {
    playlistStore.removeVideoByID(props.video.id);
  } else {
    playlistStore.addVideo(props.video);
  }
}

function goBack() {
  router.go(-1);
}

function reloadVideo() {
  const curr = document.querySelector("[id^=\"youtube-player\"]") as HTMLIFrameElement;
  curr.contentWindow!.location.replace(curr.src);
}
</script>
