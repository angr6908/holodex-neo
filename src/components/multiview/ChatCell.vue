<template>
  <div class="cell-content">
    <div ref="selectorRoot" class="flex items-center gap-1 border-b border-white/10 px-1 py-0.5">
      <UiButton
        type="button"
        size="icon"
        variant="ghost"
        class-name="h-7 w-7 rounded-lg"
        :disabled="currentTab <= 0"
        @click="currentTab -= 1"
      >
        <UiIcon :icon="icons.mdiChevronLeft" size="sm" />
      </UiButton>

      <div class="relative min-w-0 flex-1">
        <UiButton
          type="button"
          variant="outline"
          class-name="tabbed-chat-select h-8 w-full justify-between rounded-xl border-white/10 bg-slate-950 px-3 text-sm text-white"
          @click="selectorOpen = !selectorOpen"
        >
          <span class="truncate">{{ currentChannelLabel }}</span>
          <UiIcon :icon="icons.mdiMenuDown" size="sm" class-name="text-slate-400" />
        </UiButton>

        <UiCard
          v-if="selectorOpen"
          class-name="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-slate-950/85 backdrop-blur-none"
        >
          <UiScrollArea
            class-name="max-h-56"
            viewport-class-name="max-h-56"
            content-class-name="grid gap-1"
          >
            <button
              v-for="channel in channels"
              :key="channel.value"
              type="button"
              class="flex w-full items-center justify-between rounded-xl border border-transparent bg-slate-900 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-800"
              :class="{ 'border-sky-400/40 bg-sky-400/12 text-white': currentTab === channel.value }"
              @click="selectChannel(channel.value)"
            >
              <span class="truncate">{{ channel.text }}</span>
              <span v-if="currentTab === channel.value" class="text-sky-300">✓</span>
            </button>
          </UiScrollArea>
        </UiCard>
      </div>

      <UiButton
        type="button"
        size="icon"
        variant="ghost"
        class-name="h-7 w-7 rounded-lg"
        :disabled="currentTab >= activeVideos.length - 1"
        @click="currentTab += 1"
      >
        <UiIcon :icon="icons.mdiChevronRight" size="sm" />
      </UiButton>
    </div>

    <div class="chat-stage min-h-0 flex-1">
      <template v-if="currentVideo && currentTab >= 0">
        <iframe
          v-if="currentVideo.type === 'twitch'"
          :src="twitchChatLink"
          class="h-full w-full"
          frameborder="0"
        />
        <WatchLiveChat
          v-else
          :key="'wlc' + currentVideo.id"
          v-model="chatStatus"
          :video="currentVideo"
          fluid
          :scale="scale"
          :current-time="currentTime"
          :use-local-subtitle-toggle="true"
          @videoUpdate="handleVideoUpdate"
        />
      </template>
      <div v-else class="h-full" />
    </div>

    <div v-if="!editMode" class="chat-btns flex shrink-0">
      <UiButton
        type="button"
        size="sm"
        variant="secondary"
        class-name="h-7 min-w-0 flex-1 rounded-none px-2 text-xs"
        @click="editMode = !editMode"
      >
        <UiIcon :icon="icons.mdiPencil" size="sm" class-name="mr-1" />
        <template v-if="cellWidth > 200">
          {{ $t("component.videoCard.edit") }}
        </template>
      </UiButton>
      <UiButton
        type="button"
        size="sm"
        :variant="showYtChat ? 'default' : 'ghost'"
        class-name="h-7 w-1/4 rounded-none px-2 text-xs"
        @click="toggleYtChat"
      >
        <UiIcon :icon="icons.ytChat" size="sm" class-name="mr-1" />
        <template v-if="cellWidth > 200">
          Chat
        </template>
      </UiButton>
      <UiButton
        type="button"
        size="sm"
        :variant="showTlChat ? 'default' : 'ghost'"
        class-name="h-7 w-1/4 rounded-none px-2 text-xs"
        @click="toggleTlChat"
      >
        <UiIcon :icon="icons.tlChat" size="sm" class-name="mr-1" />
        <template v-if="cellWidth > 200">
          TL
        </template>
      </UiButton>
    </div>

    <CellControl
      v-else
      :play-icon="icons.mdiCheck"
      @playpause="editMode = false"
      @back="resetCell"
      @delete="deleteCell"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import WatchLiveChat from "@/components/watch/WatchLiveChat.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import CellControl from "./CellControl.vue";
import { useMultiviewCell, type CellItem } from "@/composables/useMultiviewCell";
import { useMultiviewStore } from "@/stores/multiview";
import { useSettingsStore } from "@/stores/settings";

defineOptions({ name: "ChatCell" });

const props = defineProps<{
  item: CellItem;
  cellWidth?: number;
  tl?: boolean;
}>();

const emit = defineEmits<{
  (e: "delete", id: string): void;
}>();

const multiviewStore = useMultiviewStore();
const settingsStore = useSettingsStore();

const { cellContent, editMode, activeVideos, resetCell, deleteCell } = useMultiviewCell(props.item, emit);

const showTlChat = ref(props.tl ?? false);
const showYtChat = ref(!props.tl);
const scale = ref(1);
const selectorOpen = ref(false);
const selectorRoot = ref<HTMLElement | null>(null);

const chatStatus = computed({
  get() {
    return {
      showTlChat: showTlChat.value,
      showYtChat: showYtChat.value,
    };
  },
  set(val: any) {
    showTlChat.value = val.showTlChat;
    showYtChat.value = val.showYtChat;
  },
});

const layoutContent = computed(() => multiviewStore.layoutContent);

const currentTab = computed({
  get() {
    return layoutContent.value[props.item.i]?.currentTab ?? 0;
  },
  set(value: number) {
    multiviewStore.setLayoutContentWithKey({
      id: props.item.i,
      key: "currentTab",
      value,
    });
  },
});

const currentVideo = computed(() => {
  if (!activeVideos.value.length || currentTab.value >= activeVideos.value.length) return null;
  return activeVideos.value[currentTab.value] || activeVideos.value[0];
});

const twitchChatLink = computed(() => {
  return `https://www.twitch.tv/embed/${currentVideo.value!.id}/chat?parent=${
    window.location.hostname
  }${settingsStore.darkMode ? "&darkpopout" : ""}`;
});

const channels = computed(() => {
  return activeVideos.value.map((video: any, index: number) => ({
    text: video.channel[settingsStore.nameProperty] || video.channel.name,
    value: index,
  }));
});

const currentChannelLabel = computed(() => {
  return channels.value.find((channel: any) => channel.value === currentTab.value)?.text || "";
});

const videoCellId = computed(() => {
  return Object.keys(layoutContent.value).find((key) => layoutContent.value[key]?.video === currentVideo.value);
});

const currentTime = computed(() => {
  return videoCellId.value ? (layoutContent.value[videoCellId.value]?.currentTime || 0) : 0;
});

function checkScale() {
  scale.value = 1;
}

function selectChannel(value: number) {
  currentTab.value = value;
  selectorOpen.value = false;
}

function handleWindowClick(event: MouseEvent) {
  if (selectorOpen.value && selectorRoot.value && !selectorRoot.value.contains(event.target as Node)) {
    selectorOpen.value = false;
  }
}

function toggleYtChat() {
  showYtChat.value = !showYtChat.value;
  if (!showYtChat.value) showTlChat.value = true;
}

function toggleTlChat() {
  showTlChat.value = !showTlChat.value;
  if (!showTlChat.value) showYtChat.value = true;
}

function handleVideoUpdate(update: any) {
  if (!videoCellId.value || !layoutContent.value[videoCellId.value]?.video) return;
  const v = layoutContent.value[videoCellId.value].video;
  if (v.id !== update.id || !update?.status || !update?.start_actual) return;
  if (v.status !== update.status || v.start_actual !== update.start_actual) {
    multiviewStore.setLayoutContentWithKey({
      id: videoCellId.value,
      key: "video",
      value: { ...v, ...update },
    });
  }
}

watch(() => props.cellWidth, () => {
  checkScale();
});

watch(cellContent, (nw) => {
  if (nw?.type === "chat") {
    editMode.value = false;
  }
});

// created
editMode.value = false;
checkScale();

onMounted(() => {
  window.addEventListener("click", handleWindowClick);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", handleWindowClick);
});
</script>

<style>
.tabbed-chat-select {
  min-width: 0;
}

.chat-stage {
  min-height: 0;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.chat-stage .watch-live-chat {
  min-height: 0 !important;
  min-width: 0;
  width: 100%;
  height: 100%;
}

.chat-stage .embedded-chat {
  min-height: 0;
  min-width: 0;
  width: 100%;
  flex: 1 1 auto;
}

.chat-btns {
  display: flex;
  min-height: 26px;
}
</style>
