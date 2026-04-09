<template>
  <div class="pull-to-refresh-material__control" style="z-index: 4">
    <svg
      class="pull-to-refresh-material__icon"
      fill="#4285f4"
      width="24"
      height="24"
      viewBox="0 0 24 24"
    >
      <path :d="icons.mdiRefresh" />
      <!-- <path d="M0 0h24v24H0z" fill="none" /> -->
    </svg>
    <svg
      class="pull-to-refresh-material__spinner"
      width="24"
      height="24"
      viewBox="25 25 50 50"
    >
      <circle
        class="pull-to-refresh-material__path"
        cx="50"
        cy="50"
        r="20"
        fill="none"
        stroke="#4285f4"
        stroke-width="4"
        stroke-miterlimit="10"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
// Modified version of https://github.com/jiangfengming/pull-to-refresh
import pullToRefresh from "@/external/mobile-pull-to-refresh/src/pullToRefresh";
import ptrAnimatesMaterial from "@/external/mobile-pull-to-refresh/src/styles/material/animates";
import "@/external/mobile-pull-to-refresh/src/styles/material/style.css";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
const route = useRoute();
const router = useRouter();
let destroyCb: (() => void) | null = null;

const shouldRefresh = computed(() =>
  ["watch_id", "watch", "edit_video", "multiview"].includes(String(route.name)),
);

onMounted(() => {
  const container = document.querySelector("main") || document.body;
  if (!container || !("ontouchstart" in window)) return;
  destroyCb = pullToRefresh({
    container,
    animates: ptrAnimatesMaterial,
    shouldPullToRefresh: () => !window.scrollY && !shouldRefresh.value && !appStore.navDrawer,
    async refresh() {
      const handledRefresh = await appStore.reloadCurrentPage({ source: "ptr", consumed: false });
      if (!handledRefresh.consumed) {
        router.go(0);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    },
  });
});

onBeforeUnmount(() => {
  destroyCb?.();
});
</script>

<style>
/* pull to refresh skin */

.ptr--ptr {
    box-shadow: none !important;
}

.ptr--box {
    padding: 0px !important;
    justify-content: center;
    display: flex;
}

/* icon size */
.ptr--icon,
.ptr--text > svg {
    width: 32px;
    height: 32px;
}

/* rotate left arrow to be down arrow, micro bandwidth savings */
.ptr--icon {
    transform: rotate(90deg);
}

/* only display either icon or text */
.ptr--ptr.ptr--refresh .ptr--content .ptr--icon {
    display: none;
}

.ptr--text {
    display: none;
}

/* rotate arrow when threshold reached */
.ptr--ptr.ptr--release .ptr--content .ptr--icon {
    transform: rotate(270deg);
}

/* show text with refresh spinner and animate */
.ptr--ptr.ptr--refresh .ptr--content .ptr--text {
    animation: spin 1.1s infinite linear;
    display: block;
}

@keyframes spin {
    0% {
        -webkit-transform: rotate(0deg);
        transform: rotate(0deg);
    }
    100% {
        -webkit-transform: rotate(360deg);
        transform: rotate(360deg);
    }
}
</style>
