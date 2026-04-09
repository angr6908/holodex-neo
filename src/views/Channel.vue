<template>
  <section v-if="!isLoading && !hasError" class="channel-container">
    <!-- Banner -->
    <div class="channel-banner-wrap">
      <img
        v-if="bannerImage"
        :src="bannerImage"
        class="channel-banner"
        alt=""
        @error="bannerFailed = true"
      >
    </div>
    <!-- Channel info (avatar row) -->
    <div class="channel-header">
      <div class="channel-identity">
        <ChannelImg :size="avatarSize" :channel="channel" class="shrink-0" />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <router-link :to="`/channel/${id}`" class="truncate text-base font-semibold text-white no-underline sm:text-lg">
              <UiButton
                v-if="channel.inactive"
                variant="ghost"
                size="icon"
                class-name="mr-1 inline-flex h-4 w-4 align-baseline"
                :title="$t('component.channelInfo.inactiveChannel')"
              >
                <UiIcon :icon="icons.mdiSchool" size="xs" />
              </UiButton>
              {{ channelName }}
            </router-link>
          </div>
          <div class="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 sm:text-sm">
            <a
              v-if="channel.yt_handle"
              :href="`https://youtube.com/${channel.yt_handle[0]}`"
              target="_blank"
              rel="noreferrer"
              class="text-slate-500 no-underline hover:text-slate-300"
            >
              {{ channel.yt_handle[0] }}
            </a>
            <span v-if="channel.yt_handle && channel.org" class="text-slate-600">•</span>
            <router-link
              v-if="channel.org"
              :to="`/channels?${channelOrg}`"
              class="text-slate-500 no-underline hover:text-slate-300"
            >
              {{ channel.org + (group ? " / " + group : "") }}
            </router-link>
            <span v-if="channel.subscriber_count" class="text-slate-600">•</span>
            <span v-if="channel.subscriber_count">{{ subscriberCount }}</span>
          </div>
        </div>
        <ChannelSocials :channel="channel" show-delete class="hidden shrink-0 sm:flex" />
      </div>
      <!-- Mobile-only socials row -->
      <ChannelSocials :channel="channel" show-delete class="flex shrink-0 sm:hidden" />
    </div>
    <!-- Tabs + grid/sort controls (padding matches video card zone) -->
    <div class="channel-tabs">
      <div class="flex flex-wrap items-center gap-1.5">
        <component
          :is="tab.path.includes('https') ? 'a' : 'router-link'"
          v-for="tab in tabs.filter((t) => !t.hide)"
          :key="tab.path"
          :to="tab.path.includes('https') ? undefined : tab.path"
          :href="tab.path.includes('https') ? tab.path : undefined"
          :target="tab.path.includes('https') ? '_blank' : undefined"
          :rel="tab.path.includes('https') ? 'noreferrer' : undefined"
          class="inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition"
          :class="isActiveTab(tab) ? 'bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]' : 'text-slate-400 hover:bg-white/8 hover:text-white'"
        >
          {{ tab.name }}
        </component>
      </div>
      <div id="channelTabControls" class="flex items-center gap-1" />
    </div>
    <!-- Channel content (child routes) -->
    <div class="channel min-h-[85vh] px-2 py-3 sm:px-0">
      <router-view />
    </div>
  </section>
  <LoadingOverlay v-else :is-loading="isLoading" :show-error="hasError" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useChannelStore } from "@/stores/channel";
import { useSettingsStore } from "@/stores/settings";
import { useMetaTitle } from "@/composables/useMetaTitle";
import { formatCount, getBannerImages } from "@/utils/functions";
import ChannelSocials from "@/components/channel/ChannelSocials.vue";
import ChannelImg from "@/components/channel/ChannelImg.vue";
import LoadingOverlay from "@/components/common/LoadingOverlay.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import * as icons from "@/utils/icons";

defineOptions({ name: "Channel" });

const route = useRoute();
const { t } = useI18n();

const channelStore = useChannelStore();
const settingsStore = useSettingsStore();

const { id, channel, isLoading, hasError } = storeToRefs(channelStore);
const windowWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1280);
const bannerFailed = ref(false);

// Computed
const breakpointName = computed(() => {
  if (windowWidth.value < 600) return "xs";
  if (windowWidth.value < 960) return "sm";
  if (windowWidth.value < 1264) return "md";
  if (windowWidth.value < 1904) return "lg";
  return "xl";
});

const bannerImage = computed(() => {
  if (bannerFailed.value) return "";
  if (!channel.value.banner) return "";
  const { mobile, tablet, tv, banner } = getBannerImages(channel.value.banner);
  const banners: Record<string, string> = {
    xs: mobile,
    sm: tablet,
    xl: tv,
  };
  return banners[breakpointName.value] || banner;
});

const avatarSize = computed(() => {
  switch (breakpointName.value) {
    case "xs":
    case "sm":
      return 48;
    default:
      return 72;
  }
});

const tabs = computed(() => [
  {
    path: `/channel/${id.value}/`,
    name: `${t("views.channel.video")}`,
    exact: true,
  },
  {
    path: `/channel/${id.value}/clips`,
    name: `${t("views.channel.clips")}`,
    hide: channel.value.type === "subber",
  },
  {
    path: `https://music.holodex.net/channel/${id.value}`,
    name: `${t("views.channel.music")}`,
    hide: channel.value.type === "subber",
  },
  {
    path: `/channel/${id.value}/collabs`,
    name: `${t("views.channel.collabs")}`,
    hide: channel.value.type === "subber",
  },
  {
    path: `/channel/${id.value}/about`,
    name: `${t("views.channel.about")}`,
  },
]);

const channelName = computed(() => {
  const prop = settingsStore.nameProperty;
  return channel.value[prop] || channel.value.name;
});

const subscriberCount = computed(() => {
  if (!channel.value.subscriber_count) return "";
  return t(
    "component.channelInfo.subscriberCount",
    { n: formatCount(channel.value.subscriber_count, settingsStore.lang) },
  );
});

const group = computed(() => {
  if (channel.value.group) return channel.value.group;
  if (channel.value.suborg) return channel.value.suborg.slice(2);
  return null;
});

const channelOrg = computed(() => new URLSearchParams({ org: channel.value.org }).toString());

useMetaTitle(() => channelName.value ? `${channelName.value} - Holodex` : "Loading...");

// Methods
function handleResize() {
  windowWidth.value = window.innerWidth;
}

function isActiveTab(tab: any) {
  if (tab.path.includes("https")) return false;
  if (tab.exact) return route.path === tab.path;
  return route.path.startsWith(tab.path);
}

function init() {
  window.scrollTo(0, 0);
  channelStore.$reset();
  channelStore.setId(route.params.id as string);
  channelStore.fetchChannel();
}

// Lifecycle
init();

onMounted(() => {
  window.addEventListener("resize", handleResize, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
});
</script>

<style>
.channel-container {
  padding: 0;
}

.channel-banner-wrap {
  width: calc(100% - 1rem);
  aspect-ratio: 6.2 / 1;
  overflow: hidden;
  border-radius: 1rem;
  margin: 0.5rem auto 0;
  background: linear-gradient(135deg, rgb(30 41 59 / 0.6), rgb(15 23 42 / 0.8));
}
@media (min-width: 640px) {
  .channel-banner-wrap {
    width: 100%;
    border-radius: 1.25rem;
    margin: 0;
  }
}

.channel-banner {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.channel-header {
  padding: 0.75rem 0.75rem 0;
}
@media (min-width: 640px) {
  .channel-header { padding: 1rem 1.25rem 0; }
}

.channel-identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
@media (min-width: 640px) {
  .channel-identity { gap: 1rem; }
}

/* Tabs: padding matches the video card zone (px-2 / sm:px-0) */
.channel-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.5rem 0;
  border-top: 1px solid rgb(255 255 255 / 0.06);
}
@media (min-width: 640px) {
  .channel-tabs { padding: 0.5rem 0 0; }
}
</style>
