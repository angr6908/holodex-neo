<template>
  <div v-if="video" class="space-y-1 p-1 text-sm">
    <template v-if="video.type !== 'placeholder'">
      <a
        target="_blank"
        :href="`https://youtu.be/${video.id}`"
        class="video-card-menu-item"
        @click.stop="closeMenu()"
      >
        <UiIcon :icon="icons.mdiYoutube" class-name="h-4 w-4" />
        {{ $t("views.settings.redirectModeLabel") }}
      </a>

      <button
        v-if="video.status === 'upcoming'"
        type="button"
        class="video-card-menu-item"
        @click.prevent.stop="
          openGoogleCalendar();
          closeMenu();
        "
      >
        <UiIcon :icon="icons.mdiCalendar" class-name="h-4 w-4" />
        {{ $t("component.videoCard.googleCalendar") }}
      </button>
      <router-link
        :to="`/edit/video/${video.id}${
          video.type !== 'stream' ? '/mentions' : '/'
        }`"
        class="video-card-menu-item"
        @click="closeMenu()"
      >
        <UiIcon :icon="icons.mdiPencil" class-name="h-4 w-4" />
        {{ $t("component.videoCard.edit") }}
      </router-link>
      <template v-if="video.type !== 'clip'">
        <router-link
          :to="`/multiview/AAUY${video.id}%2CUAEYchat`"
          class="video-card-menu-item"
          @click="closeMenu()"
        >
          <UiIcon :icon="icons.mdiViewDashboard" class-name="h-4 w-4" />
          {{ $t("component.mainNav.multiview") }}
        </router-link>
      </template>
      <button
        type="button"
        class="video-card-menu-item"
        @click="showPlaylist = !showPlaylist"
      >
        <UiIcon :icon="icons.mdiPlaylistPlus" class-name="h-4 w-4" />
        {{ $t("component.mainNav.playlist") }}
        <UiIcon :icon="icons.mdiChevronRight" class-name="ml-auto h-4 w-4 transition" :class="{ 'rotate-90': showPlaylist }" />
      </button>
      <div v-if="showPlaylist" class="video-card-menu-playlist" :class="{ 'open': showPlaylist }">
        <video-quick-playlist
          :key="video.id + Date.now()"
          :video-id="video.id"
          :video="video"
        />
      </div>
      <button
        type="button"
        class="video-card-menu-item"
        :class="doneCopy ? 'video-card-menu-item-done' : ''"
        @click.stop="
          copyLink();
          closeMenu();
        "
      >
        <UiIcon :icon="icons.mdiClipboardPlusOutline" class-name="h-4 w-4" />
        {{ $t("component.videoCard.copyLink") }}
      </button>
    </template>
    <template v-else>
      <button
        v-if="video.status === 'upcoming'"
        type="button"
        class="video-card-menu-item"
        @click.prevent.stop="
          openGoogleCalendar();
          closeMenu();
        "
      >
        <UiIcon :icon="icons.mdiCalendar" class-name="h-4 w-4" />
        {{ $t("component.videoCard.googleCalendar") }}
      </button>
    </template>
    <button
      type="button"
      class="video-card-menu-item"
      @click="
        openTlClient();
        closeMenu();
      "
    >
      <UiIcon :icon="icons.mdiTypewriter" class-name="h-4 w-4" />
      {{
        isLive || video.status === "upcoming"
          ? $t("component.videoCard.openClient")
          : $t("component.videoCard.openScriptEditor")
      }}
    </button>
    <button
      v-if="isPast"
      type="button"
      class="video-card-menu-item"
      @click="
        scriptUploadPanel();
        closeMenu();
      "
    >
      <UiIcon :icon="icons.mdiClipboardArrowUpOutline" class-name="h-4 w-4" />
      {{ $t("component.videoCard.uploadScript") }}
    </button>
    <button
      v-if="isChattable"
      type="button"
      class="video-card-menu-item"
      @click="
        openChatPopout();
        closeMenu();
      "
    >
      <UiIcon :icon="icons.mdiOpenInNew" class-name="h-4 w-4" />
      {{ $t("component.videoCard.popoutChat") }}
    </button>
    <button
      type="button"
      class="video-card-menu-item"
      @click="
        useAppStore().setReportVideo(video);
        closeMenu();
      "
    >
      <UiIcon :icon="icons.mdiFlag" class-name="h-4 w-4" />
      {{ $t("component.reportDialog.title") }}
    </button>

    <template v-if="appStore.isSuperuser">
      <div class="pt-1">
        <watch-quick-editor :video="video" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, computed, ref } from "vue";
import { useRouter } from "vue-router";
import { dayjs } from "@/utils/time";
import { useCopyToClipboard } from "@/composables/useCopyToClipboard";
import VideoQuickPlaylist from "@/components/playlist/VideoQuickPlaylist.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { useAppStore } from "@/stores/app";

const WatchQuickEditor = defineAsyncComponent(() => import("@/components/watch/WatchQuickEditor.vue"));

const props = defineProps<{ video: any }>();
const emit = defineEmits<{ (e: "closeMenu"): void }>();

const appStore = useAppStore();
const router = useRouter();
const { copyToClipboard, doneCopy } = useCopyToClipboard();

const showPlaylist = ref(false);

const watchPath = computed(() => `/watch/${props.video?.id}`);

const isLive = computed(() => {
  if (!props.video) return false;
  if (props.video.status === "past") return false;
  if (props.video.status === "live" || Date.parse(props.video.start_scheduled) < Date.now()) return true;
  return false;
});

const isPast = computed(() => !!(props.video?.status === "past"));

const isChattable = computed(() => {
  if (!props.video) return false;
  if (props.video.status === "past") return false;
  if (props.video.type !== "stream") return false;
  return true;
});


function openGoogleCalendar() {
  const startdate = props.video.start_scheduled;
  const baseurl = "https://www.google.com/calendar/render?action=TEMPLATE&text=";
  const videoTitle = encodeURIComponent(props.video.title);
  const googleCalendarFormat = "YYYYMMDD[T]HHmmss[Z]";
  const eventStart = dayjs.utc(startdate).format(googleCalendarFormat);
  const eventEnd = dayjs.utc(startdate).add(1, "hour").format(googleCalendarFormat);
  const details = `<a href="${window.origin}/watch/${props.video.id}">Open Video</a>`;
  window.open(
    baseurl.concat(videoTitle, "&dates=", eventStart, "/", eventEnd, "&details=", details),
    "_blank",
  );
}

function copyLink() {
  copyToClipboard(`${window.origin}/watch/${props.video.id}`);
}

function closeMenu() { emit("closeMenu"); }

function openTlClient() {
  if (appStore.userdata?.user) {
    if (isLive.value || props.video.status === "upcoming") {
      router.push({
        path: "/tlclient",
        query: { video: props.video.type === "placeholder" ? props.video.link : `YT_${props.video.id}` },
      });
    } else {
      router.push({ path: "/scripteditor", query: { video: `YT_${props.video.id}` } });
    }
  } else {
    router.push({ path: "/user" });
  }
}

function openChatPopout() {
  window.open(`https://youtube.com/live_chat?is_popout=1&v=${props.video.id}`, "_blank", `width=400,height=${window.innerHeight * 0.6}`);
}

function scriptUploadPanel() {
  if (appStore.userdata?.user) {
    appStore.setUploadPanel(true);
  } else {
    router.push({ path: "/user" });
  }
}
</script>

<style scoped>
.video-card-menu-item {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  border-radius: 0.875rem;
  padding: 0.625rem 0.75rem;
  color: var(--color-foreground);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.video-card-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.video-card-menu-playlist {
  border-radius: 0.875rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.5rem;
}

.video-card-menu-item-done {
  background: rgba(52, 211, 153, 0.2);
  color: #d1fae5;
}

:global(html[data-theme="light"] .video-card-menu-item:hover) {
  background: rgba(226, 232, 240, 0.9);
}

:global(html[data-theme="light"] .video-card-menu-playlist) {
  border-color: rgba(148, 163, 184, 0.28);
  background: rgba(241, 245, 249, 0.95);
}

:global(html[data-theme="light"] .video-card-menu-item-done) {
  background: rgba(52, 211, 153, 0.18);
  color: #065f46;
}
</style>
