<template>
  <div :class="'rel-ts '+(upTo?'rel-end':'rel-start') +' mb-4'">
    <div
      ref="tl"
      class="timeline"
      @mousemove="hover"
      @click="tryPlay"
    >
      <div
        class="ts-progress overflow-hidden rounded-full bg-white/10"
      >
        <div
          class="h-full bg-rose-500"
          :style="{ width: `${((Number(test) - min) * 100.0) / (max - min)}%` }"
        />
      </div>
      <div class="rel-current" :style="'transform: translateX('+mousex+'px);'">
        Play from here
      </div>
    </div>
    <div class="relative mb-2">
      <input
        :value="newVal"
        :min="min"
        :max="max"
        step="1"
        type="range"
        class="rel-slider h-5 w-full cursor-ew-resize accent-rose-500"
        @input="setNewValue(+$event.target.value)"
      >
      <div class="mt-1 text-center text-xs text-slate-300">
        {{ newVal === value ? formatDuration(value*1000) : ((newVal - value) > 0 ? '+' : '')+(newVal - value)+'s' }}
      </div>
    </div>
    <span class="showOnHover float-right font-weight-light" style="font-size: 12px;">Click to test, drag to change time.</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { formatDuration } from "@/utils/time";

const props = withDefaults(defineProps<{
  upTo?: boolean;
  value: number;
  test: number;
}>(), { upTo: false });

const emit = defineEmits<{
  (e: "input", val: number): void;
  (e: "seekTo", val: number): void;
}>();

const newVal = ref(props.value);
const mousex = ref(0);
const tl = ref<HTMLElement | null>(null);

const min = computed(() => Math.max(0, props.value - 6));
const max = computed(() => Math.max(0, props.value + 6));

function setNewValue(n: number) {
  newVal.value = n;
  emit("input", newVal.value);
}

function hover(e: MouseEvent) { mousex.value = e.clientX; }

function tryPlay(e: MouseEvent) {
  const x = e.clientX;
  const rect = tl.value!.getBoundingClientRect();
  const value = ((x - rect.left) / rect.width) * (max.value - min.value) + min.value;
  emit("seekTo", value);
}
</script>

<style lang="scss">
.ts-progress {
  margin: 20px 8px 6px 8px;
  display: flex;
  width: auto !important;
  align-items: flex-start;
}
.ts-try-play {
  position: absolute;
  z-index: 1;
  margin-top: -14px;
}

.rel-ts {
  margin-left: -10px;
  margin-right: -10px;

  .timeline {
    padding-top: 25px;
    cursor:pointer;
  }
  .timeline:hover .rel-current {
    display: block;
    opacity: 1;
  }
  .rel-current {
    display: block;
    opacity: 0;
    font-size: 9px;
    border-left: 2px solid #aaa;
    height: 20px;
    position: absolute;
    margin-top: -23px;
    left: 0;
    pointer-events: none;
    padding-left: 5px;
  }

  &:hover .showOnHover {
    opacity: 0.7;
  }
  .showOnHover {
    opacity: 0;
  }

  .slider {
    margin-top: 12px;
  }
}

</style>
