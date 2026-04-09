<template>
  <div
    class="layout-btn rounded-[calc(var(--radius)+4px)] p-2 transition"
    @click="
      (e) => {
        $emit('click', e);
      }
    "
  >
    <LayoutPreview
      :layout="preset.layout"
      :content="preset.content"
      :mobile="preset.portrait"
      :scale="scale"
    />
    <div class="layout-card-text mt-2 flex items-center justify-center gap-2 text-center text-sm">
      <slot name="pre" />
      <span class="min-w-0 truncate" :class="{ 'flex-grow': custom, 'text-sky-300': active }">{{ preset.name }}</span>
      <slot name="post" />
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutPreview from "./LayoutPreview.vue";

defineOptions({ name: "LayoutPreviewCard" });

defineProps<{
  preset: Record<string, any>;
  custom?: boolean;
  active?: boolean;
  scale?: number;
}>();

defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();
</script>

<style>
.layout-btn:hover {
    background-color: rgb(255 255 255 / 0.06);
    cursor: pointer;
}

.layout-card-text {
  position: relative;
}
</style>
