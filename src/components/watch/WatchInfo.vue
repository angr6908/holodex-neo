<template>
  <UiCard class-name="watch-card rounded-none border-x-0 px-0 py-0 shadow-none">
    <div class="relative px-4 py-4">
      <div class="text-lg font-medium text-[color:var(--color-foreground)]">
        <span v-if="!$route.path.includes('edit')">
          {{ video.jp_name ?
            (settingsStore.nameProperty === 'english_name' ?
              video.title || video.jp_name
              : (video.jp_name || video.title))
            : video.title }}
        </span>

        <router-link
          v-else
          v-slot="{ navigate }"
          :to="`/watch/${video.id}`"
          custom
        >
          <span style="cursor: pointer" @click="navigate">{{ video.title }}</span>
        </router-link>
      </div>

      <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-sm text-[color:var(--color-muted-foreground)]">
        <span :class="'text-' + video.status" :title="absoluteTimeString">
          {{ formattedTime }}
        </span>
        <span v-if="video.status !== 'live' && video.duration" class="inline-flex items-center gap-1">
          • {{ formatDuration(video.duration * 1000) }}
        </span>
        <span
          v-if="video.status === 'live' && liveViewers"
          class="live-viewers inline-flex items-center gap-1"
        >
          • {{ $t("component.videoCard.watching", [liveViewers]) }}
          <span
            v-if="liveViewerChange"
            :class="liveViewerChange > 0 ? 'text-emerald-400' : 'text-rose-400'"
          >
            ({{ (liveViewerChange > 0 ? "+ " : "") + liveViewerChange }})
          </span>
        </span>
        <span
          v-if="video.topic_id"
          class="inline-flex items-center gap-1"
          style="text-transform: capitalize"
        >
          • <router-link
            :to="searchTopicUrl"
            class="inline-flex items-center gap-1 text-sky-300 no-underline"
          >
            <UiIcon :icon="icons.mdiAnimationPlay" size="sm" />
            {{ video.topic_id }}
          </router-link>
        </span>
        <span
          v-if="video.type === 'placeholder' && !(video.certainty === 'certain')"
          class="basis-full"
          style="font-size:95%"
        >
          {{ $t("component.videoCard.uncertainPlaceholder") }}
        </span>
      </div>
      <slot name="rightTitleAction">
        <UiButton
          id="video-edit-btn"
          as="router-link"
          variant="outline"
          size="sm"
          class-name="watch-edit-btn absolute bottom-4 right-4"
          :to="
            $route.path.includes('edit')
              ? `/watch/${video.id}`
              : `/edit/video/${video.id}${
                video.type !== 'stream' ? '/mentions' : '/'
              }`
          "
        >
          {{
            $route.path.includes("edit")
              ? $t("editor.exitMode")
              : $t("editor.enterMode")
          }}
        </UiButton>
      </slot>
    </div>

    <div class="border-t border-[color:var(--color-border)]" />

    <div class="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
      <div class="flex min-w-0 items-center gap-4">
        <div class="shrink-0">
          <ChannelImg
            :channel="video.channel"
            size="80"
          />
        </div>
        <ChannelInfo
          :channel="video.channel"
          class="uploader-data-list"
          :no-subscriber-count="noSubCount"
        />
        <ChannelSocials :channel="video.channel" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          v-if="channelChips && channelChips.length > 0"
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)]"
        >
          <UiIcon :icon="mdiAt" />
        </div>
        <ChannelChip
          v-for="mention in channelChips"
          :key="mention.id"
          :channel="mention"
          :size="60"
        />
        <button
          v-if="mentions.length > 3"
          type="button"
          class="text-sm text-sky-300"
          @click="showAllMentions = !showAllMentions"
        >
          [ {{ showAllMentions ? "-" : "+" }} {{ mentions.length - 3 }} ]
        </button>
      </div>
    </div>

    <slot>
      <div
        class="px-4 pb-4 text-sm text-[color:var(--color-muted-foreground)]"
        @click="handleClick"
      >
        <truncated-text
          :html="processedMessage"
          lines="4"
        >
          <template #button="{ expanded }">
            <UiButton
              type="button"
              variant="ghost"
              size="sm"
            >
              {{ expanded ? $t("component.description.showLess") : $t("component.description.showMore") }}
            </UiButton>
          </template>
        </truncated-text>
      </div>
    </slot>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import ChannelChip from "@/components/channel/ChannelChip.vue";
import ChannelInfo from "@/components/channel/ChannelInfo.vue";
import ChannelSocials from "@/components/channel/ChannelSocials.vue";
import ChannelImg from "@/components/channel/ChannelImg.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

import {
  formatDuration,
  formatDistance,
  dayjs,
  localizedDayjs,
  titleTimeString,
} from "@/utils/time";
import TruncatedText from "@/components/common/TruncatedText.vue";
import { mdiAt } from "@mdi/js";
import { formatCount } from "@/utils/functions";
import { useSettingsStore } from "@/stores/settings";

defineOptions({ name: "WatchInfo" });

const COMMENT_TIMESTAMP_REGEX = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])/gm;

const props = withDefaults(defineProps<{
  video: Record<string, any>;
  noChips?: boolean;
  noSubCount?: boolean;
}>(), {
  noChips: false,
  noSubCount: false,
});

const emit = defineEmits<{
  (e: "timeJump", time: string): void;
}>();

const { t } = useI18n();
const settingsStore = useSettingsStore();

const timer = ref<ReturnType<typeof setInterval> | null>(null);
const elapsedTime = ref("");
const showAllMentions = ref(false);
const lastViewerCount = ref(-1);

const lang = computed(() => settingsStore.lang);

const absoluteTimeString = computed(() =>
  titleTimeString(props.video.available_at, lang.value),
);

const formattedTime = computed(() => {
  switch (props.video.status) {
    case "upcoming":
      return formatDistance(
        props.video.start_scheduled,
        lang.value,
        t,
      );
    case "live":
      return t("component.watch.streamingFor", [elapsedTime.value]);
    default:
      return localizedDayjs(props.video.available_at, lang.value).format(
        "LLL",
      );
  }
});

const liveViewers = computed(() => {
  if (!props.video.live_viewers) return "";
  return formatCount(+props.video.live_viewers, lang.value);
});

const liveViewerChange = computed(() => {
  if (lastViewerCount.value < 0) return 0;
  return props.video.live_viewers - lastViewerCount.value;
});

const mentions = computed(() => props.video.mentions || []);

const channelChips = computed(() =>
  mentions.value.length > 3 && !showAllMentions.value
    ? mentions.value.slice(0, 3)
    : mentions.value,
);

const processedMessage = computed(() => {
  const decoder = document.createElement("div");
  decoder.innerHTML = props.video.description;
  const sanitized = decoder.textContent!;
  const vidUrl = (settingsStore.redirectMode
    ? "https://youtu.be/"
    : "/watch/") + props.video.id;
  return sanitized.replace(
    COMMENT_TIMESTAMP_REGEX,
    (match, hr, min, sec) => {
      const time = Number(hr ?? 0) * 3600 + Number(min) * 60 + Number(sec);
      return `<a class="comment-chip" href="${vidUrl}?t=${time}" data-time="${time}"> ${match} </a>`;
    },
  );
});

const searchTopicUrl = computed(() => {
  const topic = props.video.topic_id;
  const capitalizedTopic = topic[0].toUpperCase() + topic.slice(1);
  const { org } = props.video.channel;
  let q = `type,value,text\ntopic,"${topic}","${capitalizedTopic}"`;
  if (org) {
    q += `\norg,${org},${org}`;
  }
  return `/search?${new URLSearchParams({ q })}`;
});

function setTimer() {
  if (timer.value) clearInterval(timer.value);
  if (props.video.status === "live") {
    timer.value = setInterval(() => {
      elapsedTime.value = formatDuration(
        dayjs().diff(dayjs(props.video.start_actual)),
      );
    }, 1000);
  }
}

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.matches(".comment-chip")) {
    emit("timeJump", target.getAttribute("data-time")!);
    e.preventDefault();
  }
}

watch(() => props.video.status, () => {
  setTimer();
});

watch(() => props.video.live_viewers, (_nw, old) => {
  lastViewerCount.value = old;
});

onMounted(() => {
  setTimer();
});

onBeforeUnmount(() => {
  if (timer.value) clearInterval(timer.value);
});
</script>

<style>
.watch-card {
  border: none !important;
  box-shadow: none !important;
}

.uploader-data-list {
  flex-basis: auto;
  flex-direction: column;
  align-items: stretch;
  margin-right: 12px;
}

/* Edit button — matches fav-login-btn style */
.watch-edit-btn {
  border-color: var(--color-light) !important;
  background: var(--color-card) !important;
  color: var(--color-muted-foreground) !important;
  font-size: 12px;
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
}

.watch-edit-btn:hover {
  border-color: var(--color-bold) !important;
  background: var(--color-base) !important;
  color: var(--color-foreground) !important;
}
</style>
