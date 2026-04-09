<template>
  <div>
    <template v-if="showSongs && video.songcount">
      <div class="lightup flex items-center gap-2">
        <button type="button" class="mx-2 my-1 pr-2 text-xs uppercase tracking-[0.2em] text-slate-300" @click="toggleExpansion('songs')">
          {{ hidden.songs ? "＋" : "－" }} {{ video.songcount }} {{ relationI18N("songs") }}
        </button>
        <div class="flex-1" />
        <UiButton
          type="button"
          size="icon"
          variant="ghost"
          class-name="mr-2 my-1 h-8 w-8"
          @click="showDetailed = !showDetailed"
        >
          <UiIcon :icon="mdiTimerOutline" size="sm" />
        </UiButton>
        <UiButton
          type="button"
          size="icon"
          variant="ghost"
          class-name="mr-2 my-1 h-8 w-8"
          @click="addToMusicPlaylist"
        >
          <UiIcon :icon="icons.mdiMusic" size="sm" />
        </UiButton>
      </div>

      <div v-show="!hidden.songs" class="px-2 py-0">
        <div class="w-full">
          <SongItem
            v-for="(song, idx) in songList"
            :key="song.name + song.video_id + idx"
            :detailed="showDetailed"
            :song="song"
            :hover-icon="icons.mdiPlay"
            style="width: 100%"
            @play="$emit('timeJump', song.start)"
            @playNow="$emit('timeJump', song.start)"
          />
        </div>
      </div>
    </template>

    <template v-for="relation in orderedRelations" :key="relation">
      <template v-if="related[relation].length">
        <div class="lightup flex items-center gap-2">
          <button
            type="button"
            class="mx-2 my-1 pr-2 text-xs uppercase tracking-[0.2em] text-slate-300"
            @click="toggleExpansion(relation)"
          >
            {{ hidden[relation] ? "＋" : "－" }} {{ related[relation].length }} {{ relationI18N(relation) }}
          </button>
          <div class="flex-1" />
          <UiButton
            v-if="relation === 'simulcasts'"
            type="button"
            size="icon"
            variant="ghost"
            class-name="mr-2 my-1 h-8 w-8"
            :disabled="!simulcastMultiviewLink.ok"
            :title="simulcastTooltip"
            @click="openSimulcastLayout"
          >
            <UiIcon :icon="icons.mdiViewDashboard" size="sm" />
          </UiButton>
          <UiButton
            :key="`playlist-btn-${relation}`"
            type="button"
            size="icon"
            variant="ghost"
            class-name="mr-2 my-1 h-8 w-8"
            @click="addToPlaylist(related[relation])"
          >
            <UiIcon :icon="icons.mdiPlaylistPlus" size="sm" />
          </UiButton>
        </div>

        <VideoCardList
          v-show="!hidden[relation]"
          :key="`${relation}-videos`"
          :videos="related[relation]"
          horizontal
          include-channel
          :cols="{
            lg: 12,
            md: 4,
            cols: 12,
            sm: 6,
          }"
          dense
          @videoClicked="logRelationClick(relation)"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, getCurrentInstance, defineAsyncComponent } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import VideoCardList from "@/components/video/VideoCardList.vue";
import { useFilterVideos } from "@/composables/useFilterVideos";
import { mdiTimerOutline } from "@mdi/js";
import { videoTemporalComparator } from "@/utils/functions";
import { musicdexURL } from "@/utils/consts";
import { decodeLayout, encodeLayout } from "@/utils/mv-utils";
import { useMultiviewStore } from "@/stores/multiview";
import { useSettingsStore } from "@/stores/settings";
import { usePlaylistStore } from "@/stores/playlist";
const SongItem = defineAsyncComponent(() => import("@/components/media/SongItem.vue"));

defineOptions({ name: "WatchSideBar" });

const props = withDefaults(defineProps<{
  video: Record<string, any>;
  showSongs?: boolean;
  showRelations?: boolean;
}>(), {
  showSongs: true,
  showRelations: true,
});

defineEmits<{
  (e: "timeJump", time: number): void;
}>();

const router = useRouter();
const { t } = useI18n();
const { filterVideos } = useFilterVideos();
const multiviewStore = useMultiviewStore();
const settingsStore = useSettingsStore();
const playlistStore = usePlaylistStore();
const instance = getCurrentInstance();

const showDetailed = ref(false);
const hidden = ref<Record<string, boolean>>({
  clips: false,
  simulcasts: false,
  sources: false,
  recommendations: false,
  songs: false,
  same_source_clips: false,
  refers: false,
});

const autoLayout = computed(() => multiviewStore.autoLayout);

const related = computed(() => {
  const clips = props.video.clips
    ?.filter?.((x: any) => x.status !== "missing" && settingsStore.clipLangs.includes(x.lang))
    .sort(videoTemporalComparator)
    .reverse() || [];
  return {
    simulcasts: props.video.simulcasts || [],
    clips,
    sources: props.video.sources || [],
    same_source_clips: (props.video.same_source_clips && props.video.same_source_clips.slice(0, 10)) || [],
    recommendations: (props.video.recommendations && props.video.recommendations.slice(0, 10)) || [],
    refers: props.video.refers || [],
  };
});

const songList = computed(() => {
  if (props.video && props.video.songs) {
    return props.video.songs
      .map((song: any) => ({
        ...song,
        video_id: props.video.id,
        channel_id: props.video.channel.id,
        channel: props.video.channel,
      }))
      .sort((a: any, b: any) => a.start - b.start);
  }
  return [];
});

const orderedRelations = computed(() => {
  if (!props.showRelations) return [];
  return [
    "simulcasts",
    "clips",
    "sources",
    "same_source_clips",
    "recommendations",
    "refers",
  ];
});

const simulcastMultiviewLink = computed(() => {
  if (!related.value.simulcasts.length) {
    return {
      ok: false,
      error: {
        reason: "noSimulcasts",
        i18nParameters: {},
      },
    };
  }

  const defaultLayoutString = autoLayout.value[related.value.simulcasts.length + 1];
  if (!defaultLayoutString) {
    return {
      ok: false,
      error: {
        reason: "noDefaultLayout",
        i18nParameters: {
          videoCount: related.value.simulcasts.length + 1,
        },
      },
    };
  }

  const { layout, content } = decodeLayout(defaultLayoutString);
  if (!layout) {
    return {
      ok: false,
      error: {
        reason: "layoutBuildFailure",
        i18nParameters: {},
      },
    };
  }

  const allSimulcastVideos = [
    {
      type: "video",
      id: props.video.id,
    },
    ...related.value.simulcasts.map((simulcast: any) => ({
      type: "video",
      id: simulcast.id,
    })),
  ];

  const filledContents = Object.fromEntries(layout.map(({ i }: any) => [i, content[i] ?? allSimulcastVideos.shift()]));

  if (allSimulcastVideos.length) {
    return {
      ok: false,
      error: {
        reason: "layoutBuildFailure",
        i18nParameters: {},
      },
    };
  }

  const layoutURIComponent = encodeLayout({
    layout,
    contents: filledContents,
    includeVideo: true,
  });

  if (!layoutURIComponent || layoutURIComponent === "error") {
    return {
      ok: false,
      error: {
        reason: "layoutBuildFailure",
        i18nParameters: {},
      },
    };
  }

  return {
    ok: true,
    url: `/multiview/${encodeURIComponent(layoutURIComponent)}`,
  };
});

const simulcastTooltip = computed(() => {
  if (simulcastMultiviewLink.value.ok) {
    return t("component.relatedVideo.simulcasts.linkToMultiview.tooltip");
  }
  return t(`component.relatedVideo.simulcasts.linkToMultiview.error.${(simulcastMultiviewLink.value as any).error.reason}`, (simulcastMultiviewLink.value as any).error.i18nParameters);
});

// Run created logic immediately
hidden.value.recommendations = (related.value.clips.length + related.value.sources.length + related.value.same_source_clips.length) >= 5;
hidden.value.refers = related.value.refers.length > 0 && (related.value.clips.length + related.value.simulcasts.length) >= 3;

function relationI18N(relation: string) {
  switch (relation) {
    case "clips":
      return t("component.relatedVideo.clipsLabel");
    case "simulcasts":
      return t("component.relatedVideo.simulcastsLabel");
    case "sources":
      return t("component.relatedVideo.sourcesLabel");
    case "recommendations":
      return t("component.relatedVideo.recommendationsLabel");
    case "songs":
      return t("component.relatedVideo.songsLabel");
    case "same_source_clips":
      return t("component.relatedVideo.sameSourceClips");
    case "refers":
      return t("component.relatedVideo.refersLabel");
    default:
      return "";
  }
}

function toggleExpansion(relation: string) {
  hidden.value[relation] = !hidden.value[relation];
}

function addToMusicPlaylist() {
  window.open(`${musicdexURL}/video/${props.video.id}`, "_blank");
}

function addToPlaylist(videos: any[]) {
  const reversed = [...videos].filter((v) => filterVideos(v, { hideIgnoredTopics: false }));
  reversed.reverse();
  playlistStore.addVideos(reversed);
}

function logRelationClick(relation: string) {
  instance?.proxy?.$gtag?.event("sidebar-click", {
    event_category: "video",
    event_label: relation,
  });
}

function openSimulcastLayout() {
  if (simulcastMultiviewLink.value.ok) {
    router.push((simulcastMultiviewLink.value as any).url);
  }
}
</script>

<style>
.lightup {
    z-index: 1;
    position: relative;
    display: block;
}

.lightup * {
    z-index: 1;
    line-height: 28px !important;
}

.lightup::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
}

.lightup:hover::after {
    background-color: rgb(255 255 255 / 0.06);
    z-index: -1;
}
</style>
