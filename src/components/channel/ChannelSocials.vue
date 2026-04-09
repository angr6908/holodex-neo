<template>
  <div
    class="flex gap-2"
    :class="vertical ? 'flex-col items-start' : 'channel-social-horizontal items-center'"
    @click.stop=""
  >
    <UiButton
      v-if="channel.id && !hideYt"
      as="a"
      variant="ghost"
      size="icon"
      :href="`https://www.youtube.com/channel/${channel.id}`"
      rel="noreferrer"
      target="_blank"
      title="YouTube"
    >
      <UiIcon :icon="icons.mdiYoutube" class-name="text-red-500" />
    </UiButton>
    <UiButton
      v-if="channel.twitter && !hideTwitter"
      as="a"
      variant="ghost"
      size="icon"
      :href="`https://twitter.com/${channel.twitter}`"
      rel="noreferrer"
      target="_blank"
      title="Twitter"
    >
      <UiIcon :icon="icons.mdiTwitter" class-name="text-sky-400" />
    </UiButton>
    <UiButton
      v-if="channel.twitch && !hideTwitch"
      as="a"
      variant="ghost"
      size="icon"
      :href="`https://twitch.tv/${channel.twitch}`"
      rel="noreferrer"
      target="_blank"
      title="Twitch"
    >
      <UiIcon :icon="mdiTwitch" class-name="text-violet-400" />
    </UiButton>
    <UiButton
      v-if="channel.type === 'vtuber' && !hideFav"
      type="button"
      variant="ghost"
      size="icon"
      :title="tooltip"
      @click.stop="toggleFavorite($event)"
    >
      <UiIcon :icon="isFavorited ? icons.mdiHeart : mdiHeartOutline" :class-name="isFavorited && isLoggedIn ? 'text-rose-400' : 'text-slate-500'" />
    </UiButton>
    <UiButton
      v-if="showDelete"
      type="button"
      :variant="isBlocked ? 'destructive' : 'ghost'"
      size="sm"
      :title="blockTooltip"
      @click.stop.prevent="toggleBlocked"
    >
      <UiIcon :icon="mdiAccountCancel" />
      <span v-if="isBlocked">{{ t("component.channelSocials.blocked") }}</span>
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { mdiAccountCancel, mdiHeartOutline, mdiTwitch } from "@mdi/js";
import * as icons from "@/utils/icons";
import { useAppStore } from "@/stores/app";
import { useFavoritesStore } from "@/stores/favorites";
import { useSettingsStore } from "@/stores/settings";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

const props = withDefaults(defineProps<{
  channel: Record<string, any>;
  vertical?: boolean;
  hideYt?: boolean;
  hideTwitter?: boolean;
  hideTwitch?: boolean;
  hideFav?: boolean;
  showDelete?: boolean;
}>(), {
  vertical: false,
  hideYt: false,
  hideTwitter: false,
  hideTwitch: false,
  hideFav: false,
  showDelete: false,
});

const { t } = useI18n();
const appStore = useAppStore();
const favoritesStore = useFavoritesStore();
const settingsStore = useSettingsStore();

const tooltip = computed(() => {
  if (!isLoggedIn.value) return t("component.channelList.signInToFavorite");
  return !isFavorited.value
    ? t("component.channelSocials.addToFavorites")
    : t("component.channelSocials.removeFromFavorites");
});

const blockTooltip = computed(() =>
  !isBlocked.value
    ? t("component.channelSocials.block")
    : t("component.channelSocials.unblock"),
);

const isBlocked = computed(() => settingsStore.blockedChannelIDs.has(props.channel.id));
const isFavorited = computed(() => favoritesStore.isFavorited(props.channel.id));
const isLoggedIn = computed(() => appStore.isLoggedIn);

function toggleFavorite(event: Event) {
  event.preventDefault();
  if (!isLoggedIn.value) return;
  favoritesStore.toggleFavorite(props.channel.id);
  favoritesStore.updateFavorites();
}

function toggleBlocked() {
  settingsStore.toggleBlocked(props.channel);
}
</script>

<style>
.channel-social-horizontal {
    margin: 0 !important;
    flex: 0 1 auto !important;
    flex-wrap: wrap;
}
</style>
