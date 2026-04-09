<template>
  <!-- Render with opaque response for cache if size is lte 40 -->
  <a
    v-if="!err"
    :href="!noLink && `/channel/${channel.id}`"
    :title=" channel.name +
      (channel.english_name ? `\nEN: ${channel.english_name}` : '') +
      (channel.org ? `\n> ${channel.org}` : '') +
      (channel.group ? `\n> ${channel.group}` : '') "
    class="inline-flex shrink-0 overflow-hidden rounded-full"
    :style="{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px` }"
    @click.exact.prevent="goToChannel"
  >
    <img
      :ref="(el: any) => el && onImgMounted(el)"
      :src="photo"
      decoding="async"
      :width="size"
      :height="size"
      class="block h-full w-full rounded-full object-cover ring-1 ring-white/10 img-fade-in"
      @error="err = true"
      @load="onImgLoad"
    >
  </a>
  <div
    v-else
    :width="size"
    :height="size"
    :title="channel.name"
    class="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-secondary)] text-white ring-1 ring-white/10"
    :style="{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px` }"
  >
    <UiIcon :icon="icons.mdiAccountCircleOutline" size="lg" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { getChannelPhoto, resizeChannelPhoto } from "@/utils/functions";
import UiIcon from "@/components/ui/icon/Icon.vue";
import * as icons from "@/utils/icons";

const props = withDefaults(defineProps<{
  channel: Record<string, any>;
  size?: string | number;
  noLink?: boolean;
  noAlt?: boolean;
  rounded?: boolean;
}>(), {
  size: 40,
  noLink: false,
  noAlt: false,
  rounded: false,
});

const router = useRouter();
const err = ref(false);

// Reset error when channel changes so we can retry with the new source URL
watch(() => props.channel?.id, () => { err.value = false; });

const photo = computed(() => {
  if (props.channel?.id) {
    return getChannelPhoto(props.channel.id);
  }
  // Fallback: use direct photo URL if channel has one
  if (props.channel?.photo) {
    return resizeChannelPhoto(props.channel.photo);
  }
  return "";
});

function onImgLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  img.classList.add("loaded");
}

function onImgMounted(el: Element) {
  const img = el as HTMLImageElement;
  if (img.dataset.fadeInit) return;
  img.dataset.fadeInit = "1";
  if (img.complete && img.naturalHeight > 0) {
    img.classList.add("loaded");
  } else {
    img.classList.add("img-pending");
    img.dataset.fadeReady = "1";
  }
}

function goToChannel(e: MouseEvent) {
  if (props.noLink) return;
  e.stopImmediatePropagation();
  router.push({ path: `/channel/${props.channel.id}` });
}
</script>

<style scoped>
img:hover {
    cursor: pointer;
}
/* Smooth fade-in for avatars — only animates on network download, not cache */
.img-fade-in.img-pending {
  opacity: 0;
}
.img-fade-in.img-pending[data-fade-ready] {
  transition: opacity 0.3s ease;
}
.img-fade-in.loaded {
  opacity: 1;
}
</style>
