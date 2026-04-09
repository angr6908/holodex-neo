<template>
  <div
    ref="root"
    class="relative mr-1"
    @mouseenter="handleEnter"
    @mouseleave="handleLeave"
  >
    <button
      type="button"
      class="relative overflow-hidden rounded-full"
      :style="{ width: `${size}px`, height: `${size}px` }"
      @click="toggleHover"
    >
      <img
        :src="photo"
        crossorigin="anonymous"
        :alt="`${channel.name}'s profile picture`"
        :width="size"
        :height="size"
        class="h-full w-full object-cover"
      >
      <slot :is-hover="isHover">
        <div
          v-if="isHover"
          class="absolute inset-0 flex items-center justify-center bg-slate-950/70"
        >
          <UiButton
            as="router-link"
            size="icon"
            variant="ghost"
            :to="`/channel/${channel.id}`"
          >
            <UiIcon :icon="icons.mdiLoginVariant" />
          </UiButton>
        </div>
      </slot>
    </button>

    <UiCard
      v-if="isHover"
      class-name="channel-hover-tooltip absolute left-1/2 top-full z-[80] mt-2 flex -translate-x-1/2 flex-row items-baseline gap-2 border border-white/10 px-2 py-2"
    >
      <ChannelSocials
        :channel="channel"
        vertical
        hide-yt
        hide-twitter
      />
      <span class="ml-2 text-sm text-slate-300">{{ channelName }}</span>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { getChannelPhoto, resizeChannelPhoto } from "@/utils/functions";
import * as icons from "@/utils/icons";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import ChannelSocials from "@/components/channel/ChannelSocials.vue";

const props = withDefaults(defineProps<{
  channel: Record<string, any>;
  size?: number;
  closeDelay?: number;
}>(), {
  size: 60,
  closeDelay: 250,
});

const appStore = useAppStore();
const settingsStore = useSettingsStore();

const isHover = ref(false);
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const channelName = computed(() => {
  const prop = settingsStore.nameProperty;
  if (props.channel[prop]) return props.channel[prop];
  return props.channel.name;
});

const photo = computed(() => {
  return getChannelPhoto(props.channel?.id);
});

function handleEnter() {
  if (closeTimer) clearTimeout(closeTimer);
  if (!appStore.isMobile) isHover.value = true;
}

function handleLeave() {
  if (appStore.isMobile) return;
  closeTimer = setTimeout(() => {
    isHover.value = false;
  }, props.closeDelay);
}

function toggleHover() {
  if (appStore.isMobile) {
    isHover.value = !isHover.value;
  }
}

onBeforeUnmount(() => {
  if (closeTimer) clearTimeout(closeTimer);
});
</script>

<style>
.channel-hover-tooltip {
  max-height: 48px;
  overflow: hidden;
}
</style>
