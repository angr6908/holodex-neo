<template>
  <div
    class="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-white/5"
    @click.stop="$emit('play', song)"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl" @mouseenter="hoverInner = true" @mouseleave="hoverInner = false">
      <!-- actual artwork -->
      <img v-if="song.art" :src="song.art" class="h-full w-full object-cover">
      <!-- artwork not available, have a stand-in -->
      <div
        v-else
        class="flex h-full w-full bg-slate-700 p-1"
      >
        <UiButton
          size="icon"
          variant="outline"
          class-name="m-auto h-8 w-8"
          disabled
        >
          <UiIcon :icon="icons.mdiMusic" size="sm" />
        </UiButton>
      </div>
      <!-- Queue up button or default item click button -->
      <div
        v-if="hover && !hoverInner"
        class="hover-item absolute left-0 top-0 flex h-full w-full p-1"
        style="position: absolute; left: 0px"
      >
        <UiButton
          size="icon"
          class-name="m-auto h-8 w-8 rounded-full bg-sky-300 text-slate-950 shadow-md"
        >
          <UiIcon :icon="hoverIcon" size="sm" />
        </UiButton>
      </div>
      <!-- Play immediately button over the artwork -->
      <div
        v-if="$attrs.onPlayNow && hoverInner"
        class="hover-art absolute left-0 top-0 flex h-full w-full p-1"
        style="position: absolute; left: 0px"
      >
        <UiButton
          size="icon"
          class-name="m-auto h-8 w-8 rounded-full bg-sky-300 text-slate-950 shadow-md"
          @click.stop.prevent="$emit('playNow', song)"
        >
          <UiIcon :icon="artworkHoverIcon" size="sm" />
        </UiButton>
      </div>
    </div>
    <div class="min-w-0 flex-1 py-1 pt-1">
      <div class="text-base leading-7" :class="color">
        <a
          v-if="alwaysShowDeletion || (detailed && $attrs.onRemove && userCanDelete)"
          class="text-xs text-red-400 float-right ml-1 song-clickable"
          @click.stop="$emit('remove', song)"
        >
          {{ $t("component.media.remove") }}
        </a>
        <div v-if="detailed" class="float-right text-caption">
          [{{ secondsToHuman(song.start) }} - {{ secondsToHuman(song.end) }}]
        </div>

        <span class="limit-width">
          {{ song.name }} /
          <span class="text-[color:var(--color-primary)]">{{ song.original_artist }}</span>
        </span>
      </div>

      <div class="text-xs leading-5" :class="color">
        <div class="float-right">
          <span v-if="showTime" class="muted">{{ formattedTime }}</span>
          {{ Math.floor((song.end - song.start) / 60) }}:{{
            (Math.round(song.end - song.start) % 60).toString().padStart(2, "0")
          }}
        </div>

        <span v-if="$attrs.onChannel" class="song-clickable" @click.stop="$emit('channel', song)">
          {{ song.channel[nameProperty] || song.channel.name }}
        </span>
        <span v-else> {{ song.channel[nameProperty] || song.channel.name }} </span>
      </div>
      <!-- Else: -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatDistance, secondsToHuman } from "@/utils/time";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";

const props = defineProps({
  song: {
    type: Object,
    required: true,
  },
  showArtist: {
    type: Boolean,
    default: true,
  },
  showSongArt: {
    type: Boolean,
    default: true,
  },
  verticalList: {
    type: Boolean,
    default: true,
  },
  detailed: {
    // will only show remove button if listener exists and user has DELETE/WRITE priviledge to this song.
    type: Boolean,
    default: false,
  },
  alwaysShowDeletion: {
    // set to true to FORCE the remove button to show up. For use in playlists where removal is from playlist.
    type: Boolean,
    default: false,
  },
  showTime: {
    type: Boolean,
    default: false,
  },
  hoverIcon: {
    type: String,
    default: null,
  },
  artworkHoverIcon: {
    type: String,
    default: null,
  },
  color: {
    type: String,
    default: null,
  },
});

defineEmits(["play", "playNow", "remove", "channel"]);

const appStore = useAppStore();
const settingsStore = useSettingsStore();
const { t } = useI18n();

const hover = ref(false);
const hoverInner = ref(false);

const userCanDelete = computed(() => {
  const u = appStore.userdata;
  return (
    u
    && u.user
    && u.user.role
    && u.user.id
    && (u.user.role !== "user" || +u.user.id === +props.song.creator_id)
  );
});

const formattedTime = computed(() =>
  formatDistance(props.song.available_at, settingsStore.langSetting, t)
);

const nameProperty = computed(() => settingsStore.nameProperty);
</script>

<style scoped>
.limit-width {
    white-space: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    /* https://css-tricks.com/almanac/properties/w/word-break/ */
    word-break: break-all;
    word-break: break-word;

    -webkit-hyphens: auto;
    -moz-hyphens: auto;
    hyphens: auto;

    display: -webkit-box;
    line-clamp: 1;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;

    justify-content: left;
    text-align: left;
    color: inherit;
}
.song-clickable {
    text-decoration: none;
}
.song-clickable:hover {
    text-decoration: underline;
    background-color: rgba(120, 120, 120, 0.4);
}
.text-xs .muted {
    opacity: 0.4;
}
</style>
