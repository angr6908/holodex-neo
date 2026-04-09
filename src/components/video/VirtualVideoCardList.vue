<template>
  <!-- Video Card grid rows -->
  <virtual-list
    ref="virtualVideoList"
    style="overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain"
    :style="{ height: computedHeight }"
    :data-key="'id'"
    :data-sources="videos"
    :data-component="VideoCard"
    :extra-props="{ ...$props, parentPlaylistId: (playlist && playlist.id) || 'local' }"
    :estimate-size="88"
    :keeps="keeps"
    :page-mode="pageMode"
    :item-class="'virtual-video-list-item'"
    :item-class-add="checkActive"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import VideoCard from "@/components/video/VideoCard.vue";
import VirtualList from "vue-virtual-scroll-list";

defineOptions({ name: "VirtualVideoCardList" });

const props = withDefaults(defineProps<{
  playlist: Record<string, any>;
  includeChannel?: boolean;
  includeAvatar?: boolean;
  hideThumbnail?: boolean;
  horizontal?: boolean;
  keeps?: number;
  pageMode?: boolean;
  activeId?: string | null;
  dense?: boolean;
  disableDefaultClick?: boolean;
  activePlaylistItem?: boolean;
  activeIndex?: number;
  height?: string;
}>(), {
  includeChannel: undefined,
  includeAvatar: undefined,
  hideThumbnail: false,
  horizontal: true,
  keeps: 10,
  pageMode: undefined,
  activeId: null,
  dense: undefined,
  disableDefaultClick: undefined,
  activePlaylistItem: undefined,
  activeIndex: -1,
  height: "500px",
});

const virtualVideoList = ref<InstanceType<typeof VirtualList> | null>(null);

const videos = computed(() => props.playlist.videos || []);
const computedHeight = computed(() => props.pageMode ? "" : props.height);

watch(() => props.activeIndex, (idx) => {
  virtualVideoList.value?.scrollToIndex(idx);
});

onMounted(() => {
  virtualVideoList.value?.scrollToIndex(props.activeIndex);
});

function checkActive(index: number) {
  if (index === props.activeIndex) return "video-card-active";
  return "";
}
</script>

<style lang="scss">
.virtual-video-list-item {
    padding: 6px 4px;
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
    background-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
    background-size: cover;
    position: absolute;
    top: -1px;
    right: -1px;
    bottom: -1px;
    left: -1px;
    opacity: 0.15;
    border-radius: 4px;
}
</style>
