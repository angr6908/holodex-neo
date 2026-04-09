<template>
  <div class="space-y-5">
    <div class="flex items-center gap-3">
      <div class="h-px flex-1 bg-white/10" />
      <span class="text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]">{{ $t("editor.music.titles.addSong") }}</span>
      <div class="h-px flex-1 bg-white/10" />
      <button type="button" class="inline-flex items-center gap-1 text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]" @click="helpOpen = true; mountTwitter()">
        <span>{{ $t("editor.music.titles.help") }}</span>
        <UiIcon :icon="icons.mdiHelpCircle" class-name="h-4 w-4 text-sky-300" />
      </button>
    </div>

    <UiDialog :open="helpOpen" class-name="w-auto max-w-3xl" @update:open="helpOpen = $event">
      <UiCard class-name="p-4">
        <blockquote class="twitter-tweet">
          <p lang="en" dir="ltr">
            Easily create Music entries on Holodex, coming soon! 🎵🎶
            <a href="https://t.co/1KJXYDcJjo">pic.twitter.com/1KJXYDcJjo</a>
          </p>
          &mdash; Holodex (@holodex)
          <a href="https://twitter.com/holodex/status/1371290072058785797?ref_src=twsrc%5Etfw">March 15, 2021</a>
        </blockquote>
      </UiCard>
    </UiDialog>

    <div class="grid gap-3 md:grid-cols-12">
      <div class="md:col-span-10">
        <song-search
          :id="current.itunesid"
          ref="search"
          :value="current.song"
          @input="processSearch"
        />
      </div>
      <div class="md:col-span-2">
        <label class="mb-2 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">TrackId</label>
        <UiInput
          :model-value="current.itunesid || 'N/A'"
          disabled
          class-name="text-xs"
        />
      </div>
      <div class="md:col-span-6">
        <label class="mb-2 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">{{ $t('editor.music.trackNameInput') }}</label>
        <UiInput
          v-model="current.name"
          :placeholder="$t('editor.music.trackNameInput')"
        />
      </div>
      <div class="md:col-span-6">
        <label class="mb-2 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">{{ $t('editor.music.originalArtistInput') }}</label>
        <UiInput
          v-model="current.original_artist"
          :placeholder="$t('editor.music.originalArtistInput')"
        />
      </div>
      <div class="md:col-span-6">
        <div class="flex items-start gap-2">
          <button
            type="button"
            class="tweak-btn red"
            :title="$t('editor.music.setToCurrentTime', [secondsToHuman(currentTime)])"
            @click="currentStartTime = secondsToHuman(currentTime)"
          >
            <UiIcon :icon="mdiAltimeter" class-name="h-4 w-4 rotate-90" />{{ formatDuration(currentTime * 1000) }}
          </button>

          <UiInput
            v-model="currentStartTime"
            placeholder="12:31"
            class="tweak-input"
            :class-name="checkStartTime(currentStartTime) ? '' : 'border-red-400/40'"
          />
        </div>
        <relative-timestamp-editor
          :value="Number(current.start)"
          :test="currentTime"
          @input="(x) => { current.start = x; currentStartTime = secondsToHuman(x); $emit('timeJump', current.start, true)}"
          @test="$emit('timeJump', current.start, true)"
          @seekTo="(x) => $emit('timeJump', x, true)"
        />
      </div>
      <div class="md:col-span-6">
        <div class="flex items-start gap-2">
          <button
            type="button"
            :class="'tweak-btn '+(currentTime < (current.start+10) ? '' : 'red')"
            :disabled="currentTime < (current.start+10)"
            :title="$t('editor.music.setToCurrentTime', [secondsToHuman(currentTime)])"
            @click="currentEndTime = secondsToHuman(currentTime); $emit('timeJump', currentTime - 3, true, false, currentTime)"
          >
            <UiIcon :icon="mdiAltimeter" class-name="h-4 w-4 rotate-90" />{{ formatDuration((currentTime) * 1000) }}
          </button>

          <button
            v-if="current.song && current.song.trackTimeMillis"
            type="button"
            class="tweak-btn red"
            :title="$t('editor.music.inheritItunesMusic', [`+${Math.ceil(current.song.trackTimeMillis / 1000)}`])"
            @click="currentEndTime = `+${Math.ceil(current.song.trackTimeMillis / 1000)}`;
                    $emit('timeJump', current.start + current.song.trackTimeMillis / 1000 - 3, true, false, current.start + current.song.trackTimeMillis / 1000)"
          >
            <UiIcon :icon="mdiTimelinePlusOutline" class-name="h-4 w-4" />{{ formatDuration((current.start * 1000 + current.song.trackTimeMillis)) }}
          </button>

          <UiInput
            v-model="currentEndTime"
            placeholder="312"
            class="tweak-input"
            :class-name="checkEndTime(currentEndTime) ? '' : 'border-red-400/40'"
          />
        </div>
        <relative-timestamp-editor
          :value="Number(current.end)"
          :up-to="true"
          :test="currentTime"
          @input="(x) => { current.end = x; currentEndTime = secondsToHuman(x); $emit('timeJump', current.end - 3, true, false, current.end)}"
          @test="$emit('timeJump', current.end - 3, true, false, current.end)"
          @seekTo="(x) => $emit('timeJump', x, true)"
        />
      </div>
      <div class="md:col-span-8">
        <UiButton
          type="button"
          class-name="w-full"
          :disabled="!canSave || !priviledgeSufficient"
          @click="addSong"
        >
          {{ addOrUpdate }}
        </UiButton>
      </div>
      <div class="md:col-span-1">
        <UiButton
          type="button"
          variant="destructive"
          class-name="w-full px-0"
          @click="reset"
        >
          <UiIcon :icon="mdiRestore" />
        </UiButton>
      </div>
      <div class="md:col-span-3">
        <UiButton
          as="a"
          variant="secondary"
          :disabled="!current.amUrl"
          class="am-listen-btn"
          :href="current.amUrl"
          rel="norefferer"
          target="_blank"
        >
          <img
            src="https://apple-resources.s3.amazonaws.com/medusa/production/images/5f600674c4f022000191d6c4/en-us-large@1x.png"
            class="h-[26px] w-[26px] rounded-sm object-cover"
            alt=""
          >
          <span class="ml-2" style="font-size: 0.7rem">Listen on Apple Music</span>
        </UiButton>
      </div>
      <div v-if="!canSave && !priviledgeSufficient" class="md:col-span-12 rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-3 text-sm text-red-100">
        <div
          v-if="!canSave && !priviledgeSufficient"
          v-html="$t('editor.music.permission')"
        />
      </div>
    </div>

    <div class="flex items-center gap-3">
      <div class="h-px flex-1 bg-white/10" />
      <span class="text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]">{{ $t("editor.music.titles.songList", [video.title]) }}</span>
      <div class="h-px flex-1 bg-white/10" />
    </div>

    <div class="max-h-[45vh] min-h-[30vh] overflow-y-auto">
      <div class="space-y-2">
        <template v-for="song in songList" :key="song.name">
          <song-item
            :song="song"
            detailed
            :hover-icon="icons.mdiPencil"
            :artwork-hover-icon="icons.mdiPlay"
            @remove="removeSong"
            @play="
              (x) => {
                $emit('timeJump', x.start);
                current = JSON.parse(JSON.stringify(x));
                currentStartTimeInput = secondsToHuman(current.start);
              }
            "
            @playNow="(x) => $emit('timeJump', x.start, true)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  mdiRestore, mdiTimelinePlusOutline, mdiAltimeter,
} from "@mdi/js";

defineEmits<{
  (e: "timeJump", time: number): void;
}>();

import backendApi from "@/utils/backend-api";
import { secondsToHuman, formatDuration } from "@/utils/time";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import { useAppStore } from "@/stores/app";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import SongSearch from "../media/SongSearch.vue";
import SongItem from "../media/SongItem.vue";
import RelativeTimestampEditor from "./RelativeTimestampEditor.vue";
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import * as icons from "@/utils/icons";

const { t } = useI18n();
const appStore = useAppStore();

function humanToSeconds(str: string) {
  const p = str.split(":");
  let s = 0;
  let m = 1;
  while (p.length > 0) {
    s += m * parseInt(p.pop()!, 10);
    m *= 60;
  }
  return s;
}

function maskTimestamp(s: string) {
  const p = s.split(":").join("").split("");
  const newStr: string[] = [];

  // remove prefix zeroes
  while (p.length > 0 && p[0] === "0") {
    p.shift();
  }

  // Parse numbers in groups of 2
  while (p.length > 0) {
    if (p.length === 1) {
      newStr.unshift(`${p}`);
      break;
    }
    const swap = p.pop();
    newStr.unshift(p.pop()! + swap);
  }

  return newStr.join(":");
}

const startTimeRegex = /^\d+([:]\d+)?([:]\d+)?$/;
const endTimeRegex = /^\+\d+$|^\d+(:\d+)?(:\d+)?$/;

function getEmptySong(video: any) {
  return {
    song: null,
    itunesid: null as number | null,
    start: 0,
    end: 12,
    name: "",
    original_artist: "",
    amUrl: null as string | null,
    art: null as string | null,
    video_id: video.id,
    channel_id: video.channel.id,
    creator_id: null as string | null,
    channel: {
      name: video.channel.name,
      english_name: video.channel.english_name,
    },
    available_at: video.available_at,
  };
}

const props = withDefaults(defineProps<{
  video: any;
  currentTime?: number;
}>(), {
  currentTime: 0,
});

const search = ref<any>(null);
const current = ref(getEmptySong(props.video));
const songList = ref<any[]>([]);
const currentStartTimeInput = ref("");
const helpOpen = ref(false);

const priviledgeSufficient = computed(() => {
  const isUpdate = songList.value.find((m) => m.name === current.value.name);
  const user = appStore.userdata && appStore.userdata.user;
  const userRole = user && user.role;
  const userId = user && user.id;
  return (
    !isUpdate
    || (isUpdate
      && (userRole === "admin"
        || userRole === "editor"
        || (userId && userId.length > 0 && +current.value.creator_id! === +userId)))
  );
});

const currentStartTime = computed({
  get() {
    return currentStartTimeInput.value;
  },
  set(val: string) {
    currentStartTimeInput.value = maskTimestamp(val);
    if (checkStartTime(currentStartTimeInput.value)) {
      const duration = current.value.end - current.value.start;
      current.value.start = humanToSeconds(currentStartTimeInput.value);
      current.value.end = current.value.start + duration;
    }
  },
});

const currentEndTime = computed({
  get() {
    return `${current.value.end - current.value.start}`;
  },
  set(val: string) {
    if (checkEndTime(val)) {
      if (val.includes(":")) {
        current.value.end = humanToSeconds(val);
      } else {
        current.value.end = current.value.start + +val;
      }
    }
  },
});

const canSave = computed(() => current.value.end - current.value.start > 13 && current.value.name);

const addOrUpdate = computed(() => {
  if (songList.value.find((m) => m.name === current.value.name)) {
    return t("editor.music.update");
  }
  return t("editor.music.add");
});

onMounted(() => {
  refreshSongList();
});

function processSearch(item: any) {
  current.value.song = item;
  if (item) {
    current.value.itunesid = item.trackId;
    current.value.name = item.trackName;
    current.value.original_artist = item.artistName;
    if (!current.value.end || current.value.end < 10 || current.value.end < (current.value.start + 10)) {
      currentEndTime.value = `+${Math.ceil(item.trackTimeMillis / 1000)}`;
    }
    current.value.amUrl = item.trackViewUrl;
    current.value.art = item.artworkUrl100;
  } else {
    current.value.itunesid = -1;
    current.value.amUrl = null;
    current.value.art = null;
  }
}

function checkStartTime(val: string) {
  return startTimeRegex.test(val);
}

function checkEndTime(val: string) {
  return endTimeRegex.test(val);
}

async function addSong() {
  await saveCurrentSong();
  current.value = getEmptySong(props.video);
  search.value.query = null;
  await refreshSongList();
}

async function refreshSongList() {
  songList.value = (await backendApi.songListByVideo(props.video.channel.id, props.video.id, false)).data.sort(
    (a: any, b: any) => a.start - b.start,
  );
}

async function saveCurrentSong() {
  await backendApi.tryCreateSong(current.value, appStore.userdata.jwt);
}

function reset() {
  current.value = getEmptySong(props.video);
  refreshSongList();
}

async function removeSong(song: any) {
  await backendApi.deleteSong(song, appStore.userdata.jwt);
  refreshSongList();
}

function mountTwitter() {
  const externalScript = document.createElement("script");
  externalScript.setAttribute("src", "https://platform.twitter.com/widgets.js");
  externalScript.setAttribute("async", "true");
  document.head.appendChild(externalScript);
}
</script>

<style lang="scss">
.am-listen-btn {
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
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;

    justify-content: left;
    text-align: left;
    font-size: small;

    padding-top: 3px !important;
}

button.tweak-btn {
    background-color: rgba(255, 255, 255, 0.12);
    color: rgb(241, 241, 241);
    border-radius: 2px;
    margin: 1px 2px;
    padding: 5px;
    min-width: 50px;
    width: 70px;
    font-family: monospace;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
}

button.tweak-btn:not(:disabled):hover {
    background-color: rgba(255, 255, 255, 0.18);
}
.tweak-input {
    margin-left: 2px !important;
    margin-right: 2px !important;
}
</style>
