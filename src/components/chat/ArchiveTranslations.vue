<template>
  <UiCard class-name="tl-overlay w-full border border-white/10 p-0 text-sm shadow-none">
    <div class="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
      <div>TLdex [{{ liveTlLang }}]</div>
      <div class="flex items-center gap-1">
        <UiButton
          variant="ghost"
          size="icon"
          class-name="h-7 w-7 rounded-full"
          title="-2s"
          @click="timeOffsetSeconds -= 2"
        >
          <UiIcon :icon="mdiChevronLeft" size="sm" />
        </UiButton>
        <button
          type="button"
          class="rounded-md px-2 py-1 font-mono text-xs text-slate-300 transition hover:bg-white/8"
          @click="dialog = true"
        >
          {{ `${timeOffsetSeconds >= 0 ? "+" : ""}${timeOffsetSeconds}s` }}
        </button>
        <UiDialog
          :open="dialog"
          class-name="max-w-xs p-0"
          @update:open="dialog = $event"
        >
          <UiCard class-name="space-y-4 p-5">
            <div class="text-sm font-semibold text-white">
              Time Offset
            </div>
            <label class="flex flex-col gap-2 text-sm">
              <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Offset</span>
              <div class="flex items-center gap-2">
                <UiInput v-model.number="timeOffsetSeconds" type="number" class-name="flex-1" />
                <span class="text-slate-400">s</span>
              </div>
            </label>
          </UiCard>
        </UiDialog>
        <UiButton
          variant="ghost"
          size="icon"
          class-name="h-7 w-7 rounded-full"
          title="+2s"
          @click="timeOffsetSeconds += 2"
        >
          <UiIcon :icon="mdiChevronRight" size="sm" />
        </UiButton>
        <UiButton
          variant="ghost"
          size="icon"
          class-name="h-7 w-7 rounded-full"
          :title="$t('views.watch.chat.showSubtitle')"
          @click="showSubtitle = !showSubtitle"
        >
          <UiIcon
            :icon="mdiSubtitlesOutline"
            size="sm"
            :class-name="showSubtitle ? 'text-[color:var(--color-primary)]' : ''"
          />
        </UiButton>
        <UiButton
          variant="ghost"
          size="icon"
          class-name="h-7 w-7 rounded-full"
          :title="$t('views.watch.chat.expandTL')"
          @click="expanded = true"
        >
          <UiIcon :icon="mdiArrowExpand" size="sm" />
        </UiButton>
        <UiDialog
          :open="expanded"
          class-name="max-w-4xl p-0"
          @update:open="expanded = $event"
        >
          <UiCard class-name="p-0">
            <div :id="expandedMsgId" class="flex tl-expanded" />
            <div class="flex justify-end border-t border-white/10 px-4 py-3">
              <UiButton variant="destructive" size="sm" @click="expanded = false">
                {{ $t("views.app.close_btn") }}
              </UiButton>
            </div>
          </UiCard>
        </UiDialog>
        <WatchLiveTranslationsSetting />
      </div>
    </div>
    <Teleport :to="`#${expandedMsgId}`" :disabled="!expanded">
      <virtual-list
        ref="tlBody"
        class="archive tl-body px-1 py-0 lg:px-3"
        :style="{
          'font-size': liveTlFontSize + 'px',
        }"
        :data-component="ChatMessage"
        :data-key="getKey"
        :data-sources="dividedTLs"
        :item-height="20"
        :item-class-add="addClass"
        :keeps="50"
        @click="handleClick"
      />
    </Teleport>
    <Teleport v-if="showSubtitle" :to="`#overlay-${video.id}`">
      <WatchSubtitleOverlay :messages="toDisplay" />
    </Teleport>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, getCurrentInstance } from "vue";
import VirtualList from "vue-virtual-scroll-list";
import { mdiChevronLeft, mdiChevronRight } from "@mdi/js";
import { mdiArrowExpand, mdiSubtitlesOutline } from "@mdi/js";
import { useChatMixin } from "@/composables/useChatMixin";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import WatchLiveTranslationsSetting from "./LiveTranslationsSetting.vue";
import ChatMessage from "./ChatMessage.vue";
import WatchSubtitleOverlay from "../watch/WatchSubtitleOverlay.vue";

defineOptions({ name: "ArchiveTranslations" });

const instance = getCurrentInstance();
const expandedMsgId = `tl-expanded-${instance?.uid ?? Math.random().toString(36).slice(2)}`;
const props = withDefaults(defineProps<{
  video: Record<string, any>;
  currentTime?: number;
  useLocalSubtitleToggle?: boolean;
}>(), {
  currentTime: 0,
});

const emit = defineEmits<{
  (e: "timeJump", time: number, a: boolean, b: boolean): void;
}>();

const {
  tlHistory,
  expanded,
  liveTlLang,
  liveTlFontSize,
  liveTlHideSpoiler,
  showSubtitle,
  blockedNames,
  loadMessages,
} = useChatMixin({
  video: props.video,
  currentTime: computed(() => props.currentTime),
  useLocalSubtitleToggle: props.useLocalSubtitleToggle,
});

const curIndex = ref(0);
const dialog = ref(false);
const timeOffsetSeconds = ref(0);

const tlBody = ref<any>(null);

const dividedTLs = computed(() => {
  const filtered = tlHistory.value.filter((m: any) => !blockedNames.value.has(m.name));
  return filtered.map((item: any, index: number, arr: any[]) => {
    const shouldHideAuthor = index > 0 && (!(index === 0
      || index === arr.length - 1
      || item.name !== arr[index - 1].name
      || !!item.breakpoint));
    const newtime = item.timestamp + timeOffsetSeconds.value * 1000;
    const relativeMs = item.relativeMs + timeOffsetSeconds.value * 1000;
    return { ...item, shouldHideAuthor, relativeMs, timestamp: newtime };
  });
});

const toDisplay = computed(() => {
  if (!dividedTLs.value.length || !showSubtitle.value) return [];
  const startIdx = Math.max(curIndex.value - 1, 0);
  const buffer = dividedTLs.value.slice(startIdx, startIdx + 2);
  return buffer.filter((m: any) => {
    const displayTime = +m.duration || (m.message.length * 65 + 1800);
    return props.currentTime * 1000 >= m.relativeMs && props.currentTime * 1000 < m.relativeMs + displayTime;
  });
});

watch(liveTlLang, () => {
  loadMessages(true, true);
});

watch(() => props.currentTime, (time) => {
  if (!dividedTLs.value.length) return;
  const msTime = time * 1000;
  const cur = dividedTLs.value[curIndex.value].relativeMs;

  const startIndex = time < cur ? 0 : curIndex.value;
  for (let i = startIndex; i < tlHistory.value.length; i += 1) {
    if (i === dividedTLs.value.length - 1) {
      curIndex.value = dividedTLs.value.length - 1;
      return;
    }
    if (msTime <= dividedTLs.value[i].relativeMs) {
      curIndex.value = Math.max(i - 1, 0);
      return;
    }
  }
});

watch(curIndex, (idx) => {
  if (liveTlHideSpoiler.value) {
    nextTick(() => {
      tlBody.value?.scrollToBottom();
    });
  } else {
    scrollToIndex(idx);
  }
});

// Load messages on creation
loadMessages(true, true);

function addClass(index: number) {
  if (index === curIndex.value) {
    return "active-message";
  }
  if (liveTlHideSpoiler.value && (index > curIndex.value)) {
    return "hide-spoiler";
  }
  return "";
}

function getKey(item: any) {
  return item.timestamp + item.message + item.name;
}

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.matches(".tl-message, .tl-message *")) {
    emit("timeJump", +target.parentElement!.getAttribute("data-time")!, true, true);
    e.preventDefault();
  }
}

function scrollToIndex(idx: number) {
  const ref = tlBody.value;
  if (!ref) return;
  const idxSize = ref.virtual.sizes.get(idx) ?? 50;
  const idxOffset = ref.virtual.getOffset(idx);
  const nearBottom = idxOffset + ref.getClientSize() > ref.getScrollSize();
  if (nearBottom) {
    ref.scrollToBottom();
  } else {
    ref.scrollToOffset(idxOffset - (ref.getClientSize() / 2) + idxSize);
  }
}
</script>

<style>
.tl-body.archive {
    overflow-y: auto;
    position: relative;
    overscroll-behavior: contain;
    height: calc(100% - 32px);
    display: flex;
    flex-direction: column-reverse;
    flex-direction: column;
    line-height: 1.35;
    letter-spacing: 0.0178571429em !important;
}

.active-message {
    position: relative;
}
.active-message {
    z-index: 0;
}
.active-message .tl-message::before {
    content: "";
    background-color: color-mix(in srgb, var(--color-primary) 70%, transparent);
    opacity: 0.25;
    width: calc(100%);
    height: calc(100%);
    background-size: cover;
    position: absolute;
    top: -1px;
    left: 0;
    z-index: -1;
}
.hide-spoiler {
    display: none;
}
</style>
