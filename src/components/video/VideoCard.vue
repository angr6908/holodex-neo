<template>
  <article
    class="video-card no-decoration flex"
    :class="{
      'video-card-fluid': fluid,
      'video-card-active': active,
      'video-card-dragging': isDragging,
      'video-card-horizontal': horizontal,
      'video-card-list': denseList,
      'video-card-multiview-active': inMultiViewActiveVideos,
      'flex-col': !horizontal && !denseList,
    }"
    :draggable="!dragSelectionLocked"
    style="position: relative"
    @mousedown.capture="handleMouseDown"
    @dragstart="drag"
    @dragend="handleDragEnd"
    @click.exact="handleCardBodyClick"
  >
    <div
      class="video-card-shell w-full overflow-hidden border border-[color:var(--color-border)] p-0"
    >
      <!-- Video Image with Duration -->
      <div
        v-if="!denseList"
        style="position: relative; width: 100%"
        class="video-thumbnail text-white rounded flex-shrink-0 flex cursor-pointer overflow-hidden"
        :style="
          horizontal &&
            !shouldHideThumbnail &&
            `background: url(${imageSrc}) center/cover;`
        "
        role="link"
        tabindex="0"
        @click.exact.stop="onThumbnailClicked"
        @contextmenu.prevent="openContextMenu"
        @keydown.enter.prevent.stop="onThumbnailClicked"
        @keydown.space.prevent.stop="onThumbnailClicked"
      >
        <PlaceholderOverlay
          v-if="shouldShowPlaceholderOverlay"
          :width="200"
          :height="150"
          :show-only-on-hover="false"
        />
        <!-- Image Overlay -->
        <div
          class="video-card-overlay flex justify-between flex-col"
          style="height: 100%; position: absolute; width: 100%; z-index: 1"
        >
          <div class="flex justify-between items-start">
            <!-- Topic Id display (hidden for clips) -->
            <div
              v-if="data.topic_id && !isClip"
              class="video-topic"
            >
              {{ data.topic_id }}
            </div>
            <div v-else />

            <!-- Check box for saved video (👻❌) -->
            <button
              v-if="!isPlaceholder"
              type="button"
              class="video-card-action"
              @click.prevent.stop="toggleSaved($event)"
            >
              <UiIcon
                :icon="hasSaved ? icons.mdiCheck : icons.mdiPlus"
                class-name="h-4 w-4"
                class="video-card-action-icon-unsaved"
              />
            </button>
          </div>

          <!-- Video duration/music indicator (👻❌) -->
          <div v-if="!isPlaceholder" class="flex flex-col items-end">
            <!-- Show music icon if songs exist, and song count if there's multiple -->
            <div
              v-if="data.songcount"
              class="video-duration flex items-center"
              :title="songIconTitle"
            >
              {{ songCount }}
              <UiIcon :icon="icons.mdiMusic" class-name="h-3.5 w-3.5 text-white" />
            </div>
            <!-- Show TL chat icon if recently active or has archive tl exist -->
            <div
              v-if="hasTLs"
              class="video-duration flex items-center"
              :title="tlIconTitle"
            >
              {{ tlLangInChat }}
              <UiIcon :icon="icons.tlChat" class-name="h-3.5 w-3.5 text-white" />
            </div>
            <!-- Duration/Current live stream time -->
            <div
              v-if="data.duration > 0 || data.start_actual"
              class="video-duration"
              :class="data.status === 'live' && 'video-duration-live'"
            >
              {{ formattedDuration }}
            </div>
          </div>
          <div v-else-if="isPlaceholder" class="flex flex-col items-end">
            <!-- (👻✅) -->
            <div
              class="video-duration"
              :class="data.status === 'live' && 'video-duration-live'"
            >
              <span v-if="hasDuration" class="duration-placeholder">{{
                formattedDuration
              }}</span>
              <span
                v-if="data.placeholderType === 'scheduled-yt-stream'"
                class="hover-placeholder"
              >{{ $t("component.videoCard.typeScheduledYT") }}</span>
              <span
                v-else-if="data.placeholderType === 'external-stream'"
                class="hover-placeholder"
              >{{ $t("component.videoCard.typeExternalStream") }}</span>
              <span
                v-else-if="data.placeholderType === 'event'"
                class="hover-placeholder"
              >{{ $t("component.videoCard.typeEventPlaceholder") }}</span>
              <UiIcon
                class-name="h-4 w-4 rounded-sm"
                :icon="
                  twitchPlaceholder
                    ? mdiTwitch
                    : twitterPlaceholder
                      ? mdiTwitter
                      : placeholderIconMap[data.placeholderType]
                "
              />
            </div>
          </div>
        </div>
        <img
          v-if="!horizontal && !shouldHideThumbnail"
          :ref="(el: any) => el && onImgMounted(el)"
          :src="imageSrc"
          width="100%"
          loading="lazy"
          decoding="async"
          class="aspect-video w-full object-cover img-fade-in"
          :class="{
            'hover-opacity': data.placeholderType === 'scheduled-yt-stream',
          }"
          alt=""
          @load="onImgLoad"
        >
        <div
          v-else-if="!horizontal && shouldHideThumbnail"
          class="aspect-[60/9] w-full bg-white/6"
        />
      </div>
      <div
        class="video-card-text no-decoration"
        :class="{ 'video-card-text-single-line': isSingleLineTitle && !horizontal && !denseList }"
      >
        <!-- Channel icon (denseList mode OR grid live/upcoming with avatar) -->
        <div
          v-if="(denseList && data.channel) || showGridAvatar"
          class="video-card-avatar-slot flex self-center mx-2 flex-col flex"
          :class="{ 'video-card-avatar-slot--grid': showGridAvatar && !denseList }"
        >
          <button
            type="button"
            class="plain-button inline-flex items-center"
            :title="channelName"
            @click.exact.stop.prevent="goToChannel(data.channel.id)"
          >
            <ChannelImg :channel="data.channel" rounded :size="showGridAvatar && !denseList ? gridAvatarSize : undefined" class="self-center" />
          </button>
        </div>
        <!-- Three lines for title, channel, available time -->
        <div
          class="flex video-card-lines flex-col"
          :class="{ 'video-card-lines-single-line': isSingleLineTitle && !horizontal && !denseList }"
        >
          <!-- Video title -->
          <div
            class="video-card-title-wrap"
            :class="{ 'video-card-title-wrap-default': !horizontal && !denseList && !isSingleLineTitle }"
          >
            <a
              ref="titleButton"
              :href="titleHref"
              :class="[
                'plain-button video-card-title text-left',
                { 'video-watched': hasWatched },
              ]"
              :title="title"
              style="user-select: text"
              :style="{
                'font-size': `${1 - appStore.currentGridSize / 16}rem`,
              }"
              @click.exact.stop.prevent="handleTitleClick"
            >
              <UiIcon
                v-if="!isCertain"
                :icon="icons.mdiClockAlertOutline"
                class-name="mr-1 inline-block h-[18px] w-[18px] align-text-bottom text-amber-400"
                :title="$t('component.videoCard.uncertainPlaceholder')"
              />
              {{ title }}
            </a>
          </div>
          <div class="video-card-meta">
            <!-- Channel -->
            <div
              v-if="includeChannel"
              class="video-card-channel-slot"
            >
              <div class="channel-name video-card-subtitle">
                <button
                  type="button"
                  class="plain-button no-decoration text-left"
                  style="user-select: text"
                  :class="{
                    'name-vtuber':
                      data.type === 'stream' || data.channel.type === 'vtuber',
                  }"
                  :title="
                    data.channel.name +
                      (data.channel.english_name
                        ? `\nEN: ${data.channel.english_name}`
                        : '') +
                      (data.channel.org ? `\n> ${data.channel.org}` : '') +
                      (data.channel.group ? `\n> ${data.channel.group}` : '')
                  "
                  @click.exact.stop.prevent="handleChannelClick"
                >
                  {{ channelName }}
                </button>
              </div>
            </div>
            <!-- Time/Viewer Info -->
            <div class="video-card-subtitle video-card-time">
              <span
                class="video-card-time-primary"
                :class="'text-' + data.status"
                :title="absoluteTimeString"
              >
                {{ formattedTime }}
              </span>
              <!-- (👻❌) -->
              <template
                v-if="data.clips && data.clips.length > 0 && !isPlaceholder"
              >
                <span class="video-card-time-secondary text-[color:var(--color-primary)]">
                  •
                  {{
                    $t(
                      "component.videoCard.clips",
                      typeof data.clips === "object"
                        ? data.clips.length
                        : +data.clips
                    )
                  }}
                </span>
              </template>
              <span
                v-else-if="data.status === 'live' && data.live_viewers > 0"
                class="video-card-time-secondary live-viewers"
              >
                •
                {{ formatCount(data.live_viewers, lang) }} Watching
              </span>
            </div>
          </div>
        </div>
        <!-- Context menu rendered via teleport to avoid z-index stacking issues -->
        <teleport to="body">
          <div
            v-if="showMenu"
            ref="menuOverlayEl"
            class="fixed inset-0 z-[500] outline-none"
            tabindex="-1"
            @click.stop="showMenu = false"
            @contextmenu.prevent="showMenu = false"
            @keydown.esc="showMenu = false"
          >
            <div
              class="video-card-menu-shell absolute w-[260px] rounded-2xl p-2"
              :style="menuPosition"
              @click.stop
            >
              <video-card-menu :video="data" @closeMenu="showMenu = false" />
            </div>
          </div>
        </teleport>
      </div>
      <!-- optional breaker object to row-break into a new row. -->
      <div
        v-if="hasActionContent || activePlaylistItem"
        class="video-card-item-actions"
      >
        <template v-if="activePlaylistItem">
          <button @click.stop.prevent="move(data.id, 'up')">
            <UiIcon :icon="icons.mdiChevronUp" class-name="h-4 w-4" />
          </button>
          <button
            @click.stop.prevent="
              playlistStore.removeVideoByID(data.id)
            "
          >
            <UiIcon :icon="icons.mdiDelete" class-name="h-4 w-4" />
          </button>
          <button @click.stop.prevent="move(data.id, 'down')">
            <UiIcon :icon="icons.mdiChevronDown" class-name="h-4 w-4" />
          </button>
        </template>
        <slot name="action" />
      </div>
    </div>

    <!-- Placeholder MODAL -->
    <placeholder-card
      v-if="placeholderOpen"
      v-model="placeholderOpen"
      :video="data"
    />
  </article>
</template>

<script setup lang="ts">
import {
  Comment, Fragment, Text, defineAsyncComponent,
  ref, computed, watch, nextTick, useSlots,
  onMounted, onActivated, onDeactivated, onBeforeUnmount,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { useAppStore } from "@/stores/app";
import { usePlaylistStore } from "@/stores/playlist";
import { useHistoryStore } from "@/stores/history";
import { useMultiviewStore } from "@/stores/multiview";
import * as icons from "@/utils/icons";
import {
  formatCount,
  getVideoThumbnails,
  getChannelPhoto,
  decodeHTMLEntities,
} from "@/utils/functions";
import {
  formatDuration,
  formatDistance,
  dayjs,
  titleTimeString,
} from "@/utils/time";
import { mdiBroadcast, mdiTwitch, mdiTwitter } from "@mdi/js";
import UiIcon from "@/components/ui/icon/Icon.vue";
import VideoCardMenu from "../common/VideoCardMenu.vue";
import PlaceholderOverlay from "./PlaceholderOverlay.vue";

import ChannelImg from "@/components/channel/ChannelImg.vue";
const PlaceholderCard = defineAsyncComponent(() => import("./PlaceholderCard.vue"));

defineOptions({ name: "VideoCard" });

const props = withDefaults(defineProps<{
  video?: Record<string, any> | null;
  source?: Record<string, any> | null;
  fluid?: boolean;
  includeChannel?: boolean;
  includeAvatar?: boolean;
  hideThumbnail?: boolean;
  horizontal?: boolean;
  colSize?: number;
  active?: boolean; // TODO: seems always false (see VideoCardList.activeId); 'video-card-active' class is instead toggled via VirtualVideoCardList.activeIndex/checkActive
  disableDefaultClick?: boolean;
  activePlaylistItem?: boolean;
  parentPlaylistId?: number | string | null;
  denseList?: boolean;
  inMultiViewSelector?: boolean;
}>(), {
  video: null,
  source: null,
  fluid: false,
  includeChannel: false,
  includeAvatar: false,
  hideThumbnail: false,
  horizontal: false,
  colSize: 1,
  active: false,
  disableDefaultClick: false,
  activePlaylistItem: false,
  parentPlaylistId: null,
  denseList: false,
  inMultiViewSelector: false,
});

const emit = defineEmits<{
  (e: "videoClicked", data: any): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const settingsStore = useSettingsStore();
const appStore = useAppStore();
const playlistStore = usePlaylistStore();
const historyStore = useHistoryStore();
const multiviewStore = useMultiviewStore();
const slots = useSlots();

// ── Template ref ──
const titleButton = ref<HTMLElement>();

// ── Reactive state ──
const forceJPG = ref(true);
const now = ref(Date.now());
const updatecycle = ref<ReturnType<typeof setInterval> | null>(null);
const hasWatched = ref(false);
const placeholderOpen = ref(false);
const showMenu = ref(false);
const menuOverlayEl = ref<HTMLElement | null>(null);
const menuX = ref(0);
const menuY = ref(0);
const isSingleLineTitle = ref(false);
const titleResizeObserver = ref<ResizeObserver | null>(null);
const dragPreviewEl = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const dragSelectionLocked = ref(false);

// ── Constants ──
const placeholderIconMap: Record<string, string> = {
  event: icons.mdiCalendar,
  "scheduled-yt-stream": icons.mdiYoutube,
  "external-stream": mdiBroadcast,
};

// ── Computed ──
const data = computed(() => props.source || props.video);

const isPlaceholder = computed(() => data.value.type === "placeholder");

const isCertain = computed(() => !isPlaceholder.value || data.value.certainty === "certain");

const title = computed(() => {
  if (isPlaceholder.value) {
    if (settingsStore.nameProperty === "english_name") {
      const titleStr = data.value.title ?? data.value.jp_name ?? "";
      return decodeHTMLEntities(titleStr);
    }
    const titleStr = data.value.jp_name ?? data.value.title ?? "";
    return decodeHTMLEntities(titleStr);
  }
  if (!data.value.title) return "";
  return decodeHTMLEntities(data.value.title);
});

const lang = computed(() => settingsStore.lang);

const formattedTime = computed(() => {
  switch (data.value.status) {
    case "upcoming":
      // print relative time in hours if less than 24 hours,
      // print full date if greater than 24 hours
      return formatDistance(
        data.value.start_scheduled || data.value.available_at,
        lang.value,
        t,
        false, // allowNegative = false
        dayjs(now.value),
      ); // upcoming videos don't get to be ("5 minutes ago")
    case "live":
      return t("component.videoCard.liveNow");
    default:
      return formatDistance(
        data.value.available_at,
        lang.value,
        t,
      );
  }
});

const shouldShowPlaceholderOverlay = computed(() =>
  isPlaceholder.value
  && (data.value.status === "upcoming" && data.value.placeholderType));

const hasDuration = computed(() =>
  (data.value.duration > 0 && data.value.status === "live")
  || data.value.start_actual);

const absoluteTimeString = computed(() =>
  titleTimeString(data.value.available_at, lang.value));

const videoTitle = computed(() => title.value);

const formattedDuration = computed(() => {
  if (data.value.start_actual && data.value.status === "live") {
    return formatDuration(
      dayjs(now.value).diff(dayjs(data.value.start_actual)),
    );
  }
  if (data.value.status === "upcoming" && data.value.duration) {
    return t("component.videoCard.premiere");
  }
  return (
    data.value.duration && formatDuration(data.value.duration * 1000)
  );
});

const imageSrc = computed(() => {
  // load different images based on current column size, which correspond to breakpoints
  if (data.value.thumbnail) {
    const enc = btoa(data.value.thumbnail);
    const n = enc.replace("+", "-").replace("/", "_").replace(/=+$/, "");
    return `/statics/thumbnail/default/${n}.jpg`;
  }
  if (data.value.type === "placeholder") {
    return getChannelPhoto(data.value.channel_id || data.value.channel.id);
  }
  const srcs = getVideoThumbnails(data.value.id, !forceJPG.value);
  if (props.horizontal) return srcs.medium;
  if (props.colSize > 2 && props.colSize <= 8) {
    return window.devicePixelRatio > 1 ? srcs.standard : srcs.medium;
  }
  return srcs.standard;
});

const redirectMode = computed(() => settingsStore.redirectMode);

const shouldHideThumbnail = computed(() =>
  settingsStore.hideThumbnail || props.hideThumbnail);

const isLiveOrUpcoming = computed(() =>
  data.value.status === "live" || data.value.status === "upcoming");

const isClip = computed(() => data.value.type === "clip");

// Show avatar next to channel name in grid mode for live/upcoming only
const showGridAvatar = computed(() =>
  props.includeAvatar && isLiveOrUpcoming.value && !props.denseList && !props.horizontal && data.value.channel);

// Avatar size varies with card size (colSize: 0=largest, 2=smallest)
const gridAvatarSize = computed(() => {
  if (props.colSize >= 2) return "42";
  if (props.colSize >= 1) return "48";
  return "56";
});

const channelName = computed(() => {
  const prop = settingsStore.nameProperty;
  return data.value.channel[prop] || data.value.channel.name;
});

const hasSaved = computed(() => playlistStore.contains(data.value.id));

const isMobile = computed(() => appStore.isMobile);

const watchLink = computed(() => {
  const q = props.parentPlaylistId
    ? `?playlist=${props.parentPlaylistId}`
    : "";
  return `/watch/${data.value.id}${q}`;
});

const titleHref = computed(() => {
  if (isPlaceholder.value && data.value.placeholderType === "external-stream" && data.value.link) {
    return data.value.link;
  }
  if (redirectMode.value) {
    return `https://youtu.be/${data.value.id}`;
  }
  return watchLink.value;
});

const hasTLs = computed(() => {
  const tlLang = settingsStore.liveTlLang;
  return (
    (data.value?.status === "past" && data.value?.live_tl_count?.[tlLang])
    || data.value?.recent_live_tls?.includes(tlLang)
  );
});

const tlLangInChat = computed(() => {
  const tlLang = settingsStore.liveTlLang;
  return hasTLs.value && data.value.status === "past"
    ? `${data.value.live_tl_count[tlLang]}`
    : "";
});

const tlIconTitle = computed(() =>
  data.value.status === "past"
    ? t("component.videoCard.totalTLs")
    : t("component.videoCard.tlPresence"));

const songIconTitle = computed(() => t("component.videoCard.totalSongs"));

const songCount = computed(() =>
  data.value.songcount > 1 ? data.value.songcount : "");

const twitchPlaceholder = computed(() => data.value.link?.includes("twitch.tv"));

const twitterPlaceholder = computed(() => data.value.link?.includes("/i/spaces/"));

const inMultiViewActiveVideos = computed(() => {
  if (!props.inMultiViewSelector) return false;
  const { id } = data.value;
  return multiviewStore.activeVideos.some((video: any) => video.id === id);
});

const menuPosition = computed(() => {
  const menuWidth = 260;
  const menuHeight = 400; // approximate max height
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = menuX.value;
  let y = menuY.value;
  if (x + menuWidth > vw) x = vw - menuWidth - 8;
  if (y + menuHeight > vh) y = vh - menuHeight - 8;
  if (x < 8) x = 8;
  if (y < 8) y = 8;
  return { left: `${x}px`, top: `${y}px` };
});

const hasActionContent = computed(() => {
  const actionSlot = slots.action;
  if (!actionSlot) return false;
  const hasMeaningfulNode = (node: any): boolean => {
    if (!node) return false;
    if (Array.isArray(node)) return node.some(hasMeaningfulNode);
    if (node.type === Comment) return false;
    if (node.type === Text) {
      return typeof node.children === "string" && node.children.trim().length > 0;
    }
    if (node.type === Fragment) {
      return hasMeaningfulNode(node.children);
    }
    if (Array.isArray(node.children)) return node.children.some(hasMeaningfulNode);
    if (typeof node.children === "string") return node.children.trim().length > 0;
    return true;
  };
  return hasMeaningfulNode(actionSlot());
});

// ── Methods ──
function updateNow() {
  now.value = Date.now();
}

// Fade-in only on first network download; cached images show instantly
function onImgLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  if (!img.dataset.fadeReady) {
    // Image loaded before we could set up fade (was cached) — show instantly
    img.classList.add("loaded");
    return;
  }
  img.classList.add("loaded");
}

function onImgMounted(el: Element) {
  const img = el as HTMLImageElement;
  if (img.dataset.fadeInit) return; // Already initialized
  img.dataset.fadeInit = "1";
  if (img.complete && img.naturalHeight > 0) {
    // Already loaded from cache — show instantly, no animation
    img.classList.add("loaded");
  } else {
    // Not yet loaded — hide and enable fade-in transition
    img.classList.add("img-pending");
    img.dataset.fadeReady = "1";
  }
}

function disconnectTitleObserver() {
  if (!titleResizeObserver.value) return;
  titleResizeObserver.value.disconnect();
  titleResizeObserver.value = null;
}

function updateTitleLineState() {
  const el = titleButton.value;
  if (!el) {
    isSingleLineTitle.value = false;
    return;
  }
  const style = window.getComputedStyle(el);
  const lineHeight = Number.parseFloat(style.lineHeight || "0");
  if (!lineHeight) {
    isSingleLineTitle.value = false;
    return;
  }
  const titleHeight = el.getBoundingClientRect().height;
  isSingleLineTitle.value = titleHeight <= lineHeight * 1.45;
}

function scheduleTitleLineCheck() {
  if (props.horizontal || props.denseList) {
    isSingleLineTitle.value = false;
    return;
  }
  nextTick(() => {
    updateTitleLineState();
  });
}

function observeTitleSize() {
  nextTick(() => {
    const el = titleButton.value;
    if (!el || typeof ResizeObserver === "undefined") return;
    disconnectTitleObserver();
    titleResizeObserver.value = new ResizeObserver(() => {
      updateTitleLineState();
    });
    titleResizeObserver.value.observe(el);
  });
}

// Adds video to saved videos library
function toggleSaved(event: Event) {
  event.preventDefault();
  if (hasSaved.value) {
    playlistStore.removeVideoByID(data.value.id);
  } else {
    playlistStore.addVideo(data.value);
  }
}

function shouldIgnoreTextClick(event: any) {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return false;

  const currentTarget = event?.currentTarget;
  if (!(currentTarget instanceof Element) || selection.rangeCount === 0) return true;

  const commonAncestor = selection.getRangeAt(0).commonAncestorContainer;
  const selectionRoot = commonAncestor.nodeType === Node.TEXT_NODE
    ? commonAncestor.parentElement
    : commonAncestor;

  return !selectionRoot || currentTarget.contains(selectionRoot);
}

function openPlaceholder() {
  placeholderOpen.value = true;
}

function goToVideo() {
  emit("videoClicked", data.value);

  if (props.disableDefaultClick) return;
  if (isPlaceholder.value) {
    openPlaceholder();
    return;
  }
  // On mobile, clicking on watch links should not increment browser history
  // Back button will always return to the originating video list in one click
  if (route.path.match(/^\/watch/) && isMobile.value) {
    router.replace({ path: watchLink.value });
  } else {
    router.push({ path: watchLink.value });
  }
}

function goToChannel() {
  emit("videoClicked", data.value);
  if (props.disableDefaultClick) return;
  router.push({ path: `/channel/${data.value.channel.id}` });
}

function handleTitleClick(event: Event) {
  if (shouldIgnoreTextClick(event)) return;
  goToVideo();
}

function handleChannelClick(event: Event) {
  if (shouldIgnoreTextClick(event)) return;
  goToChannel();
}

function onThumbnailClicked() {
  if (props.disableDefaultClick) {
    emit("videoClicked", data.value);
    return;
  }
  if (
    isPlaceholder.value
    && data.value.placeholderType === "external-stream"
    && data.value.link
  ) {
    emit("videoClicked", data.value);
    window.open(data.value.link, "_blank", "noopener");
    return;
  }
  if (isPlaceholder.value) {
    goToVideo();
    return;
  }
  if (redirectMode.value) {
    emit("videoClicked", data.value);
    window.open(`https://youtu.be/${data.value.id}`, "_blank", "noopener");
  } else {
    goToVideo();
  }
}

function handleMouseDown(event: MouseEvent) {
  dragSelectionLocked.value = shouldSuppressDrag(event.target);
}

function releaseDragLock() {
  dragSelectionLocked.value = false;
}

function shouldSuppressDrag(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !!target.closest(".video-card-text, .video-card-item-actions");
}

function cleanupDragPreview() {
  if (!dragPreviewEl.value) return;
  dragPreviewEl.value.remove();
  dragPreviewEl.value = null;
}

function drag(ev: DragEvent) {
  if (dragSelectionLocked.value || shouldSuppressDrag(ev.target)) {
    ev.preventDefault();
    return;
  }
  const dataTransfer = ev.dataTransfer;
  if (!dataTransfer) return;
  dataTransfer.setData(
    "text",
    `https://holodex.net/watch/${data.value.id}`,
  );
  dataTransfer.setData("application/json", JSON.stringify(data.value));
  dataTransfer.effectAllowed = "copyMove";
  isDragging.value = true;

  const cardShell = (ev.currentTarget as Element)?.querySelector?.(".video-card-shell");
  if (!(cardShell instanceof HTMLElement) || !dataTransfer.setDragImage) return;

  cleanupDragPreview();
  const preview = cardShell.cloneNode(true) as HTMLElement;
  const rect = cardShell.getBoundingClientRect();
  preview.classList.add("video-card-drag-preview");
  preview.style.width = `${rect.width}px`;
  preview.style.height = `${rect.height}px`;
  document.body.appendChild(preview);
  dragPreviewEl.value = preview;
  dataTransfer.setDragImage(
    preview,
    Math.min(rect.width / 2, 120),
    Math.min(rect.height / 2, 90),
  );
}

function handleDragEnd() {
  isDragging.value = false;
  releaseDragLock();
  cleanupDragPreview();
}

function handleCardBodyClick(event: MouseEvent) {
  if (shouldIgnoreTextClick(event)) return;
  // The thumbnail, title, channel name, and avatar buttons all call event.stopPropagation().
  // Only blank areas within the card shell bubble up to here → navigate to the video.
  goToVideo();
}

function openContextMenu(event: MouseEvent) {
  menuX.value = event.clientX;
  menuY.value = event.clientY;
  showMenu.value = true;
  nextTick(() => menuOverlayEl.value?.focus());
}

function move(id: string, direction: string) {
  const playlist = playlistStore.active;
  const curIdx = playlist.videos.findIndex((elem: any) => elem.id === id);
  if (curIdx < 0) throw new Error("huh");
  let toIdx: number | undefined;
  switch (direction) {
    case "up":
      toIdx = curIdx - 1;
      break;
    case "down":
      toIdx = curIdx + 1;
      break;
    default:
      break;
  }
  if (toIdx === undefined || toIdx < 0) throw new Error("can't move stuff before 0");
  if (toIdx >= playlist.videos.length) {
    throw new Error("can't move stuff to beyond the end");
  }
  playlistStore.reorder({ from: curIdx, to: toIdx });
}

// ── Watchers ──
watch(videoTitle, () => scheduleTitleLineCheck());
watch(() => props.horizontal, () => scheduleTitleLineCheck());
watch(() => props.denseList, () => scheduleTitleLineCheck());
watch(() => appStore.currentGridSize, () => scheduleTitleLineCheck());

// ── Created (setup-time) logic ──
const hasWatchedFn = historyStore.hasWatched;
if (hasWatchedFn) {
  hasWatchedFn(data.value.id)
    .then((x: any) => {
      if (x) hasWatched.value = true;
    })
    .catch((err: any) => {
      console.error(err);
    });
}
if (!updatecycle.value && data.value.status === "live") {
  updatecycle.value = setInterval(updateNow, 1000);
}

// ── Lifecycle hooks ──
onMounted(() => {
  window.addEventListener("mouseup", releaseDragLock);
  observeTitleSize();
  scheduleTitleLineCheck();
});

onActivated(() => {
  window.addEventListener("mouseup", releaseDragLock);
  if (!updatecycle.value && data.value.status === "live") {
    updatecycle.value = setInterval(updateNow, 1000);
  }
  observeTitleSize();
  scheduleTitleLineCheck();
});

onDeactivated(() => {
  window.removeEventListener("mouseup", releaseDragLock);
  if (updatecycle.value) {
    clearInterval(updatecycle.value);
    updatecycle.value = null;
  }
  disconnectTitleObserver();
});

onBeforeUnmount(() => {
  window.removeEventListener("mouseup", releaseDragLock);
  if (updatecycle.value) {
    clearInterval(updatecycle.value);
    updatecycle.value = null;
  }
  disconnectTitleObserver();
  cleanupDragPreview();
});
</script>

<style scoped lang="scss">
.video-watched {
  color: color-mix(in srgb, var(--color-primary) 70%, white 30%) !important;
  opacity: 0.6;
}

:global(html[data-theme="light"] .video-watched) {
  color: color-mix(in srgb, var(--color-primary) 44%, #0f172a 56%) !important;
  opacity: 1;
}

.video-card {
  background: transparent;
  cursor: pointer;
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: none !important;
  contain: layout style;
}

.video-card:hover {
  transform: none;
}

.video-card-fluid {
  width: 100%;
}

.video-card-shell {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  backface-visibility: hidden;
  border-radius: 1rem;
  display: flex;
  width: 100%;
  flex-direction: column;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-card) 92%, white 8%) 0%, var(--color-card) 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.04),
    0 12px 28px rgb(2 6 23 / 0.13);
  transition:
    box-shadow 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.video-card:hover .video-card-shell {
  border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border) 72%);
}

.video-card-dragging {
  opacity: 0.92;
  transform: scale(0.985);
}

.video-card-drag-preview {
  position: fixed !important;
  top: -1000px !important;
  left: -1000px !important;
  pointer-events: none !important;
  z-index: 9999 !important;
  overflow: hidden;
  box-shadow: none !important;
  transform: rotate(1.2deg) !important;
}

.video-thumbnail {
  overflow: hidden;
  border-radius: 0;
  background: rgb(15 23 42 / 0.3);
}

.video-card-overlay {
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
}

.text-live {
  color: red;
  font-weight: 500;
}
.video-card-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: row;
  gap: 0.625rem;
  min-height: 88px;
  position: relative;
  padding: 0.5rem 0.625rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent 28%);
  background: transparent;
  box-shadow: none !important;
}

.video-card-text-single-line {
  min-height: 96.1875px;
  height: 96.1875px;
}

.video-card-lines {
  min-width: 0;
  flex: 1 1 auto;
}

.video-card-avatar-slot {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.video-card-avatar-slot :deep(img),
.video-card-avatar-slot :deep(.v-image),
.video-card-avatar-slot :deep(.rounded) {
  box-shadow: 0 6px 16px rgb(2 6 23 / 0.14);
}

/* Grid mode avatar (live/upcoming): vertically centered, balanced padding */
.video-card-avatar-slot--grid {
  align-self: center !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.video-card-avatar-slot--grid :deep(img),
.video-card-avatar-slot--grid :deep(.rounded) {
  box-shadow: 0 4px 12px rgb(2 6 23 / 0.12);
}

.video-card-meta {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-top: auto;
}

.video-card-meta > div {
  margin-bottom: 2px;
}

.video-card-title-wrap {
  flex: 0 0 auto;
  min-height: 0;
}

.video-card-title-wrap-default {
  margin-top: 0.14rem;
}

.video-card-channel-slot {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  min-height: 0;
  min-width: 0;
}

.video-card-lines-single-line {
  height: 100%;
  justify-content: center;
  gap: 0.4rem;
  padding-top: 0;
  padding-bottom: 0;
}

.video-card-lines-single-line .video-card-title-wrap {
  margin-top: 0 !important;
  padding-top: 0;
  margin-bottom: 0;
}

.video-card-lines-single-line .video-card-meta {
  margin-top: 0;
  flex: 0 0 auto;
  justify-content: flex-start;
  gap: 0.26rem;
}

.video-card-lines-single-line .video-card-channel-slot {
  flex: 0 0 auto;
  align-items: center;
  padding-top: 0;
  min-height: 0;
}

.video-card-lines-single-line .video-card-meta > div {
  margin-bottom: 0;
}

.video-card-lines-single-line .video-card-time {
  margin-bottom: 0;
  transform: none;
  min-height: 1.05rem;
  margin-top: 0;
}

/* https://css-tricks.com/almanac/properties/w/word-break/ */
.video-card-title {
  line-height: 1.25rem !important;
  max-height: 2.5rem;
  cursor: pointer;
  /* Smooth out watched-state color changes after async IndexedDB lookups */
  transition: color 0.25s ease;

  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  word-break: break-word;

  -webkit-hyphens: auto;
  -moz-hyphens: auto;
  hyphens: auto;

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.channel-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.channel-name > a:hover {
  color: var(--color-foreground) !important;
}

.video-card .hover-placeholder {
  visibility: hidden;
  display: none;
  line-height: 13px;
  position: relative;
  top: 1px;
}

.video-card:hover .hover-placeholder {
  visibility: visible;
  display: inline-block;
  line-height: 13px;
  position: relative;
  top: 1px;
}

.video-card .duration-placeholder {
  visibility: visible;
  display: inline-block;
  line-height: 13px;
  position: relative;
  top: 1px;
}

.video-card:hover .duration-placeholder {
  visibility: hidden;
  display: none;
  line-height: 13px;
  position: relative;
  top: 1px;
}

.video-card .hover-opacity {
  opacity: 0.6;
}
.video-card:hover .hover-opacity {
  opacity: 1;
}

/* Smooth fade-in for thumbnails — only animates on network download, not cache */
.img-fade-in.img-pending {
  opacity: 0;
}
.img-fade-in.img-pending[data-fade-ready] {
  transition: opacity 0.3s ease;
}
.img-fade-in.loaded {
  opacity: 1;
}
.img-fade-in.hover-opacity.loaded {
  opacity: 0.6;
}

.video-duration {
  align-items: center;
  background: color-mix(in srgb, var(--color-primary) 30%, rgb(2 6 23 / 0.86) 70%);
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, rgb(255 255 255 / 0.18) 76%);
  color: rgb(248 250 252 / 0.98);
  display: inline-flex;
  justify-content: center;
  margin: 5px;
  min-height: 22px;
  padding: 2px 5px;
  text-align: center;
  font-size: 0.8125rem;
  letter-spacing: 0.025em;
  line-height: 1;
  text-shadow: 0 1px 1px rgb(2 6 23 / 0.2);
  vertical-align: middle;
  border-radius: 4px;
  box-shadow: 0 6px 18px rgb(2 6 23 / 0.18);

  &.video-duration-live {
    background: rgba(148, 0, 0, 0.88);
    border-color: rgba(255, 255, 255, 0.16);
    color: #fff;
  }
}

.video-topic {
  background: rgba(2, 6, 23, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgb(248 250 252 / 0.98);
  margin: 0.4rem;
  min-height: 22px;
  padding: 2px 5px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.8125rem;
  letter-spacing: 0.025em;
  line-height: 1;
  text-shadow: 0 1px 1px rgb(2 6 23 / 0.18);
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 6px 18px rgb(2 6 23 / 0.18);
}

/* Save/add button overlay — neutral, theme-independent */
.video-card-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  margin: 4px;
  border: 1.5px solid rgb(255 255 255 / 0.55);
  border-radius: 0.5rem;
  background: rgb(0 0 0 / 0.4);
  color: #f8fafc;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.video-card-action:hover {
  background: rgb(0 0 0 / 0.6);
  border-color: rgb(255 255 255 / 0.8);
}

.video-card-action-icon-unsaved {
  color: #f8fafc;
}

.video-card-menu-shell {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(2, 6, 23, 0.96);
  box-shadow: 0 24px 48px rgb(2 6 23 / 0.5);
}

:global(html[data-theme="light"] .video-duration) {
  background: color-mix(in srgb, var(--color-primary) 22%, rgb(255 255 255 / 0.96) 78%);
  border-color: color-mix(in srgb, var(--color-primary) 28%, rgb(148 163 184 / 0.34) 72%);
  color: color-mix(in srgb, var(--color-primary) 18%, #0f172a 82%);
  box-shadow: 0 8px 18px rgb(148 163 184 / 0.14);
  text-shadow: none;
}

:global(html[data-theme="light"] .video-duration.video-duration-live) {
  background: rgba(148, 0, 0, 0.92);
  border-color: rgba(255, 255, 255, 0.12);
  color: #fff;
}

:global(html[data-theme="light"] .video-topic) {
  background: rgba(2, 6, 23, 0.86);
  border-color: rgba(255, 255, 255, 0.18);
  color: rgb(248 250 252 / 0.98);
  box-shadow: 0 6px 18px rgb(2 6 23 / 0.18);
  text-shadow: 0 1px 1px rgb(2 6 23 / 0.18);
}

:global(html[data-theme="light"] .video-card-menu-shell) {
  border-color: rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 22px 48px rgb(148 163 184 / 0.22);
}

.video-card-horizontal {
  flex-direction: row !important;

  &:hover {
    transform: none;
  }

  .video-card-shell {
    flex-direction: row;
    background: transparent;
    border-color: transparent;
    filter: none;
    box-shadow: none !important;
    border-radius: 0;
  }

  &:hover .video-card-shell {
    background: color-mix(in srgb, var(--color-card) 55%, transparent 45%);
    border-color: transparent;
    filter: none;
  }

  .video-thumbnail {
    margin-right: 0;
    width: 128px !important;
    height: 72px !important;
    flex-shrink: 0;
    border-radius: 0.5rem;
    overflow: hidden;
    align-self: center;
    margin: 0.375rem 0 0.375rem 0.375rem;
  }

  .video-card-text {
    border-top: 0;
    border-left: 0;
    padding: 0.375rem 0.5rem;
    .video-card-lines {
      justify-content: space-around;
    }
  }
}

.video-card-list {
  flex-direction: row !important;
  min-height: 48px;

  /* No float on hover — list items stay flat */
  &:hover {
    transform: none;
  }

  .video-card-shell {
    flex-direction: row;
    min-height: 48px;
    /* Strip card shell to match list/horizontal mode — no float, no bg */
    background: transparent;
    border: none !important;
    filter: none;
    box-shadow: none !important;
    border-radius: 0;
  }

  &:hover .video-card-shell {
    background: color-mix(in srgb, var(--color-card) 55%, transparent 45%);
    border: none !important;
    filter: none;
    box-shadow: none !important;
  }

  .video-card-text {
    min-height: unset;
    padding: 0 0.5rem 0 0.25rem;
    border-top: 0;
    border-left: 0;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
  }

  .video-card-avatar-slot {
    flex-shrink: 0;
    margin: 0 !important;
  }

  .video-card-lines {
    flex: 1 1 0;
    min-width: 0;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center;
    gap: 0.625rem;
    margin: 0;
    padding: 0;
  }

  .video-card-title-wrap {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    margin: 0;
  }

  .video-card-title {
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.875rem;
    line-height: 1.3;
  }

  .video-card-meta {
    flex: 0 0 auto;
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    min-width: 0;

    & > div {
      margin-bottom: 0;
    }
  }

  .video-card-channel-slot {
    flex: 0 0 auto;
    max-width: 150px;
    overflow: hidden;
    display: flex;
    align-items: center;

    .channel-name {
      overflow: hidden;
      .plain-button {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 150px;
      }
    }
  }

  .video-card-time {
    flex: 0 0 auto;
    white-space: nowrap;
    overflow: hidden;
    min-width: 80px;
  }

  .video-card-item-actions {
    border-top: 0;
    border-left: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent 30%);
    padding: 0 0.5rem;
    align-self: stretch;
    height: auto;
    display: flex;
    align-items: center;
  }
}

:global(html[data-theme="light"] .video-card-shell) {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-card) 94%, white 6%) 0%, var(--color-card) 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.7),
    0 12px 28px rgb(148 163 184 / 0.15);
}

:global(html[data-theme="light"] .video-card:hover .video-card-shell) {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.82),
    0 22px 42px rgb(148 163 184 / 0.22);
}

:global(html[data-theme="light"] .video-card-drag-preview) {
  box-shadow: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .video-card,
  .video-card-shell,
  .video-card:hover,
  .video-card-shell:hover {
    transition: none !important;
    transform: none !important;
  }

  .video-card-drag-preview {
    transform: none !important;
  }
}

.name-vtuber {
  color: #42a5f5 !important;
}

.video-card-active {
  /* primary color with opacity */
  /* background-color: #f0629257; */
  height: auto;
  width: auto;
  position: relative;
}

.video-card-active::before {
  content: "";
  background-color: color-mix(in srgb, var(--color-primary) 65%, black 35%);
  background-size: cover;
  position: absolute;
  top: -1px;
  right: -1px;
  bottom: -1px;
  left: -1px;
  opacity: 0.15;
  border-radius: 4px;
}

.video-card-multiview-active .video-thumbnail,
.video-card-multiview-active .video-card-title {
  filter: grayscale(1);
  opacity: 0.3;
}

.video-card-subtitle {
  line-height: 1.2;
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
}

.video-card-time {
  display: flex;
  align-items: center;
  gap: 0.28rem;
  overflow: hidden;
  min-height: 1.05rem;
  flex: 0 0 auto;
}

.video-card-time-primary {
  display: inline-block;
  flex: 0 1 auto;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-card-time-secondary {
  flex: 0 0 auto;
  white-space: nowrap;
}

.live-viewers {
  color: var(--color-muted-foreground);
}
.plain-button:before {
  display: none;
}
.plain-button:hover:before {
  background-color: transparent;
}

.channel-name .plain-button {
  cursor: pointer;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-card-item-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.68rem 0.52rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent 30%);
  background: inherit;
}

.video-card-item-actions > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  padding: 0.35rem;
  color: var(--color-foreground);
  transition: background-color 0.15s ease;
}

.video-card-item-actions > button:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>
