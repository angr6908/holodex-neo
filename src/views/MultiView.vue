<template>
  <div
    ref="fullscreen-content"
    :class="{ 'mobile-helpers': isMobile }"
    class="flex flex-col multiview"
  >
    <!-- Floating tool bar -->
    <MultiviewToolbar
      v-show="!collapseToolbar"
      v-model="collapseToolbar"
      :compact="isSmAndDown"
      :buttons="buttons"
    >
      <template #left>
        <div v-if="isXs" class="flex min-w-0 flex-1 items-center gap-2">
          <UiButton
            type="button"
            size="icon"
            variant="secondary"
            class-name="h-8 w-8 shrink-0 rounded-xl"
            @click="handleToolbarShowSelector"
          >
            <UiIcon :icon="mdiCardPlus" size="lg" />
          </UiButton>
          <VideoSelector horizontal compact @videoClicked="handleToolbarClick" />
        </div>
        <VideoSelector v-else horizontal @videoClicked="handleToolbarClick" />
      </template>
      <template #buttons>
        <!-- Media controls dropdown -->
        <div ref="mediaControlsRoot" class="relative">
          <UiButton
            type="button"
            size="icon"
            variant="secondary"
            class-name="mv-toolbar-button h-8 w-8 rounded-xl"
            :title="$t('views.multiview.mediaControls')"
            @click="showMediaControls = !showMediaControls"
          >
            <UiIcon :icon="mdiTuneVertical" class-name="text-orange-400" />
          </UiButton>
          <media-controls v-model="showMediaControls" />
        </div>

        <div ref="presetMenuRoot" class="relative">
          <UiButton
            type="button"
            size="icon"
            variant="secondary"
            class-name="mv-toolbar-button h-8 w-8 rounded-xl"
            title="Change layout preset"
            @click="showPresetSelectorMenu = !showPresetSelectorMenu"
          >
            <UiIcon :icon="icons.mdiGridLarge" />
          </UiButton>

          <UiCard
            v-if="showPresetSelectorMenu"
            class-name="absolute right-0 top-full z-[90] mt-2 border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-0 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <preset-selector
              @selected="handlePresetClicked"
            />
          </UiCard>
        </div>

        <!-- Reorder layout dropdown -->
        <div ref="reorderMenuRoot" class="relative">
          <UiButton
            type="button"
            size="icon"
            variant="secondary"
            class-name="mv-toolbar-button h-8 w-8 rounded-xl"
            :title="$t('views.multiview.reorderLayout')"
            @click="showReorderLayout = !showReorderLayout"
          >
            <UiIcon :icon="reorderIcon" />
          </UiButton>

          <UiCard
            v-if="showReorderLayout"
            class-name="absolute right-0 top-full z-[90] mt-2 border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-3 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <ReorderLayout :is-active="showReorderLayout" />
          </UiCard>
        </div>

        <!-- Save layout dropdown -->
        <div ref="presetEditorRoot" class="relative">
          <UiButton
            type="button"
            size="icon"
            variant="secondary"
            class-name="mv-toolbar-button h-8 w-8 rounded-xl"
            :title="$t('views.multiview.presetEditor.title')"
            @click="showPresetEditor = !showPresetEditor"
          >
            <UiIcon :icon="mdiContentSave" />
          </UiButton>

          <UiCard
            v-if="showPresetEditor"
            class-name="absolute right-0 top-full z-[90] mt-2 w-[min(92vw,22rem)] border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-4 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <PresetEditor
              :layout="layout"
              :content="layoutContent"
              @close="showPresetEditor = false"
            />
          </UiCard>
        </div>
      </template>
    </MultiviewToolbar>
    <!-- Floating button to open toolbar when collapsed -->
    <UiButton
      v-if="collapseToolbar"
      class="open-mv-toolbar-btn"
      type="button"
      size="icon"
      variant="secondary"
      @click="collapseToolbar = false"
    >
      <UiIcon :icon="icons.mdiChevronDown" />
    </UiButton>

    <div ref="gridStage" class="mv-stage">
      <div
        class="mv-stage-surface"
        :style="{ width: '100%', minWidth: '100%' }"
      >
        <!-- Multiview Cell Area Background -->
        <multiview-background
          :show-tips="layout.length === 0"
          :column-width="columnWidth"
          :row-height="rowHeight"
          :collapse-toolbar="collapseToolbar"
          :style="{
            'background-size': `${columnWidth}px ${rowHeight}px`,
          }"
        />

        <!-- Grid Layout -->
        <grid-layout
          class="mv-grid-layout"
          :layout="layout"
          :col-num="24"
          :row-height="gridRowHeight"
          :auto-size="false"
          is-draggable
          is-resizable
          :vertical-compact="false"
          :prevent-collision="true"
          :margin="[0, 0]"
          @layout-updated="onLayoutUpdated"
        >
          <grid-item
            v-for="item in layout"
            :key="'mvgrid' + item.i"
            :static="item.static"
            :x="item.x"
            :y="item.y"
            :w="item.w"
            :h="item.h"
            :i="item.i"
            :is-draggable="item.isDraggable !== false"
            :is-resizable="item.isResizable !== false"
            :style="{
              ...itemStyle(item),
              ...(showReorderLayout && {'pointer-events': 'none'})
            }"
          >
            <cell-container :item="item">
              <ChatCell
                v-if="layoutContent[item.i] && layoutContent[item.i].type === 'chat'"
                :item="item"
                :tl="layoutContent[item.i].initAsTL"
                :cell-width="itemPixelWidth(item)"
                @delete="handleDelete"
              />
              <VideoCell
                v-else-if="layoutContent[item.i] && layoutContent[item.i].type === 'video'"
                ref="videoCell"
                :item="item"
                @delete="handleDelete"
              />
              <EmptyCell
                v-else
                :item="item"
                @showSelector="showSelectorForId = item.i"
                @delete="handleDelete"
              />
            </cell-container>
          </grid-item>
        </grid-layout>
      </div>
    </div>

    <!-- Video Selector -->
    <UiDialog
      :open="showVideoSelector"
      class-name="w-[min(94vw,30rem)] sm:w-auto sm:max-w-[75vw]"
      @update:open="showVideoSelector = $event"
    >
      <VideoSelector :is-active="showVideoSelector" @videoClicked="handleVideoClicked" />
    </UiDialog>

    <LayoutChangePrompt
      v-model="overwriteDialog"
      :cancel-fn="overwriteCancel"
      :confirm-fn="overwriteConfirm"
      :default-overwrite="overwriteMerge"
      :layout-preview="overwriteLayoutPreview"
    />

    <MultiviewSyncBar v-if="showSyncBar" class="mt-auto" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, defineAsyncComponent, provide } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { GridLayout, GridItem } from "@/external/vue-grid-layout/src/components/index";
import MediaControls from "@/components/multiview/MediaControls.vue";
import EmptyCell from "@/components/multiview/EmptyCell.vue";
import VideoCell from "@/components/multiview/VideoCell.vue";
import ChatCell from "@/components/multiview/ChatCell.vue";
import CellContainer from "@/components/multiview/CellContainer.vue";
import PresetEditor from "@/components/multiview/PresetEditor.vue";
import PresetSelector from "@/components/multiview/PresetSelector.vue";
import MultiviewToolbar from "@/components/multiview/MultiviewToolbar.vue";
import LayoutChangePrompt from "@/components/multiview/LayoutChangePrompt.vue";
import VideoSelector from "@/components/multiview/VideoSelector.vue";
import MultiviewBackground from "@/components/multiview/MultiviewBackground.vue";
import ReorderLayout from "@/components/multiview/ReorderLayout.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import {
  mdiViewGridPlus, mdiCardPlus, mdiContentSave, mdiTuneVertical, mdiSync,
} from "@mdi/js";
import { decodeLayout, reorderIcon } from "@/utils/mv-utils";
import { useMultiviewStore } from "@/stores/multiview";
import { useAppStore } from "@/stores/app";
import { useMultiviewLayout } from "@/composables/useMultiviewLayout";
import { useMetaTitle } from "@/composables/useMetaTitle";
import api from "@/utils/backend-api";
import { TWITCH_VIDEO_URL_REGEX } from "@/utils/consts";
import * as icons from "@/utils/icons";

const MultiviewSyncBar = defineAsyncComponent(() => import("@/components/multiview/MultiviewSyncBar.vue"));

const FIXED_CHAT_CELL_WIDTH = 300;

const { t } = useI18n();
useMetaTitle(() => `${t("component.mainNav.multiview")} - Holodex`);

const route = useRoute();
const multiviewStore = useMultiviewStore();
const appStore = useAppStore();

const layout = computed(() => multiviewStore.layout);
const autoLayout = computed(() => multiviewStore.autoLayout);
const isMobile = computed(() => appStore.isMobile);
const {
  layoutContent,
  setMultiview, addVideoAutoLayout, addCellAutoLayout, deleteVideoAutoLayout,
  clearAllItems, addVideoWithId, findEmptyCell, tryFillVideo,
} = useMultiviewLayout(layout, autoLayout, isMobile);

// State
const showSelectorForId = ref(-1);
const showSyncBar = ref(false);
const showReorderLayout = ref(false);
const overwriteDialog = ref(false);
const overwriteCancel = ref<((merge: boolean) => void) | null>(null);
const overwriteConfirm = ref<((merge: boolean) => void) | null>(null);
const overwriteMerge = ref(false);
const overwriteLayoutPreview = ref<any>({});
const collapseToolbar = ref(false);
const stageWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1440);
const stageHeight = ref(typeof window !== "undefined" ? window.innerHeight : 900);
const showPresetSelectorMenu = ref(false);
const showPresetEditor = ref(false);
const showMediaControls = ref(false);

// Refs
const gridStage = ref<HTMLElement | null>(null);
const presetMenuRoot = ref<HTMLElement | null>(null);
const reorderMenuRoot = ref<HTMLElement | null>(null);
const presetEditorRoot = ref<HTMLElement | null>(null);
const mediaControlsRoot = ref<HTMLElement | null>(null);
const videoCell = ref<any[]>([]);
provide("videoCells", videoCell);
let stageResizeObserver: ResizeObserver | null = null;

// Computed
const showVideoSelector = computed({
  get: () => showSelectorForId.value !== -1,
  set: (open: boolean) => { if (!open) showSelectorForId.value = -1; },
});
const viewportWidth = computed(() => appStore.windowWidth || window.innerWidth || 1440);
const viewportHeight = computed(() => window.innerHeight || 900);
const isXs = computed(() => viewportWidth.value < 600);
const isSmAndDown = computed(() => viewportWidth.value < 960);
const isMdAndDown = computed(() => viewportWidth.value < 1264);
const rowHeight = computed(() => (stageHeight.value || viewportHeight.value) / 24.0);
const columnWidth = computed(() => (stageWidth.value || viewportWidth.value) / 24.0);
const chatColumnSpans = computed(() => {
  const baseStageWidth = stageWidth.value || viewportWidth.value || 0;
  const spans: any[] = [];
  const seen = new Set<string>();
  layout.value.forEach((item: any) => {
    if (layoutContent.value[item.i]?.type !== "chat" || !item.w) return;
    const key = `${item.x}:${item.w}`;
    if (seen.has(key)) return;
    seen.add(key);
    spans.push({ key, x: item.x, w: item.w });
  });
  if (!spans.length) return [];
  const perSpanWidth = Math.min(
    FIXED_CHAT_CELL_WIDTH,
    Math.floor(baseStageWidth / Math.max(spans.length + 1, 2)),
  );
  return spans.map((span) => ({ ...span, width: perSpanWidth }));
});

const remappedColumnWidths = computed(() => {
  const widths = Array.from({ length: 24 }, () => columnWidth.value);
  if (!chatColumnSpans.value.length) return widths;
  const reservedCols = chatColumnSpans.value.reduce((sum: number, span: any) => sum + span.w, 0);
  const reservedWidth = chatColumnSpans.value.reduce((sum: number, span: any) => sum + span.width, 0);
  const flexibleCols = Math.max(24 - reservedCols, 1);
  const flexibleWidth = Math.max((stageWidth.value || viewportWidth.value || 0) - reservedWidth, 0);
  const baseWidth = flexibleWidth / flexibleCols;
  for (let col = 0; col < 24; col += 1) widths[col] = baseWidth;
  chatColumnSpans.value.forEach((span: any) => {
    const colWidth = span.width / span.w;
    for (let col = span.x; col < span.x + span.w; col += 1) widths[col] = colWidth;
  });
  return widths;
});

const gridRowHeight = computed(() => Math.max(rowHeight.value, 1));

const buttons = computed(() => Object.freeze([
  {
    icon: mdiViewGridPlus,
    tooltip: t("views.multiview.addframe"),
    onClick: addCellAutoLayout,
    color: "green",
    collapse: isSmAndDown.value,
  },
  {
    icon: mdiSync,
    onClick: toggleSyncBar,
    color: "deep-purple lighten-2",
    tooltip: t("views.multiview.archiveSync"),
    collapse: isXs.value,
  },
  {
    icon: icons.mdiDelete,
    tooltip: t("component.music.clearPlaylist"),
    onClick: () => { clearAllItems(); showSyncBar.value = false; },
    color: "red",
    collapse: isSmAndDown.value,
  },
  {
    icon: icons.mdiFullscreen,
    onClick: toggleFullScreen,
    tooltip: t("views.multiview.fullScreen"),
    collapse: isMdAndDown.value,
  },
]));

// Methods
function syncStageMetrics() {
  const stage = gridStage.value;
  if (!stage) return;
  stageWidth.value = stage.clientWidth || viewportWidth.value;
  stageHeight.value = stage.clientHeight || viewportHeight.value;
}

function itemPixelWidth(item: any) {
  return remappedColumnWidths.value.slice(item.x, item.x + item.w).reduce((sum: number, w: number) => sum + w, 0);
}

function itemPixelLeft(item: any) {
  return remappedColumnWidths.value.slice(0, item.x).reduce((sum: number, w: number) => sum + w, 0);
}

function itemStyle(item: any) {
  return {
    left: "0px",
    top: "0px",
    width: `${itemPixelWidth(item)}px`,
    transform: `translate3d(${itemPixelLeft(item)}px, ${Math.round(rowHeight.value * item.y)}px, 0)`,
  };
}

function setupStageResizeObserver() {
  stageResizeObserver?.disconnect?.();
  if (!window.ResizeObserver || !gridStage.value) return;
  stageResizeObserver = new window.ResizeObserver(() => { syncStageMetrics(); });
  stageResizeObserver.observe(gridStage.value);
}

function promptLayoutChange(layoutWithContent: any, confirmFunction?: (() => void) | null, cancelFunction?: (() => void) | null) {
  if (overwriteDialog.value) return;
  if (!layout.value || Object.keys(layout.value).length === 0) {
    setMultiview(layoutWithContent);
    return;
  }
  overwriteLayoutPreview.value = layoutWithContent;
  overwriteConfirm.value = (dialogMerge: boolean) => {
    overwriteDialog.value = false;
    setMultiview({ ...layoutWithContent, mergeContent: dialogMerge });
    confirmFunction?.();
  };
  overwriteCancel.value = (_dialogMerge: boolean) => {
    overwriteDialog.value = false;
    cancelFunction?.();
  };
  overwriteDialog.value = true;
}

function checkStreamType(v: any) {
  let video = v;
  if (video.type === "placeholder") {
    const twitchChannel = video.link.match(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
    if (!twitchChannel) return null;
    video = { ...video, id: twitchChannel, type: "twitch" };
  }
  return video;
}

function handleToolbarClick(v: any) {
  const video = checkStreamType(v);
  if (!video) return;
  const hasEmptyCell = findEmptyCell();
  if (!hasEmptyCell) {
    addVideoAutoLayout(video, (newLayout: any) => {
      overwriteMerge.value = true;
      promptLayoutChange(newLayout, () => { tryFillVideo(video); });
    });
  } else {
    tryFillVideo(video);
  }
}

function handleVideoClicked(v: any) {
  if (showSelectorForId.value < -1) {
    handleToolbarClick(v);
    return;
  }
  const video = checkStreamType(v);
  if (!video) return;
  addVideoWithId(video, showSelectorForId.value);
  showSelectorForId.value = -1;
}

function handleToolbarShowSelector() { showSelectorForId.value = -2; }

function handlePresetClicked(preset: any) {
  showPresetSelectorMenu.value = false;
  setMultiview({ ...JSON.parse(JSON.stringify(preset)), mergeContent: true });
}

function handleDelete(id: string) { deleteVideoAutoLayout(id); }

function onLayoutUpdated(newLayout: any) { multiviewStore.setLayout(newLayout); }

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function toggleSyncBar() { showSyncBar.value = !showSyncBar.value; }

function handleWindowClick(event: MouseEvent) {
  if (showPresetSelectorMenu.value && presetMenuRoot.value && !presetMenuRoot.value.contains(event.target as Node)) {
    showPresetSelectorMenu.value = false;
  }
  if (showReorderLayout.value && reorderMenuRoot.value && !reorderMenuRoot.value.contains(event.target as Node)) {
    showReorderLayout.value = false;
  }
  if (showPresetEditor.value && presetEditorRoot.value && !presetEditorRoot.value.contains(event.target as Node)) {
    showPresetEditor.value = false;
  }
  if (showMediaControls.value && mediaControlsRoot.value && !mediaControlsRoot.value.contains(event.target as Node)) {
    showMediaControls.value = false;
  }
}

// Watchers
watch(collapseToolbar, async () => { await nextTick(); syncStageMetrics(); });
watch(viewportWidth, async () => { await nextTick(); syncStageMetrics(); });

// Lifecycle
onMounted(async () => {
  window.addEventListener("click", handleWindowClick);
  if (route.params.layout) {
    try {
      const parsed = decodeLayout(route.params.layout as string);
      if (parsed.layout && parsed.content) {
        try {
          api.trackMultiviewLink(route.params.layout as string).catch(console.error);
        } catch {}
        promptLayoutChange(parsed, null, () => history.pushState({}, "", "/multiview"));
      }
    } catch (e) {
      console.error(e);
    }
    if (route.query.t || route.query.offsets) {
      showSyncBar.value = true;
    }
  } else {
    multiviewStore.fetchVideoData({ refreshLive: true });
  }
  await nextTick();
  syncStageMetrics();
  setupStageResizeObserver();
});

onBeforeUnmount(() => {
  window.removeEventListener("click", handleWindowClick);
  stageResizeObserver?.disconnect?.();
});
</script>

<style lang="scss">
.multiview {
    width: 100%;
    height: 100dvh;
    min-height: 100dvh;
    overflow: hidden;
    position: relative;
}

.mv-stage {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    overflow: hidden;
}

.mv-stage-surface {
    position: relative;
    min-height: 100%;
    height: 100%;
}
.mobile-helpers {
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    .mv-cell.edit-mode {
        padding: 0;
    }
}

.open-mv-toolbar-btn {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
    opacity: 0.7;
    margin: 0.375rem;
}
.vue-grid-item {
    transition: none;
}

.vue-grid-layout {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transition: none;
}

.hints {
    div {
        margin-bottom: 10px;
    }
}
</style>
