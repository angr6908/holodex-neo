<template>
  <div class="cell-control flex flex-wrap items-center gap-2">
    <UiButton
      v-if="hasBack"
      type="button"
      size="sm"
      class-name="return-btn mr-auto bg-amber-600 text-slate-950 hover:brightness-110"
      @click="$emit('back')"
    >
      <UiIcon :icon="mdiArrowLeftCircle" />
    </UiButton>

    <UiButton
      v-if="hasPlaypause"
      type="button"
      size="sm"
      class-name="ml-2 h-8 w-8 min-w-8 rounded-lg p-0"
      @click="$emit('playpause')"
    >
      <UiIcon :icon="playIcon" />
    </UiButton>

    <UiButton
      v-if="hasReset"
      type="button"
      size="sm"
      variant="secondary"
      class-name="ml-2 mr-0 h-8 w-8 min-w-8 rounded-lg p-0"
      @click="$emit('reset')"
    >
      <UiIcon :icon="icons.mdiRefresh" />
    </UiButton>

    <UiButton
      type="button"
      size="sm"
      variant="destructive"
      class-name="ml-auto h-8 w-8 min-w-8 rounded-lg p-0"
      :title="'Delete cell'"
      @mouseenter="hoverDelete = true"
      @mouseleave="hoverDelete = false"
      @click="$emit('delete')"
    >
      <UiIcon :icon="hoverDelete ? mdiDeleteEmpty : icons.mdiDelete" />
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useAttrs } from "vue";
import { mdiArrowLeftCircle, mdiDeleteEmpty } from "@mdi/js";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

defineOptions({ name: "CellControl", inheritAttrs: false });

defineProps<{
  playIcon?: string;
}>();

defineEmits<{
  (e: "back"): void;
  (e: "playpause"): void;
  (e: "reset"): void;
  (e: "delete"): void;
}>();

const attrs = useAttrs();
const hoverDelete = ref(false);

const hasBack = computed(() => Boolean(attrs.onBack));
const hasPlaypause = computed(() => Boolean(attrs.onPlaypause));
const hasReset = computed(() => Boolean(attrs.onReset));
</script>

<style>
.mobile-helpers .cell-control {
  margin: 0 -5px;
}

.cell-control {
  margin: 0;
  padding: 0.35rem 0.35rem 0.4rem;
}

.mobile-helpers .cell-control .returnbtn {
  width: 25px;
  min-width: 40px;
}

.cell-control .return-btn {
    border-radius: 0;
    width: 60px;
    margin-right: 10px;
    position: relative;
}

.return-btn::after {
    transition: width 0.1s, right 0.1s;
    content: "";
    width: 10px;
    position: absolute;
    right: -8px;
    background-color: inherit;
    height: 100%;
    border-radius: 0 6px 6px 0;
}

.return-btn:hover::after {
    content: "";
    width: 18px;
    position: absolute;
    right: -16px;
    background-color: inherit;
    height: 100%;
    border-radius: 0 6px 6px 0;
}
</style>
