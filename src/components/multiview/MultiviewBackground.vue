<template>
  <div class="mv-background">
    <template v-if="showTips">
      <div class="mv-empty-state">
        <div class="mv-empty-card">
          <div class="mv-empty-lead">
            {{ collapseToolbar ? $t("views.multiview.openToolbarTip") : $t("views.multiview.autoLayoutTip") }}
          </div>
          <div v-if="!collapseToolbar" class="mv-empty-sublead">
            {{ $t("views.multiview.createLayoutTip") }}
          </div>
          <div class="mv-empty-divider" />
          <div class="hints">
            <div class="text-h4">
              {{ $t("views.multiview.hints") }}
            </div>
            <div class="hint-item">1. <UiIcon :icon="icons.mdiGridLarge" size="sm" /> {{ $t("views.multiview.presetsHint") }}</div>
            <div class="hint-item">
              2.
              <UiIcon :icon="mdiTuneVertical" size="sm" />
              {{ $t("views.multiview.mediaControlsHint1") }}
              <UiIcon :icon="mdiFastForward" size="sm" />
              {{ $t("views.multiview.mediaControlsHint2") }}
            </div>
            <div class="hint-item">3. <UiIcon :icon="mdiCardPlus" size="sm" /> {{ $t("views.multiview.dragDropHint") }}</div>
            <div class="hint-item">4. <UiIcon :icon="reorderIcon" size="sm" /> {{ $t("views.multiview.reorderHint") }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  mdiCardPlus, mdiTuneVertical, mdiFastForward,
} from "@mdi/js";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { reorderIcon } from "@/utils/mv-utils";
import * as icons from "@/utils/icons";

defineOptions({ name: "MultiviewBackground" });

withDefaults(defineProps<{
  collapseToolbar?: boolean;
  showTips?: boolean;
}>(), {
  collapseToolbar: false,
  showTips: true,
});
</script>

<style>
.mv-background {
    opacity: 0.75;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    background-repeat: initial;
    background-image: linear-gradient(to right, rgba(128, 128, 128, 0.15) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(128, 128, 128, 0.15) 1px, transparent 1px);
}

.mv-empty-state {
    display: flex;
    justify-content: center;
    padding: clamp(1rem, 4vh, 2.5rem) 1rem 0;
}

.mv-empty-card {
    width: min(100%, 40rem);
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.82);
    backdrop-filter: blur(6px);
    border-radius: 1.25rem;
    padding: 1.25rem 1.25rem 1rem;
    color: rgba(226, 232, 240, 0.96);
    box-shadow: 0 24px 80px rgba(2, 6, 23, 0.35);
}

.mv-empty-lead {
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.45;
}

.mv-empty-sublead {
    margin-top: 0.5rem;
    color: rgba(203, 213, 225, 0.9);
    line-height: 1.45;
}

.mv-empty-divider {
    height: 1px;
    margin: 1rem 0 0.85rem;
    background: rgba(255, 255, 255, 0.08);
}

@media (max-width: 640px) {
    .mv-empty-card {
        width: min(100%, 24rem);
        padding: 1rem 1rem 0.9rem;
    }

    .mv-empty-lead {
        font-size: 0.95rem;
    }
}

.hints .hint-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
    font-weight: 400;
}

.hints .text-h4 {
    font-weight: 400;
}
</style>
