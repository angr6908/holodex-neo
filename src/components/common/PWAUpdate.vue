<template>
  <div
    v-if="needRefresh"
    class="fixed bottom-4 right-4 z-[120] flex max-w-sm items-center gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/20 px-4 py-3 text-sm text-white backdrop-blur"
  >
    {{ $t("views.app.update_available") }} — updating…
  </div>
  <div
    v-else-if="showUpdateDetails"
    class="fixed bottom-4 left-1/2 z-[120] flex max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/20 px-4 py-3 text-sm text-white backdrop-blur"
  >
    {{ $t("views.app.check_about_page") }}
    <div class="ml-auto flex items-center gap-2">
      <UiButton
        variant="ghost"
        size="sm"
        as="a"
        href="/about#changelog"
        @click="showUpdateDetails = false"
      >
        Changelog
      </UiButton>
      <UiButton variant="ghost" size="sm" @click="showUpdateDetails = false">
        {{ $t("views.app.close_btn") }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import * as SW from "../../sw";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();

const needRefresh = ref(false);
const showUpdateDetails = computed({
  get: () => appStore.showUpdateDetails,
  set: (val) => appStore.setShowUpdatesDetail(val),
});

SW.setNeedsRefreshCallback(() => {
  needRefresh.value = true;
});
SW.setControllerChangeCallback(() => {
  showUpdateDetails.value = true;
});
</script>
